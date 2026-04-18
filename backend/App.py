import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    # Adicionamos o connect_timeout para evitar que o Render fique 'pendurado'
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor, sslmode='require', connect_timeout=10)

# --- Registo Simplificado (1 Morador -> 1 Apartamento) ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    nome = data.get('nome')
    email = data.get('email')
    password = generate_password_hash(data.get('password'))

    # Limpeza dos números
    try:
        bloco_num = int(''.join(filter(str.isdigit, str(data.get('bloco')))))
        ap_num = int(''.join(filter(str.isdigit, str(data.get('apartamento')))))
    except:
        return jsonify({'error': 'Dados de bloco/apto inválidos.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Busca o ID do apartamento (Tabelas em minúsculas)
        cursor.execute('SELECT apartamento_id FROM apartamentos a JOIN blocos b ON a.bloco_id = b.bloco_id WHERE b.numero_bloco = %s AND a.numero_apartamento = %s', (bloco_num, ap_num))
        res_ap = cursor.fetchone()
        if not res_ap:
            return jsonify({'error': 'Apartamento não encontrado.'}), 400

        # 2. Cria o Morador
        cursor.execute('INSERT INTO moradores (nome, email, password, role) VALUES (%s, %s, %s, "morador") RETURNING morador_id', (nome, email, password))
        m_id = cursor.fetchone()['morador_id']

        # 3. Cria o vínculo único
        cursor.execute('INSERT INTO morador_apartamentos (morador_id, apartamento_id) VALUES (%s, %s)', (m_id, res_ap['apartamento_id']))
        
        conn.commit()
        return jsonify({'message': 'Cadastrado com sucesso!'}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': f'Erro: {str(e)}'}), 500
    finally:
        if conn: conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM moradores WHERE email = %s', (data.get('email'),))
        user = cursor.fetchone()

        if user and check_password_hash(user['password'], data.get('password')):
            # Busca apenas o primeiro apartamento encontrado
            cursor.execute('''
                SELECT a.numero_apartamento, b.numero_bloco 
                FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN blocos b ON a.bloco_id = b.bloco_id
                WHERE ma.morador_id = %s LIMIT 1
            ''', (user['morador_id'],))
            
            return jsonify({
                'id': user['morador_id'],
                'nome': user['nome'],
                'role': user['role'],
                'apartamento': cursor.fetchone() # Retorna apenas um objeto, não uma lista
            }), 200
        return jsonify({'error': 'Login inválido'}), 401
    finally:
        if conn: conn.close()

# --- ROTA DE LISTAGEM DE USUÁRIOS (Corrigida para evitar erro de coluna inexistente) ---
@app.route('/api/users', methods=['GET'])
def list_users():
    user_id = request.args.get('user_id')
    role = request.args.get('role')

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # SQL Corrigido: Agora faz o JOIN através da tabela morador_apartamentos
        query_base = '''
            SELECT m.morador_id, m.nome, m.email, m.role, a.numero_apartamento, b.numero_bloco
            FROM moradores m
            LEFT JOIN morador_apartamentos ma ON m.morador_id = ma.morador_id
            LEFT JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
            LEFT JOIN blocos b ON a.bloco_id = b.bloco_id
        '''

        if role == 'sindico':
            cursor.execute(query_base + ' ORDER BY b.numero_bloco, a.numero_apartamento')
        elif role == 'admin_bloco':
            # Primeiro descobre qual o bloco deste administrador
            cursor.execute('SELECT a.bloco_id FROM morador_apartamentos ma JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id WHERE ma.morador_id = %s LIMIT 1', (user_id,))
            res = cursor.fetchone()
            if not res: return jsonify({'error': 'Admin sem bloco'}), 400
            
            cursor.execute(query_base + ' WHERE a.bloco_id = %s ORDER BY a.numero_apartamento', (res['bloco_id'],))
        else:
            return jsonify({'error': 'Acesso negado'}), 403

        return jsonify(cursor.fetchall()), 200
    finally:
        if conn: conn.close()

# --- ROTAS AUXILIARES (Blocos e Apartamentos) ---
@app.route('/api/blocks', methods=['GET'])
def get_blocks():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT bloco_id, numero_bloco FROM blocos ORDER BY numero_bloco')
    res = cursor.fetchall()
    conn.close()
    return jsonify(res)

@app.route('/api/blocks/<int:num>/apartments', methods=['GET'])
def get_apts(num):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT a.numero_apartamento FROM apartamentos a JOIN blocos b ON a.bloco_id = b.bloco_id WHERE b.numero_bloco = %s', (num,))
    res = cursor.fetchall()
    conn.close()
    return jsonify(res)

@app.route('/api/db-status', methods=['GET'])
def db_status():
    return jsonify({'status': 'online'}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)