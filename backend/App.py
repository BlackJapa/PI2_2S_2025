import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import check_password_hash


app = Flask(__name__)
CORS(app) # Permite todas as origens para eliminar erro de CORS

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor, sslmode='require')


# --- Rota de Cadastro ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    nome = data.get('nome')
    email = data.get('email')
    password = generate_password_hash(data.get('password'))
    bloco = str(data.get('bloco'))
    ap = str(data.get('apartamento'))

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Encontrar o ID do apartamento correto baseado no bloco e número
        cursor.execute("""
            SELECT a.apartamento_id FROM Apartamentos a
            JOIN Blocos b ON a.bloco_id = b.bloco_id
            WHERE b.numero_bloco = %s AND a.numero_apartamento = %s
        """, (bloco, ap))
        
        result = cursor.fetchone()
        if not result:
            return jsonify({'error': f'Bloco {bloco} ou Apartamento {ap} não cadastrados no sistema.'}), 400
        
        ap_id = result['apartamento_id']

        # 2. Inserir o novo morador
        cursor.execute("""
            INSERT INTO Moradores (nome, email, password, role, apartamento_id)
            VALUES (%s, %s, %s, 'morador', %s)
        """, (nome, email, password, ap_id))
        
        conn.commit()
        return jsonify({'message': 'Usuário cadastrado com sucesso!'}), 201

    except psycopg2.IntegrityError:
        return jsonify({'error': 'Este e-mail já está cadastrado.'}), 400
    except Exception as e:
        return jsonify({'error': f'Erro no servidor: {str(e)}'}), 500
    finally:
        if conn: conn.close()

@app.route('/api/db-status', methods=['GET'])
def db_status():
    return jsonify({'status': 'online'}), 200

# --- Rota de Login ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Busca os dados básicos do usuário
        cursor.execute("SELECT * FROM Moradores WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password'], password):
            # 2. Busca TODOS os apartamentos vinculados a ele
            cursor.execute("""
                SELECT a.numero_apartamento, b.numero_bloco 
                FROM Morador_Apartamentos ma
                JOIN Apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN Blocos b ON a.bloco_id = b.bloco_id
                WHERE ma.morador_id = %s
            """, (user['morador_id'],))
            
            apartamentos = cursor.fetchall()
            
            # Se for síndico, a lista de apartamentos pode ser ignorada no painel, 
            # mas enviamos mesmo assim.
            
            return jsonify({
                'id': user['morador_id'],
                'nome': user['nome'],
                'role': user['role'],
                'apartamentos': apartamentos # <-- Agora enviamos uma LISTA
            }), 200
        
        return jsonify({'error': 'E-mail ou senha incorretos'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/complaints', methods=['GET', 'POST'])
def manage_complaints():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if request.method == 'POST':
            data = request.get_json()
            # O assunto (subject) agora virá de uma lista pré-determinada
            cursor.execute("""
                INSERT INTO Complaints (user_id, subject, description, status) 
                VALUES (%s, %s, %s, 'Pendente')
            """, (data.get('user_id'), data.get('subject'), data.get('description')))
            conn.commit()
            return jsonify({'message': 'Reclamação registrada!'}), 201

        elif request.method == 'GET':
            user_id = request.args.get('user_id')
            role = request.args.get('role')

            if role == 'sindico':
                # 1. MESTRE: Vê absolutamente tudo de todos os blocos
                cursor.execute("SELECT * FROM Complaints ORDER BY id DESC")
            
            elif role == 'admin_bloco':
                # 2. SÍNDICO DE BLOCO: Vê apenas reclamações do seu próprio bloco
                # Primeiro descobrimos qual é o bloco deste admin
                cursor.execute("""
                    SELECT a.bloco_id FROM Apartamentos a 
                    JOIN Moradores m ON m.apartamento_id = a.apartamento_id 
                    WHERE m.morador_id = %s
                """, (user_id,))
                admin_bloco_id = cursor.fetchone()['bloco_id']

                # Agora buscamos reclamações de moradores que moram no mesmo bloco
                cursor.execute("""
                    SELECT c.* FROM Complaints c
                    JOIN Moradores m ON c.user_id = m.morador_id
                    JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
                    WHERE a.bloco_id = %s ORDER BY c.id DESC
                """, (admin_bloco_id,))
            
            else:
                # 3. MORADOR: Vê apenas as suas
                cursor.execute("SELECT * FROM Complaints WHERE user_id = %s ORDER BY id DESC", (user_id,))
            
            return jsonify(cursor.fetchall()), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/users/<int:user_id>/role', methods=['PUT'])
def change_user_role(user_id):
    """Rota para o Síndico Geral alterar o nível de acesso de outros usuários."""
    data = request.get_json()
    new_role = data.get('role') # Pode ser 'morador', 'admin_bloco' ou 'sindico'
    
    # Validação básica de segurança
    if new_role not in ['morador', 'admin_bloco', 'sindico']:
        return jsonify({'error': 'Cargo inválido'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Atualiza o cargo do usuário no banco
        cursor.execute("UPDATE Moradores SET role = %s WHERE morador_id = %s", (new_role, user_id))
        conn.commit()
        
        return jsonify({'message': f'Permissão atualizada para {new_role} com sucesso!'}), 200

    except Exception as e:
        print(f"Erro ao alterar permissão: {e}")
        return jsonify({'error': 'Erro interno ao atualizar permissão'}), 500
    finally:
        if conn: conn.close()

# --- Rota para Listar Usuários (Com Filtro por Bloco) ---
@app.route('/api/users', methods=['GET'])
def list_users():
    user_id = request.args.get('user_id')
    role = request.args.get('role')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if role == 'sindico':
            # Master vê todos os moradores de todos os blocos
            cursor.execute("""
                SELECT m.morador_id, m.nome, m.email, m.role, a.numero_apartamento, b.numero_bloco
                FROM Moradores m
                LEFT JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
                LEFT JOIN Blocos b ON a.bloco_id = b.bloco_id
                ORDER BY b.numero_bloco, a.numero_apartamento
            """)
        elif role == 'admin_bloco':
            # 1. Descobre o bloco do admin
            cursor.execute("SELECT bloco_id FROM Apartamentos WHERE apartamento_id = (SELECT apartamento_id FROM Moradores WHERE morador_id = %s)", (user_id,))
            res = cursor.fetchone()
            if not res: return jsonify({'error': 'Admin sem bloco associado'}), 400
            
            bloco_id = res['bloco_id']
            # 2. Busca apenas moradores daquele bloco
            cursor.execute("""
                SELECT m.morador_id, m.nome, m.email, m.role, a.numero_apartamento, b.numero_bloco
                FROM Moradores m
                JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
                JOIN Blocos b ON a.bloco_id = b.bloco_id
                WHERE a.bloco_id = %s
                ORDER BY a.numero_apartamento
            """, (bloco_id,))
        else:
            return jsonify({'error': 'Acesso negado'}), 403

        return jsonify(cursor.fetchall()), 200
    finally:
        if conn: conn.close()

# --- Rota para Atualizar Reclamação (Status e Comentário) ---
@app.route('/api/complaints/<int:complaint_id>', methods=['PUT'])
def update_complaint(complaint_id):
    data = request.get_json()
    new_status = data.get('status')
    admin_comment = data.get('admin_comment') # As "Ações Tomadas"

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Complaints 
            SET status = %s, admin_comment = %s 
            WHERE id = %s
        """, (new_status, admin_comment, complaint_id))
        conn.commit()
        return jsonify({'message': 'Atualizado com sucesso!'}), 200
    finally:
        if conn: conn.close()   