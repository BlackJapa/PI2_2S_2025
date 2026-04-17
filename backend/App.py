import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

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

    print(f"\n--- INICIANDO NOVO CADASTRO ---")
    print(f"👤 Nome: {nome} | E-mail: {email}")

    # 1. TRAVA DE SEGURANÇA: Garante que Bloco e Ap são números inteiros puros
    try:
        bloco = int(data.get('bloco'))
        ap = int(data.get('apartamento'))
    except (ValueError, TypeError):
        return jsonify({'error': 'Bloco e Apartamento devem ser apenas números inteiros.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 2. Encontrar o ID do apartamento
        cursor.execute("SELECT a.apartamento_id FROM Apartamentos a JOIN Blocos b ON a.bloco_id = b.bloco_id WHERE b.numero_bloco = %s AND a.numero_apartamento = %s", (bloco, ap))
        result = cursor.fetchone()
        
        if not result:
            return jsonify({'error': f'O Bloco {bloco} ou Apartamento {ap} não existe no condomínio.'}), 400
        
        ap_id = result['apartamento_id']

        # 3. Inserir Morador
        cursor.execute("INSERT INTO Moradores (nome, email, password, role) VALUES (%s, %s, %s, 'morador') RETURNING morador_id", (nome, email, password))
        novo_morador_id = cursor.fetchone()['morador_id']

        # 4. Criar o vínculo na tabela de Múltiplos Apartamentos
        cursor.execute("INSERT INTO Morador_Apartamentos (morador_id, apartamento_id) VALUES (%s, %s)", (novo_morador_id, ap_id))
        
        conn.commit()
        return jsonify({'message': 'Registo efetuado com sucesso!'}), 201

    except psycopg2.IntegrityError:
        if conn: conn.rollback()
        return jsonify({'error': 'Este e-mail já está registado no sistema.'}), 400
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': f'Erro no banco de dados: {str(e)}'}), 500
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
        
        cursor.execute("SELECT * FROM Moradores WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password'], password):
            cursor.execute("""
                SELECT a.numero_apartamento, b.numero_bloco 
                FROM Morador_Apartamentos ma
                JOIN Apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN Blocos b ON a.bloco_id = b.bloco_id
                WHERE ma.morador_id = %s
            """, (user['morador_id'],))
            
            apartamentos = cursor.fetchall()
            
            return jsonify({
                'id': user['morador_id'],
                'nome': user['nome'],
                'role': user['role'],
                'apartamentos': apartamentos
            }), 200
        
        return jsonify({'error': 'E-mail ou senha incorretos'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

# --- Rota para Listar todos os Blocos ---
@app.route('/api/blocks', methods=['GET'])
def get_blocks():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT bloco_id, numero_bloco FROM Blocos ORDER BY numero_bloco")
        blocks = cursor.fetchall()
        return jsonify(blocks), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

# --- Rota para Listar Apartamentos de um Bloco específico ---
@app.route('/api/blocks/<int:numero_bloco>/apartments', methods=['GET'])
def get_apartments_by_block(numero_bloco):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.numero_apartamento 
            FROM Apartamentos a
            JOIN Blocos b ON a.bloco_id = b.bloco_id
            WHERE b.numero_bloco = %s
            ORDER BY a.numero_apartamento
        """, (numero_bloco,))
        apartments = cursor.fetchall()
        return jsonify(apartments), 200
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
                cursor.execute("SELECT * FROM Complaints ORDER BY id DESC")
            
            elif role == 'admin_bloco':
                cursor.execute("""
                    SELECT a.bloco_id FROM Morador_Apartamentos ma
                    JOIN Apartamentos a ON ma.apartamento_id = a.apartamento_id 
                    WHERE ma.morador_id = %s LIMIT 1
                """, (user_id,))
                admin_bloco_id = cursor.fetchone()['bloco_id']

                cursor.execute("""
                    SELECT DISTINCT c.* FROM Complaints c
                    JOIN Morador_Apartamentos ma ON c.user_id = ma.morador_id
                    JOIN Apartamentos a ON ma.apartamento_id = a.apartamento_id
                    WHERE a.bloco_id = %s ORDER BY c.id DESC
                """, (admin_bloco_id,))
            
            else:
                cursor.execute("SELECT * FROM Complaints WHERE user_id = %s ORDER BY id DESC", (user_id,))
            
            return jsonify(cursor.fetchall()), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/users/<int:user_id>/role', methods=['PUT'])
def change_user_role(user_id):
    data = request.get_json()
    new_role = data.get('role')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if new_role == 'admin_bloco':
            cursor.execute("""
                SELECT a.bloco_id, b.numero_bloco 
                FROM Morador_Apartamentos ma
                JOIN Apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN Blocos b ON a.bloco_id = b.bloco_id
                WHERE ma.morador_id = %s LIMIT 1
            """, (user_id,))
            result = cursor.fetchone()
            
            if not result:
                return jsonify({'error': 'Morador não encontrado ou sem apartamento associado'}), 404
            
            bloco_id = result['bloco_id']
            num_bloco = result['numero_bloco']

            cursor.execute("""
                SELECT m.nome FROM Moradores m
                JOIN Morador_Apartamentos ma ON m.morador_id = ma.morador_id
                JOIN Apartamentos a ON ma.apartamento_id = a.apartamento_id
                WHERE a.bloco_id = %s AND m.role = 'admin_bloco' AND m.morador_id != %s
            """, (bloco_id, user_id))
            
            existing_admin = cursor.fetchone()
            if existing_admin:
                return jsonify({'error': f'O Bloco {num_bloco} já possui um síndico: {existing_admin["nome"]}.'}), 400

        cursor.execute("UPDATE Moradores SET role = %s WHERE morador_id = %s", (new_role, user_id))
        conn.commit()
        
        return jsonify({'message': 'Cargo atualizado com sucesso!'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/users', methods=['GET'])
def list_users():
    user_id = request.args.get('user_id')
    role = request.args.get('role')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if role == 'sindico':
            cursor.execute("""
                SELECT m.morador_id, m.nome, m.email, m.role, a.numero_apartamento, b.numero_bloco
                FROM Moradores m
                LEFT JOIN Morador_Apartamentos ma ON m.morador_id = ma.morador_id
                LEFT JOIN Apartamentos a ON ma.apartamento_id = a.apartamento_id
                LEFT JOIN Blocos b ON a.bloco_id = b.bloco_id
                ORDER BY b.numero_bloco, a.numero_apartamento
            """)
        elif role == 'admin_bloco':
            cursor.execute("SELECT a.bloco_id FROM Apartamentos a JOIN Morador_Apartamentos ma ON a.apartamento_id = ma.apartamento_id WHERE ma.morador_id = %s LIMIT 1", (user_id,))
            res = cursor.fetchone()
            if not res: return jsonify({'error': 'Admin sem bloco associado'}), 400
            
            bloco_id = res['bloco_id']
            cursor.execute("""
                SELECT m.morador_id, m.nome, m.email, m.role, a.numero_apartamento, b.numero_bloco
                FROM Moradores m
                JOIN Morador_Apartamentos ma ON m.morador_id = ma.morador_id
                JOIN Apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN Blocos b ON a.bloco_id = b.bloco_id
                WHERE a.bloco_id = %s
                ORDER BY a.numero_apartamento
            """, (bloco_id,))
        else:
            return jsonify({'error': 'Acesso negado'}), 403

        return jsonify(cursor.fetchall()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/complaints/<int:complaint_id>', methods=['PUT'])
def update_complaint(complaint_id):
    data = request.get_json()
    new_status = data.get('status')
    admin_comment = data.get('admin_comment')

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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)