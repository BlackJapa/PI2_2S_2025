"""
Backend principal da aplicação Flask para o sistema de gestão de condomínio.

Este módulo contém as rotas da API para registro, login e gerenciamento de usuários.
"""
# Imports reordenados: bibliotecas padrão primeiro, depois de terceiros.
import sqlite3
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
DATABASE = 'condominio.db'

def get_db_connection():
    """Cria e retorna uma conexão com o banco de dados."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
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
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT a.apartamento_id FROM Apartamentos a
            JOIN Blocos b ON a.bloco_id = b.bloco_id
            WHERE b.numero_bloco = ? AND a.numero_apartamento = ?
        ''', (bloco, apartamento))
        ap_id_result = cursor.fetchone()

        if not ap_id_result:
            return jsonify({'error': 'Apartamento ou bloco não encontrado.'}), 404

        apartamento_id = ap_id_result[0]

        cursor.execute('''
            INSERT INTO Moradores (nome, email, password, apartamento_id, role)
            VALUES (?, ?, ?, ?, ?)
        ''', (nome, email, hashed_password, apartamento_id, 'morador'))

        conn.commit()
        return jsonify({'message': 'Usuário registrado com sucesso'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Este e-mail ou apartamento já está cadastrado.'}), 400
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    """Autentica um usuário e retorna seus dados se as credenciais forem válidas."""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT * FROM Moradores WHERE email = ?', (email,))
        morador = cursor.fetchone()

        if morador and check_password_hash(morador['password'], password):
            cursor.execute('''
                SELECT b.numero_bloco, b.bloco_id, a.numero_apartamento
                FROM Apartamentos a
                JOIN Blocos b ON a.bloco_id = b.bloco_id
                WHERE a.apartamento_id = ?
            ''', (morador['apartamento_id'],))
            ap_info = cursor.fetchone()

            # Resposta de login atualizada para o frontend
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
    finally:
        conn.close()


@app.route('/api/users', methods=['GET'])
def get_users():
    """Busca e retorna uma lista de usuários com base nas permissões do requisitante."""
    # --- SIMULAÇÃO DE AUTENTICAÇÃO ---
    # Em um app real, você pegaria o usuário de um token JWT ou sessão
    user_id = request.args.get('user_id', type=int)
    conn = get_db_connection()
    current_user = conn.execute(
        'SELECT * FROM Moradores WHERE morador_id = ?', (user_id,)
    ).fetchone()

    if not current_user:
        return jsonify({'error': 'Usuário não autenticado'}), 401
    # --- FIM DA SIMULAÇÃO ---

    if current_user['role'] == 'morador':
        return jsonify({'error': 'Acesso negado'}), 403

    user_bloco_id = conn.execute("""
        SELECT a.bloco_id FROM Apartamentos a WHERE a.apartamento_id = ?
    """, (current_user['apartamento_id'],)).fetchone()['bloco_id']

    # Quebra da linha longa para melhor legibilidade
    query = """
        SELECT m.morador_id as id, m.nome, m.email, m.role, b.numero_bloco as bloco,
               a.numero_apartamento as apartment, m.role
        FROM Moradores m
        JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
        JOIN Blocos b ON a.bloco_id = b.bloco_id
    """

    params = []
    if current_user['role'] == 'admin_bloco':
        query += " WHERE b.bloco_id = ?"
        params.append(user_bloco_id)

    users = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(row) for row in users])

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
        # A data é gerada no backend para garantir consistência
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO Complaints (user_id, subject, description, date, status)
            VALUES (?, ?, ?, datetime('now', 'localtime'), 'aberto')
            """,
            (user_id, subject, description)
        )
        conn.commit()
        return jsonify({'message': 'Reclamação registrada com sucesso'}), 201
    except sqlite3.Error as e:
        return jsonify({'error': f'Erro no banco de dados: {e}'}), 500
    finally:
        conn.close()


@app.route('/api/complaints', methods=['GET'])
def get_complaints():
    """Busca e retorna uma lista de reclamações com base nas permissões do usuário."""
    # --- SIMULAÇÃO DE AUTENTICAÇÃO ---
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'error': 'ID de usuário é obrigatório'}), 400

    conn = get_db_connection()
    current_user = conn.execute('SELECT * FROM Moradores WHERE morador_id = ?', (user_id,)).fetchone()

    if not current_user:
        return jsonify({'error': 'Usuário não autenticado'}), 401
    # --- FIM DA SIMULAÇÃO ---

    user_bloco_id = conn.execute("""
        SELECT a.bloco_id FROM Apartamentos a WHERE a.apartamento_id = ?
    """, (current_user['apartamento_id'],)).fetchone()['bloco_id']

    query = """
        SELECT c.id, c.subject, c.description, c.date, c.status, c.admin_comment,
               m.nome as user_name, -- <<< ADICIONADO AQUI
               m.email as user_email,
               b.numero_bloco as user_bloco,
               a.numero_apartamento as user_apartment
        FROM Complaints c
        JOIN Moradores m ON c.user_id = m.morador_id
        JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
        JOIN Blocos b ON a.bloco_id = b.bloco_id
    """
    params = []

    if current_user['role'] == 'morador':
        # Morador comum vê apenas as suas próprias reclamações
        query += " WHERE c.user_id = ?"
        params.append(user_id)
    elif current_user['role'] == 'admin_bloco':
        # Admin de bloco vê todas as reclamações do seu bloco
        query += " WHERE b.bloco_id = ?"
        params.append(user_bloco_id)
    # Se for 'sindico', não adicionamos filtro, então ele vê todas

    query += " ORDER BY c.date DESC" # Ordena da mais recente para a mais antiga

    complaints = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(row) for row in complaints])
@app.route('/api/complaints/<int:complaint_id>', methods=['PUT'])
def update_complaint(complaint_id):
    """Atualiza o status e/ou comentário de uma reclamação."""
    # --- SIMULAÇÃO DE AUTENTICAÇÃO ---
    # Em um app real, o ID viria de um token/sessão, não de um parâmetro
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'error': 'ID de usuário é obrigatório'}), 400

    conn = get_db_connection()
    current_user = conn.execute('SELECT * FROM Moradores WHERE morador_id = ?', (user_id,)).fetchone()

    if not current_user or current_user['role'] not in ('admin_bloco', 'sindico'):
        conn.close()
        return jsonify({'error': 'Acesso negado. Apenas administradores podem editar.'}), 403
    # --- FIM DA SIMULAÇÃO ---

    data = request.get_json()
    new_status = data.get('status')
    admin_comment = data.get('admin_comment')

    if not new_status:
        return jsonify({'error': 'O campo status é obrigatório.'}), 400

    try:
        # Lógica de segurança adicional para admin_bloco (opcional, mas recomendado)
        if current_user['role'] == 'admin_bloco':
            user_bloco_id = conn.execute("""
                SELECT a.bloco_id FROM Apartamentos a WHERE a.apartamento_id = ?
            """, (current_user['apartamento_id'],)).fetchone()['bloco_id']
            
            complaint_bloco_id = conn.execute("""
                SELECT b.bloco_id FROM Complaints c
                JOIN Moradores m ON c.user_id = m.morador_id
                JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
                JOIN Blocos b ON a.bloco_id = b.bloco_id
                WHERE c.id = ?
            """, (complaint_id,)).fetchone()['bloco_id']

            if user_bloco_id != complaint_bloco_id:
                return jsonify({'error': 'Você só pode editar reclamações do seu bloco.'}), 403

        # Se passou na verificação, atualiza o banco
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE Complaints SET status = ?, admin_comment = ? WHERE id = ?",
            (new_status, admin_comment, complaint_id)
        )
        conn.commit()
        return jsonify({'message': 'Reclamação atualizada com sucesso.'}), 200

    except sqlite3.Error as e:
        return jsonify({'error': f'Erro no banco de dados: {e}'}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    print("--- Servidor Flask iniciado em http://127.0.0.1:5000 ---")
    app.run(debug=True, port=5000)