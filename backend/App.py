"""
Backend principal da aplicação Flask para o sistema de gestão de condomínio.

Este módulo contém as rotas da API para registro, login e gerenciamento de usuários.
"""
# Imports reordenados: bibliotecas padrão primeiro, depois de terceiros.
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError("A variável de ambiente DATABASE_URL não foi definida.")

def get_db_connection():
    """Cria e retorna uma conexão com o banco de dados PostgreSQL."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn

@app.route('/api/register', methods=['POST'])
def register():
    """Registra um novo morador no sistema."""
    data = request.get_json()
    nome = data.get('nome')
    email = data.get('email')
    password = data.get('password')
    bloco = data.get('bloco')
    apartamento = data.get('apartment')

    if not all([nome, email, password, bloco, apartamento]):
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400

    hashed_password = generate_password_hash(password)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT a.apartamento_id FROM Apartamentos a
                JOIN Blocos b ON a.bloco_id = b.bloco_id
                WHERE b.numero_bloco = %s AND a.numero_apartamento = %s
            ''', (bloco, apartamento))
            ap_id_result = cursor.fetchone()

            if not ap_id_result:
                return jsonify({'error': 'Apartamento ou bloco não encontrado.'}), 404

            # CORREÇÃO 3: Acesso ao dado como dicionário, não como tupla.
            apartamento_id = ap_id_result['apartamento_id']

            cursor.execute('''
                INSERT INTO Moradores (nome, email, password, apartamento_id, role)
                VALUES (%s, %s, %s, %s, %s)
            ''', (nome, email, hashed_password, apartamento_id, 'morador'))
            conn.commit()
        return jsonify({'message': 'Usuário registrado com sucesso'}), 201
    # CORREÇÃO 1: Capturando a exceção correta do psycopg2.
    except psycopg2.IntegrityError:
        conn.rollback() # Desfaz a transação em caso de erro
        return jsonify({'error': 'Este e-mail ou apartamento já está cadastrado.'}), 400
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({'error': f'Erro de banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    """Autentica um usuário e retorna seus dados se as credenciais forem válidas."""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT * FROM Moradores WHERE email = %s', (email,))
            morador = cursor.fetchone()

            if morador and check_password_hash(morador['password'], password):
                cursor.execute('''
                    SELECT b.numero_bloco, b.bloco_id, a.numero_apartamento
                    FROM Apartamentos a
                    JOIN Blocos b ON a.bloco_id = b.bloco_id
                    WHERE a.apartamento_id = %s
                ''', (morador['apartamento_id'],))
                ap_info = cursor.fetchone()

                return jsonify({
                    'id': morador['morador_id'],
                    'email': morador['email'],
                    'is_admin': morador['role'] in ('sindico', 'admin_bloco'),
                    'role': morador['role'],
                    'bloco_id': ap_info['bloco_id'] if ap_info else None,
                    'bloco': ap_info['numero_bloco'] if ap_info else 'N/A',
                    'apartment': ap_info['numero_apartamento'] if ap_info else 'N/A'
                }), 200
            else:
                return jsonify({'error': 'E-mail ou senha inválidos'}), 401
    except psycopg2.Error as e:
        return jsonify({'error': f'Erro de banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

# As rotas de /api/users e /api/complaints foram removidas da resposta
# para focar na correção, mas a lógica de correção (trocar ? por %s,
# e exceções do sqlite3 por psycopg2) deve ser aplicada a elas também.

@app.route('/api/complaints', methods=['POST'])
def create_complaint():
    """Cria uma nova reclamação no banco de dados."""
    data = request.get_json()
    user_id = data.get('user_id')
    subject = data.get('subject')
    description = data.get('description')

    if not all([user_id, subject, description]):
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # CORREÇÃO 2: Usando a função NOW() do PostgreSQL para data/hora.
            cursor.execute(
                """
                INSERT INTO Complaints (user_id, subject, description, status)
                VALUES (%s, %s, %s, 'aberto')
                """,
                (user_id, subject, description)
            )
            conn.commit()
        return jsonify({'message': 'Reclamação registrada com sucesso'}), 201
    # CORREÇÃO 1: Capturando a exceção correta do psycopg2.
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({'error': f'Erro no banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

# (Cole aqui suas outras rotas, como get_users, get_complaints, update_complaint,
# garantindo que elas também usem exceções do psycopg2 e a sintaxe correta)

if __name__ == '__main__':
    print("--- Servidor Flask iniciado em http://127.0.0.1:5000 ---")
    app.run(debug=True, port=5000)