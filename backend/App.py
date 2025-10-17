from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

# Cria a instância da aplicação Flask
app = Flask(__name__)
CORS(app)

# Configuração do banco de dados
DATABASE = 'condominio.db'

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # Tabela de usuários
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            bloco INTEGER NOT NULL,
            apartment INTEGER NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE
        )
    ''')

    # Tabela de reclamações
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            description TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT DEFAULT 'aberto',
            admin_comment TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # Gera o hash da senha padrão do admin
    hashed_password = generate_password_hash('admin123')

    # Criar admin padrão com senha criptografada
    cursor.execute('''
        INSERT OR IGNORE INTO users (email, password, bloco, apartment, is_admin)
        VALUES (?, ?, ?, ?, ?)
    ''', ('admin@condominio.com', hashed_password, 0, 0, True))

    conn.commit()
    conn.close()

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    bloco = data.get('bloco')
    apartment = data.get('apartment')

    if not all([email, password, bloco, apartment]):
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400

    hashed_password = generate_password_hash(password)

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    try:
        cursor.execute('''
            INSERT INTO users (email, password, bloco, apartment)
            VALUES (?, ?, ?, ?)
        ''', (email, hashed_password, bloco, apartment))
        conn.commit()
        return jsonify({'message': 'Usuário registrado com sucesso'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email já cadastrado'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    conn = sqlite3.connect(DATABASE)
    # Permite que os resultados sejam acessados por nome de coluna
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password'], password):
        return jsonify({
            'id': user['id'],
            'email': user['email'],
            'bloco': user['bloco'],
            'apartment': user['apartment'],
            'is_admin': user['is_admin']
        }), 200
    else:
        return jsonify({'error': 'Credenciais inválidas'}), 401

@app.route('/api/complaints', methods=['GET', 'POST'])
def complaints():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:  # <-- ESTA É A LINHA QUE FALTAVA
        if request.method == 'GET':
            user_id = request.args.get('user_id')
            is_admin = request.args.get('is_admin') == 'true'
            
            query = '''
                SELECT c.*, u.email as user_email, u.bloco as user_bloco, u.apartment as user_apartment 
                FROM complaints c JOIN users u ON c.user_id = u.id
            '''
            params = []
            
            if not is_admin:
                query += ' WHERE c.user_id = ?'
                params.append(user_id)
            
            query += ' ORDER BY c.id DESC'
            
            cursor.execute(query, params)
            complaints_data = cursor.fetchall()
            complaints_list = [dict(row) for row in complaints_data]
            return jsonify(complaints_list)
        
        elif request.method == 'POST':
            data = request.get_json()
            cursor.execute('INSERT INTO complaints (user_id, subject, description, date) VALUES (?, ?, ?, ?)',
                           (data['user_id'], data['subject'], data['description'], data['date']))
            conn.commit()
            return jsonify({'message': 'Reclamação registrada com sucesso'}), 201
    
    finally:
        conn.close()

@app.route('/api/complaints/<int:complaint_id>', methods=['PUT'])
def update_complaint(complaint_id):
    data = request.get_json()
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('UPDATE complaints SET status = ?, admin_comment = ? WHERE id = ?',
                   (data['status'], data['admin_comment'], complaint_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Reclamação atualizada'}), 200

@app.route('/api/users', methods=['GET'])
def get_users():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT id, email, bloco, apartment, is_admin FROM users')
    users_data = cursor.fetchall()
    conn.close()
    users_list = [dict(row) for row in users_data]
    return jsonify(users_list)

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    # Excluir o usuário (as reclamações serão excluídas em cascata devido ao 'ON DELETE CASCADE')
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Usuário excluído com sucesso'}), 200

# Esta parte executa o servidor
if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5173)