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
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor, sslmode='require', connect_timeout=10)

# --- CADASTRO ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    nome = data.get('nome')
    email = data.get('email')
    password = generate_password_hash(data.get('password'))

    try:
        bloco_num = int(''.join(filter(str.isdigit, str(data.get('bloco')))))
        ap_num = int(''.join(filter(str.isdigit, str(data.get('apartamento')))))
    except:
        return jsonify({'error': 'Dados de bloco/apto inválidos.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verifica se e-mail já existe
        cursor.execute('SELECT morador_id FROM moradores WHERE email = %s', (email,))
        if cursor.fetchone():
            return jsonify({'error': 'E-mail já cadastrado.'}), 409

        # Busca o apartamento
        cursor.execute('''
            SELECT a.apartamento_id FROM apartamentos a
            JOIN blocos b ON a.bloco_id = b.bloco_id
            WHERE b.numero_bloco = %s AND a.numero_apartamento = %s
        ''', (bloco_num, ap_num))
        res_ap = cursor.fetchone()
        if not res_ap:
            return jsonify({'error': 'Apartamento não encontrado.'}), 400

        # Verifica se apartamento já tem morador vinculado
        cursor.execute('SELECT morador_id FROM morador_apartamentos WHERE apartamento_id = %s', (res_ap['apartamento_id'],))
        if cursor.fetchone():
            return jsonify({'error': 'Apartamento já possui morador cadastrado.'}), 409

        # BUG CORRIGIDO: aspas simples em 'morador' (aspas duplas causavam erro no PostgreSQL)
        cursor.execute(
            "INSERT INTO moradores (nome, email, password, role) VALUES (%s, %s, %s, 'morador') RETURNING morador_id",
            (nome, email, password)
        )
        m_id = cursor.fetchone()['morador_id']

        cursor.execute('INSERT INTO morador_apartamentos (morador_id, apartamento_id) VALUES (%s, %s)', (m_id, res_ap['apartamento_id']))

        conn.commit()
        return jsonify({'message': 'Cadastrado com sucesso!'}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': f'Erro: {str(e)}'}), 500
    finally:
        if conn: conn.close()


# --- LOGIN (retorna TODOS os apartamentos do morador) ---
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
            # CORRIGIDO: retorna TODOS os apartamentos (sem LIMIT 1)
            cursor.execute('''
                SELECT a.apartamento_id, a.numero_apartamento, b.numero_bloco, b.bloco_id
                FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN blocos b ON a.bloco_id = b.bloco_id
                WHERE ma.morador_id = %s
                ORDER BY b.numero_bloco, a.numero_apartamento
            ''', (user['morador_id'],))
            apartamentos = cursor.fetchall()

            return jsonify({
                'id': user['morador_id'],
                'nome': user['nome'],
                'role': user['role'],
                'apartamentos': apartamentos,                        # lista completa
                'apartamento': apartamentos[0] if apartamentos else None  # ativo inicial
            }), 200

        return jsonify({'error': 'E-mail ou senha incorretos.'}), 401
    except Exception as e:
        return jsonify({'error': f'Erro: {str(e)}'}), 500
    finally:
        if conn: conn.close()


# --- VINCULAR NOVO APARTAMENTO (para proprietários) ---
@app.route('/api/apartments/link', methods=['POST'])
def link_apartment():
    data = request.get_json()
    morador_id = data.get('morador_id')
    conn = None
    try:
        bloco_num = int(''.join(filter(str.isdigit, str(data.get('bloco')))))
        ap_num = int(''.join(filter(str.isdigit, str(data.get('apartamento')))))
    except:
        return jsonify({'error': 'Dados inválidos.'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT a.apartamento_id FROM apartamentos a
            JOIN blocos b ON a.bloco_id = b.bloco_id
            WHERE b.numero_bloco = %s AND a.numero_apartamento = %s
        ''', (bloco_num, ap_num))
        res_ap = cursor.fetchone()
        if not res_ap:
            return jsonify({'error': 'Apartamento não encontrado.'}), 404

        # Verifica se o vínculo já existe para este morador
        cursor.execute(
            'SELECT 1 FROM morador_apartamentos WHERE morador_id = %s AND apartamento_id = %s',
            (morador_id, res_ap['apartamento_id'])
        )
        if cursor.fetchone():
            return jsonify({'error': 'Você já possui vínculo com este apartamento.'}), 409

        cursor.execute(
            'INSERT INTO morador_apartamentos (morador_id, apartamento_id) VALUES (%s, %s)',
            (morador_id, res_ap['apartamento_id'])
        )
        conn.commit()

        # Retorna os dados do apartamento recém-vinculado
        cursor.execute('''
            SELECT a.apartamento_id, a.numero_apartamento, b.numero_bloco, b.bloco_id
            FROM apartamentos a JOIN blocos b ON a.bloco_id = b.bloco_id
            WHERE a.apartamento_id = %s
        ''', (res_ap['apartamento_id'],))
        return jsonify(cursor.fetchone()), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': f'Erro: {str(e)}'}), 500
    finally:
        if conn: conn.close()


# --- RECLAMAÇÕES ---
@app.route('/api/complaints', methods=['GET'])
def get_complaints():
    user_id = request.args.get('user_id')
    role = request.args.get('role')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if role == 'morador':
            cursor.execute('''
                SELECT c.*, m.nome as morador_nome
                FROM complaints c
                JOIN moradores m ON c.user_id = m.morador_id
                WHERE c.user_id = %s
                ORDER BY c.created_at DESC
            ''', (user_id,))
        else:
            cursor.execute('''
                SELECT c.*, m.nome as morador_nome
                FROM complaints c
                JOIN moradores m ON c.user_id = m.morador_id
                ORDER BY c.created_at DESC
            ''')
        return jsonify(cursor.fetchall()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/complaints', methods=['POST'])
def create_complaint():
    data = request.get_json()
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO complaints (user_id, subject, description, status)
            VALUES (%s, %s, %s, 'Pendente') RETURNING *
        ''', (data.get('user_id'), data.get('subject'), data.get('description')))
        conn.commit()
        return jsonify(cursor.fetchone()), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/complaints/<int:complaint_id>', methods=['PUT'])
def update_complaint(complaint_id):
    data = request.get_json()
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE complaints SET status = %s, admin_comment = %s
            WHERE id = %s RETURNING *
        ''', (data.get('status'), data.get('admin_comment'), complaint_id))
        conn.commit()
        return jsonify(cursor.fetchone()), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


# --- ROTAS AUXILIARES ---
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
    cursor.execute('''
        SELECT a.numero_apartamento FROM apartamentos a
        JOIN blocos b ON a.bloco_id = b.bloco_id
        WHERE b.numero_bloco = %s
        ORDER BY a.numero_apartamento
    ''', (num,))
    res = cursor.fetchall()
    conn.close()
    return jsonify(res)

@app.route('/api/db-status', methods=['GET'])
def db_status():
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({'status': 'online'}), 200
    except:
        return jsonify({'status': 'offline'}), 500


# --- LISTA DE USUÁRIOS (gestão admin) ---
@app.route('/api/users', methods=['GET'])
def list_users():
    user_id = request.args.get('user_id')
    role = request.args.get('role')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query_base = '''
            SELECT m.morador_id, m.nome, m.email, m.role,
                   a.numero_apartamento, b.numero_bloco
            FROM moradores m
            LEFT JOIN morador_apartamentos ma ON m.morador_id = ma.morador_id
            LEFT JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
            LEFT JOIN blocos b ON a.bloco_id = b.bloco_id
        '''
        if role == 'sindico':
            cursor.execute(query_base + ' ORDER BY b.numero_bloco, a.numero_apartamento')
        elif role == 'admin_bloco':
            cursor.execute('''
                SELECT a.bloco_id FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                WHERE ma.morador_id = %s LIMIT 1
            ''', (user_id,))
            res = cursor.fetchone()
            if not res: return jsonify({'error': 'Admin sem bloco'}), 400
            cursor.execute(query_base + ' WHERE a.bloco_id = %s ORDER BY a.numero_apartamento', (res['bloco_id'],))
        else:
            return jsonify({'error': 'Acesso negado'}), 403
        return jsonify(cursor.fetchall()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)