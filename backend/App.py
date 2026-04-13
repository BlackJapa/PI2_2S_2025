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

        # SE FOR PARA CRIAR UMA RECLAMAÇÃO (POST)
        if request.method == 'POST':
            data = request.get_json()
            user_id = data.get('user_id')
            subject = data.get('subject')
            description = data.get('description')
            
            cursor.execute("""
                INSERT INTO Complaints (user_id, subject, description, status) 
                VALUES (%s, %s, %s, 'Pendente')
            """, (user_id, subject, description))
            conn.commit()
            return jsonify({'message': 'Reclamação registrada com sucesso!'}), 201

        # SE FOR PARA LISTAR RECLAMAÇÕES (GET)
        elif request.method == 'GET':
            user_id = request.args.get('user_id')
            role = request.args.get('role')
            
            # Síndico e Admin veem todas, Morador vê apenas as dele
            if role in ['sindico', 'admin_bloco']:
                cursor.execute("SELECT * FROM Complaints ORDER BY id DESC")
            else:
                cursor.execute("SELECT * FROM Complaints WHERE user_id = %s ORDER BY id DESC", (user_id,))
            
            complaints = cursor.fetchall()
            return jsonify(complaints), 200

    except Exception as e:
        print(f"Erro nas reclamações: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
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