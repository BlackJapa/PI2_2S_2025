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

        cursor.execute('SELECT morador_id FROM moradores WHERE email = %s', (email,))
        if cursor.fetchone():
            return jsonify({'error': 'E-mail já cadastrado.'}), 409

        cursor.execute('''
            SELECT a.apartamento_id FROM apartamentos a
            JOIN blocos b ON a.bloco_id = b.bloco_id
            WHERE b.numero_bloco = %s AND a.numero_apartamento = %s
        ''', (bloco_num, ap_num))
        res_ap = cursor.fetchone()
        if not res_ap:
            return jsonify({'error': 'Apartamento não encontrado.'}), 400

        cursor.execute('SELECT morador_id FROM morador_apartamentos WHERE apartamento_id = %s', (res_ap['apartamento_id'],))
        if cursor.fetchone():
            return jsonify({'error': 'Apartamento já possui morador cadastrado.'}), 409

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


# --- LOGIN ---
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
                'apartamentos': apartamentos,
                'apartamento': apartamentos[0] if apartamentos else None
            }), 200

        return jsonify({'error': 'E-mail ou senha incorretos.'}), 401
    except Exception as e:
        return jsonify({'error': f'Erro: {str(e)}'}), 500
    finally:
        if conn: conn.close()


# --- ALTERAR SENHA ---
@app.route('/api/moradores/<int:morador_id>/senha', methods=['PUT'])
def change_password(morador_id):
    data = request.get_json()
    senha_atual = data.get('senha_atual')
    nova_senha = data.get('nova_senha')

    if not senha_atual or not nova_senha:
        return jsonify({'error': 'Campos obrigatórios ausentes.'}), 400
    if len(nova_senha) < 6:
        return jsonify({'error': 'A nova senha deve ter pelo menos 6 caracteres.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT password FROM moradores WHERE morador_id = %s', (morador_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'Usuário não encontrado.'}), 404
        if not check_password_hash(user['password'], senha_atual):
            return jsonify({'error': 'Senha atual incorreta.'}), 401

        cursor.execute(
            'UPDATE moradores SET password = %s WHERE morador_id = %s',
            (generate_password_hash(nova_senha), morador_id)
        )
        conn.commit()
        return jsonify({'message': 'Senha alterada com sucesso!'}), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


# --- ALTERAR CARGO (apenas síndico geral) ---
@app.route('/api/moradores/<int:morador_id>/role', methods=['PUT'])
def change_role(morador_id):
    data = request.get_json()
    requester_role = data.get('requester_role')
    requester_id = data.get('requester_id')
    new_role = data.get('new_role')

    if requester_role != 'sindico':
        return jsonify({'error': 'Apenas o Síndico Geral pode alterar cargos.'}), 403

    allowed_roles = ('morador', 'admin_bloco', 'sindico')
    if new_role not in allowed_roles:
        return jsonify({'error': 'Cargo inválido.'}), 400

    if str(morador_id) == str(requester_id):
        return jsonify({'error': 'Você não pode alterar o seu próprio cargo.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT morador_id, role FROM moradores WHERE morador_id = %s', (morador_id,))
        target = cursor.fetchone()
        if not target:
            return jsonify({'error': 'Morador não encontrado.'}), 404

        # Regra: só 1 admin_bloco por bloco
        if new_role == 'admin_bloco':
            # Descobre o bloco do morador-alvo
            cursor.execute('''
                SELECT b.bloco_id, b.numero_bloco FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN blocos b ON a.bloco_id = b.bloco_id
                WHERE ma.morador_id = %s LIMIT 1
            ''', (morador_id,))
            bloco_target = cursor.fetchone()

            if not bloco_target:
                return jsonify({'error': 'Este morador não possui apartamento vinculado.'}), 400

            # Verifica se o bloco já tem um admin_bloco diferente
            cursor.execute('''
                SELECT m.morador_id, m.nome FROM moradores m
                JOIN morador_apartamentos ma ON m.morador_id = ma.morador_id
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                WHERE a.bloco_id = %s AND m.role = 'admin_bloco' AND m.morador_id != %s
                LIMIT 1
            ''', (bloco_target['bloco_id'], morador_id))
            existing_admin = cursor.fetchone()

            if existing_admin:
                return jsonify({
                    'error': f"O Bloco {bloco_target['numero_bloco']} já possui um Síndico de Bloco ({existing_admin['nome']}). Remova o cargo dele antes de atribuir a outro morador."
                }), 409

        cursor.execute('UPDATE moradores SET role = %s WHERE morador_id = %s', (new_role, morador_id))
        conn.commit()
        return jsonify({'message': f'Cargo atualizado para "{new_role}" com sucesso.'}), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


# --- EXCLUIR MORADOR ---
@app.route('/api/moradores/<int:morador_id>', methods=['DELETE'])
def delete_morador(morador_id):
    requester_id = request.args.get('requester_id')
    requester_role = request.args.get('role')

    if requester_role not in ('sindico', 'admin_bloco'):
        return jsonify({'error': 'Acesso negado.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if str(morador_id) == str(requester_id):
            return jsonify({'error': 'Você não pode excluir a sua própria conta por aqui.'}), 400

        if requester_role == 'admin_bloco':
            cursor.execute('''
                SELECT b.bloco_id FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN blocos b ON a.bloco_id = b.bloco_id
                WHERE ma.morador_id = %s LIMIT 1
            ''', (requester_id,))
            admin_bloco = cursor.fetchone()

            cursor.execute('''
                SELECT b.bloco_id FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                JOIN blocos b ON a.bloco_id = b.bloco_id
                WHERE ma.morador_id = %s LIMIT 1
            ''', (morador_id,))
            target_bloco = cursor.fetchone()

            if not admin_bloco or not target_bloco or admin_bloco['bloco_id'] != target_bloco['bloco_id']:
                return jsonify({'error': 'Você só pode excluir moradores do seu bloco.'}), 403

        cursor.execute('DELETE FROM moradores WHERE morador_id = %s', (morador_id,))
        conn.commit()
        return jsonify({'message': 'Morador excluído com sucesso.'}), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


# --- SOLICITAÇÕES DE VÍNCULO ---
@app.route('/api/apartments/request', methods=['POST'])
def request_apartment():
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

        apt_id = res_ap['apartamento_id']

        cursor.execute('SELECT 1 FROM morador_apartamentos WHERE morador_id = %s AND apartamento_id = %s', (morador_id, apt_id))
        if cursor.fetchone():
            return jsonify({'error': 'Você já possui vínculo com este apartamento.'}), 409

        cursor.execute('''
            SELECT 1 FROM apartment_requests
            WHERE morador_id = %s AND apartamento_id = %s AND status = 'Pendente'
        ''', (morador_id, apt_id))
        if cursor.fetchone():
            return jsonify({'error': 'Já existe uma solicitação pendente para este apartamento.'}), 409

        cursor.execute(
            "INSERT INTO apartment_requests (morador_id, apartamento_id, status) VALUES (%s, %s, 'Pendente') RETURNING request_id",
            (morador_id, apt_id)
        )
        conn.commit()
        return jsonify({'message': 'Solicitação enviada! Aguarde aprovação do síndico.'}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


@app.route('/api/apartments/requests/me', methods=['GET'])
def get_my_requests():
    morador_id = request.args.get('morador_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.request_id, r.status, r.created_at,
                   a.numero_apartamento, b.numero_bloco
            FROM apartment_requests r
            JOIN apartamentos a ON r.apartamento_id = a.apartamento_id
            JOIN blocos b ON a.bloco_id = b.bloco_id
            WHERE r.morador_id = %s
            ORDER BY r.created_at DESC
        ''', (morador_id,))
        return jsonify(cursor.fetchall()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


@app.route('/api/apartments/requests', methods=['GET'])
def get_requests():
    requester_id = request.args.get('user_id')
    role = request.args.get('role')

    if role not in ('sindico', 'admin_bloco'):
        return jsonify({'error': 'Acesso negado.'}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = '''
            SELECT r.request_id, r.status, r.created_at,
                   m.nome as morador_nome, m.email as morador_email,
                   a.numero_apartamento, b.numero_bloco
            FROM apartment_requests r
            JOIN moradores m ON r.morador_id = m.morador_id
            JOIN apartamentos a ON r.apartamento_id = a.apartamento_id
            JOIN blocos b ON a.bloco_id = b.bloco_id
            WHERE r.status = 'Pendente'
        '''

        if role == 'sindico':
            cursor.execute(query + ' ORDER BY r.created_at DESC')
        else:
            cursor.execute('''
                SELECT a.bloco_id FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                WHERE ma.morador_id = %s LIMIT 1
            ''', (requester_id,))
            res = cursor.fetchone()
            if not res:
                return jsonify([]), 200
            cursor.execute(query + ' AND b.bloco_id = %s ORDER BY r.created_at DESC', (res['bloco_id'],))

        return jsonify(cursor.fetchall()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


@app.route('/api/apartments/requests/<int:request_id>', methods=['PUT'])
def handle_request(request_id):
    data = request.get_json()
    action = data.get('action')
    requester_role = data.get('role')

    if requester_role not in ('sindico', 'admin_bloco'):
        return jsonify({'error': 'Acesso negado.'}), 403
    if action not in ('Aprovado', 'Negado'):
        return jsonify({'error': 'Ação inválida.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM apartment_requests WHERE request_id = %s', (request_id,))
        req = cursor.fetchone()
        if not req:
            return jsonify({'error': 'Solicitação não encontrada.'}), 404

        cursor.execute('UPDATE apartment_requests SET status = %s WHERE request_id = %s', (action, request_id))

        if action == 'Aprovado':
            cursor.execute(
                'SELECT 1 FROM morador_apartamentos WHERE morador_id = %s AND apartamento_id = %s',
                (req['morador_id'], req['apartamento_id'])
            )
            if not cursor.fetchone():
                cursor.execute(
                    'INSERT INTO morador_apartamentos (morador_id, apartamento_id) VALUES (%s, %s)',
                    (req['morador_id'], req['apartamento_id'])
                )

        conn.commit()
        return jsonify({'message': f'Solicitação {action.lower()} com sucesso.'}), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()


# --- RECLAMAÇÕES ---
# FIX: POST agora salva o apartamento_id ativo do morador.
# FIX: GET usa DISTINCT ON para evitar duplicatas quando morador tem múltiplos aptos.
@app.route('/api/complaints', methods=['GET', 'POST'])
def manage_complaints():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if request.method == 'POST':
            data = request.get_json()
            # apartamento_id é enviado pelo frontend (apartamento ativo no momento)
            cursor.execute('''
                INSERT INTO complaints (user_id, apartamento_id, subject, description, status)
                VALUES (%s, %s, %s, %s, 'Pendente') RETURNING *
            ''', (data.get('user_id'), data.get('apartamento_id'), data.get('subject'), data.get('description')))
            conn.commit()
            return jsonify(cursor.fetchone()), 201

        user_id = request.args.get('user_id')
        role = request.args.get('role')

        # FIX: JOIN direto pelo apartamento_id da reclamação + DISTINCT ON para eliminar duplicatas
        # Para reclamações antigas (apartamento_id NULL), faz fallback via morador_apartamentos
        query_admin = '''
            SELECT DISTINCT ON (c.id)
                c.*,
                m.nome as morador_nome,
                COALESCE(a_direct.numero_apartamento, a_fallback.numero_apartamento) as numero_apartamento,
                COALESCE(b_direct.numero_bloco,       b_fallback.numero_bloco)       as numero_bloco,
                COALESCE(b_direct.bloco_id,           b_fallback.bloco_id)           as bloco_id
            FROM complaints c
            JOIN moradores m ON c.user_id = m.morador_id
            LEFT JOIN apartamentos  a_direct   ON c.apartamento_id = a_direct.apartamento_id
            LEFT JOIN blocos        b_direct   ON a_direct.bloco_id = b_direct.bloco_id
            LEFT JOIN morador_apartamentos ma  ON m.morador_id = ma.morador_id
            LEFT JOIN apartamentos  a_fallback ON ma.apartamento_id = a_fallback.apartamento_id
            LEFT JOIN blocos        b_fallback ON a_fallback.bloco_id = b_fallback.bloco_id
        '''

        if role == 'sindico':
            cursor.execute(query_admin + ' ORDER BY c.id DESC')

        elif role == 'admin_bloco':
            cursor.execute('''
                SELECT a.bloco_id FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                WHERE ma.morador_id = %s LIMIT 1
            ''', (user_id,))
            res = cursor.fetchone()
            if not res:
                return jsonify([]), 200
            # Filtra pelo bloco da reclamação (direto ou fallback)
            cursor.execute(query_admin + '''
                ORDER BY c.id DESC
            ''')
            # Filtra em Python para garantir compatibilidade com NULL
            all_rows = cursor.fetchall()
            return jsonify([r for r in all_rows if r.get('bloco_id') == res['bloco_id']]), 200

        else:
            # Morador: só as próprias reclamações, sem duplicata
            cursor.execute('''
                SELECT DISTINCT ON (c.id) c.*
                FROM complaints c
                WHERE c.user_id = %s
                ORDER BY c.id DESC
            ''', (user_id,))

        return jsonify(cursor.fetchall()), 200
    except Exception as e:
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
        WHERE b.numero_bloco = %s ORDER BY a.numero_apartamento
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


# --- LISTA DE USUÁRIOS ---
# FIX: DISTINCT ON para evitar duplicatas de moradores com múltiplos aptos
@app.route('/api/users', methods=['GET'])
def list_users():
    user_id = request.args.get('user_id')
    role = request.args.get('role')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # DISTINCT ON (m.morador_id) — pega apenas 1 linha por morador
        query_base = '''
            SELECT DISTINCT ON (m.morador_id)
                   m.morador_id, m.nome, m.email, m.role,
                   a.numero_apartamento, b.numero_bloco, b.bloco_id
            FROM moradores m
            LEFT JOIN morador_apartamentos ma ON m.morador_id = ma.morador_id
            LEFT JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
            LEFT JOIN blocos b ON a.bloco_id = b.bloco_id
        '''
        if role == 'sindico':
            cursor.execute(query_base + ' ORDER BY m.morador_id, b.numero_bloco, a.numero_apartamento')
        elif role == 'admin_bloco':
            cursor.execute('''
                SELECT a.bloco_id FROM morador_apartamentos ma
                JOIN apartamentos a ON ma.apartamento_id = a.apartamento_id
                WHERE ma.morador_id = %s LIMIT 1
            ''', (user_id,))
            res = cursor.fetchone()
            if not res:
                return jsonify({'error': 'Admin sem bloco'}), 400
            cursor.execute(
                query_base + ' WHERE a.bloco_id = %s ORDER BY m.morador_id, a.numero_apartamento',
                (res['bloco_id'],)
            )
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