"""
Backend principal da aplicação Flask para o sistema de gestão de condomínio.

Este módulo contém as rotas da API para registro, login e gerenciamento de
usuários e reclamações, conectado a um banco de dados PostgreSQL.
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)
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

            apartamento_id = ap_id_result['apartamento_id']

            cursor.execute('''
                INSERT INTO Moradores (nome, email, password, apartamento_id, role)
                VALUES (%s, %s, %s, %s, %s)
            ''', (nome, email, hashed_password, apartamento_id, 'morador'))
            conn.commit()
        return jsonify({'message': 'Usuário registrado com sucesso'}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({'error': 'Este e-mail ou apartamento já está cadastrado.'}), 400
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({'error': f'Erro de banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/blocks', methods=['GET'])
def get_blocks():
    """Retorna uma lista de todos os blocos cadastrados."""
    # (Opcional: Adicionar verificação se o usuário está logado, se necessário)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Seleciona ID e número, ordenando pelo número
            cursor.execute("SELECT bloco_id, numero_bloco FROM Blocos ORDER BY numero_bloco")
            blocos = cursor.fetchall()
        # Retorna a lista de dicionários [{bloco_id: 1, numero_bloco: 0}, ...]
        return jsonify(blocos)
    except psycopg2.Error as e:
        return jsonify({'error': f'Erro ao buscar blocos: {e}'}), 500
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
                    'nome': morador['nome'],
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

@app.route('/api/users', methods=['GET'])
def get_users():
    """Busca e retorna uma lista de usuários com base nas permissões e filtro de bloco."""
    requesting_user_id = request.args.get('user_id', type=int)
    # NOVO: Pega o filtro de bloco dos parâmetros da URL, se existir
    selected_bloco_id = request.args.get('bloco_id_filter', type=int, default=None)

    if not requesting_user_id:
        return jsonify({'error': 'ID de usuário requisitante é obrigatório'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT role, apartamento_id FROM Moradores WHERE morador_id = %s', (requesting_user_id,))
            requesting_user = cursor.fetchone()

            if not requesting_user:
                return jsonify({'error': 'Usuário requisitante não autenticado'}), 401

            query = """
                SELECT m.morador_id as id, m.nome, m.email, m.role, b.numero_bloco as bloco,
                       a.numero_apartamento as apartment
                FROM Moradores m
                JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
                JOIN Blocos b ON a.bloco_id = b.bloco_id
            """
            params = []
            where_clauses = [] # Lista para adicionar condições WHERE

            # Lógica de Filtro:
            if requesting_user['role'] == 'sindico':
                # Se SINDICO e um filtro foi selecionado, adiciona o filtro
                if selected_bloco_id is not None:
                    where_clauses.append("b.bloco_id = %s")
                    params.append(selected_bloco_id)
                # Se SINDICO e NENHUM filtro foi selecionado, não adiciona cláusula (vê todos)
            elif requesting_user['role'] == 'admin_bloco':
                # Se ADMIN_BLOCO, filtra SEMPRE pelo seu próprio bloco
                cursor.execute("SELECT a.bloco_id FROM Apartamentos a WHERE a.apartamento_id = %s", (requesting_user['apartamento_id'],))
                user_bloco_id = cursor.fetchone()['bloco_id']
                where_clauses.append("b.bloco_id = %s")
                params.append(user_bloco_id)
            else: # Morador comum
                 return jsonify({'error': 'Acesso negado'}), 403

            # Monta a query final com as cláusulas WHERE, se houver
            if where_clauses:
                query += " WHERE " + " AND ".join(where_clauses)

            query += " ORDER BY b.numero_bloco, a.numero_apartamento"

            cursor.execute(query, params)
            users = cursor.fetchall()
        return jsonify(users)
    except psycopg2.Error as e:
        return jsonify({'error': f'Erro de banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

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
            # CORREÇÃO: Omitindo 'date' para usar o DEFAULT do PostgreSQL
            cursor.execute(
                """
                INSERT INTO Complaints (user_id, subject, description, status)
                VALUES (%s, %s, %s, 'aberto')
                """,
                (user_id, subject, description)
            )
            conn.commit()
        return jsonify({'message': 'Reclamação registrada com sucesso'}), 201
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({'error': f'Erro no banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/complaints', methods=['GET'])
def get_complaints():
    """Busca e retorna uma lista de reclamações com base nas permissões do usuário."""
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'error': 'ID de usuário é obrigatório'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT * FROM Moradores WHERE morador_id = %s', (user_id,))
            current_user = cursor.fetchone()

            if not current_user:
                return jsonify({'error': 'Usuário não autenticado'}), 401

            cursor.execute("SELECT a.bloco_id FROM Apartamentos a WHERE a.apartamento_id = %s", (current_user['apartamento_id'],))
            user_bloco_id = cursor.fetchone()['bloco_id']

            query = """
                SELECT c.id, c.subject, c.description, c.date, c.status, c.admin_comment,
                       m.nome as user_name, m.email as user_email,
                       b.numero_bloco as user_bloco, a.numero_apartamento as user_apartment
                FROM Complaints c
                JOIN Moradores m ON c.user_id = m.morador_id
                JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
                JOIN Blocos b ON a.bloco_id = b.bloco_id
            """
            params = []
            
            if current_user['role'] == 'morador':
                query += " WHERE c.user_id = %s"
                params.append(user_id)
            elif current_user['role'] == 'admin_bloco':
                query += " WHERE b.bloco_id = %s"
                params.append(user_bloco_id)
            
            query += " ORDER BY c.date DESC"
            
            cursor.execute(query, params)
            complaints = cursor.fetchall()
        return jsonify(complaints)
    except psycopg2.Error as e:
        return jsonify({'error': f'Erro de banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/users/<int:target_user_id>/role', methods=['PUT'])
def update_user_role(target_user_id):
    """Atualiza a role de um usuário alvo (apenas para o síndico)."""
    requesting_user_id = request.args.get('user_id', type=int) # ID de quem está pedindo
    if not requesting_user_id:
        return jsonify({'error': 'ID de usuário requisitante é obrigatório'}), 400

    data = request.get_json()
    new_role = data.get('new_role')

    if not new_role or new_role not in ('admin_bloco', 'morador'):
        return jsonify({'error': 'Nova role inválida. Use "admin_bloco" ou "morador".'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Verifica se quem está pedindo é o SÍNDICO
            cursor.execute('SELECT role FROM Moradores WHERE morador_id = %s', (requesting_user_id,))
            requesting_user = cursor.fetchone()

            if not requesting_user or requesting_user['role'] != 'sindico':
                return jsonify({'error': 'Acesso negado. Apenas o Super Admin pode alterar roles.'}), 403

            # 2. Verifica se o usuário alvo existe
            cursor.execute('SELECT role FROM Moradores WHERE morador_id = %s', (target_user_id,))
            target_user = cursor.fetchone()
            if not target_user:
                return jsonify({'error': 'Usuário alvo não encontrado.'}), 404

            # 3. Impede o síndico de mudar a própria role
            if int(requesting_user_id) == int(target_user_id):
                 return jsonify({'error': 'O Super Admin não pode alterar a própria role.'}), 400

            # 4. Atualiza a role do usuário alvo
            cursor.execute("UPDATE Moradores SET role = %s WHERE morador_id = %s", (new_role, target_user_id))
            conn.commit()

        return jsonify({'message': f'Role do usuário {target_user_id} atualizada para {new_role}.'}), 200
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({'error': f'Erro de banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/users/<int:target_user_id>', methods=['DELETE'])
def delete_user(target_user_id):
    """Exclui um morador. (Apenas para Admins)."""
    
    # 1. Obter o ID do admin que está fazendo a requisição
    requesting_user_id = request.args.get('user_id', type=int)
    if not requesting_user_id:
        return jsonify({'error': 'ID de usuário requisitante é obrigatório'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 2. Buscar dados do admin requisitante
            cursor.execute(
                'SELECT morador_id, role, apartamento_id FROM Moradores WHERE morador_id = %s', 
                (requesting_user_id,)
            )
            requesting_user = cursor.fetchone()

            if not requesting_user or requesting_user['role'] not in ('sindico', 'admin_bloco'):
                return jsonify({'error': 'Acesso negado. Apenas administradores podem excluir usuários.'}), 403

            # 3. Buscar dados do usuário alvo (que será excluído)
            cursor.execute(
                'SELECT morador_id, role, apartamento_id FROM Moradores WHERE morador_id = %s', 
                (target_user_id,)
            )
            target_user = cursor.fetchone()

            if not target_user:
                return jsonify({'error': 'Usuário alvo não encontrado.'}), 404

            # --- REGRAS DE AUTORIZAÇÃO ---
            
            # Regra 1: Ninguém pode se auto-excluir
            if int(requesting_user_id) == int(target_user_id):
                 return jsonify({'error': 'Você não pode excluir a si mesmo.'}), 400
            
            # Regra 2: Ninguém pode excluir um Super Admin
            if target_user['role'] == 'sindico':
                return jsonify({'error': 'Não é permitido excluir um Super Admin.'}), 403

            # Regra 3: 'admin_bloco' só pode excluir usuários do seu bloco
            if requesting_user['role'] == 'admin_bloco':
                # Busca o ID do bloco do admin
                cursor.execute("SELECT bloco_id FROM Apartamentos WHERE apartamento_id = %s", (requesting_user['apartamento_id'],))
                requesting_user_bloco_id = cursor.fetchone()['bloco_id']
                
                # Busca o ID do bloco do alvo
                cursor.execute("SELECT bloco_id FROM Apartamentos WHERE apartamento_id = %s", (target_user['apartamento_id'],))
                target_user_bloco_id = cursor.fetchone()['bloco_id']

                if requesting_user_bloco_id != target_user_bloco_id:
                    return jsonify({'error': 'Administradores de bloco só podem excluir moradores do seu próprio bloco.'}), 403

            # 4. EXECUTAR EXCLUSÃO (Se todas as regras passaram)
            # O usuário é 'sindico' (excluindo um não-sindico) ou 'admin_bloco' (excluindo alguém do seu bloco).
            
            print(f"[Ação Admin] Usuário {requesting_user_id} ({requesting_user['role']}) está excluindo usuário {target_user_id}.")

            # Passo 4.1: Excluir registros dependentes primeiro (Ex: Reclamações)
            # Isso é crucial por causa das Foreign Keys
            cursor.execute("DELETE FROM Complaints WHERE user_id = %s", (target_user_id,))
            
            # Passo 4.2: Excluir o morador
            cursor.execute("DELETE FROM Moradores WHERE morador_id = %s", (target_user_id,))
            
            conn.commit()

        return jsonify({'message': f'Usuário {target_user_id} e seus dados associados foram excluídos com sucesso.'}), 200
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({'error': f'Erro de banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/complaints/<int:complaint_id>', methods=['PUT'])
def update_complaint(complaint_id):
    """Atualiza o status e/ou comentário de uma reclamação."""
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'error': 'ID de usuário é obrigatório'}), 400
        
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT * FROM Moradores WHERE morador_id = %s', (user_id,))
            current_user = cursor.fetchone()

            if not current_user or current_user['role'] not in ('admin_bloco', 'sindico'):
                return jsonify({'error': 'Acesso negado.'}), 403

            data = request.get_json()
            new_status = data.get('status')
            admin_comment = data.get('admin_comment')

            if not new_status:
                return jsonify({'error': 'O campo status é obrigatório.'}), 400

            if current_user['role'] == 'admin_bloco':
                cursor.execute("""
                    SELECT a.bloco_id FROM Apartamentos a WHERE a.apartamento_id = %s
                """, (current_user['apartamento_id'],))
                user_bloco_id = cursor.fetchone()['bloco_id']
                
                cursor.execute("""
                    SELECT b.bloco_id FROM Complaints c
                    JOIN Moradores m ON c.user_id = m.morador_id
                    JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
                    JOIN Blocos b ON a.bloco_id = b.bloco_id
                    WHERE c.id = %s
                """, (complaint_id,))
                complaint_bloco_id = cursor.fetchone()['bloco_id']

                if user_bloco_id != complaint_bloco_id:
                    return jsonify({'error': 'Você só pode editar reclamações do seu bloco.'}), 403

            cursor.execute(
                "UPDATE Complaints SET status = %s, admin_comment = %s WHERE id = %s",
                (new_status, admin_comment, complaint_id)
            )
            conn.commit()
        return jsonify({'message': 'Reclamação atualizada com sucesso.'}), 200
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({'error': f'Erro no banco de dados: {e}'}), 500
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    print("--- Servidor Flask iniciado em http://127.0.0.1:5000 ---")
    app.run(debug=True, port=5000)