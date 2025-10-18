from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

# Cria a instância da aplicação Flask
app = Flask(__name__)
CORS(app)

# Define o nome do arquivo do banco de dados
DATABASE = 'condominio.db'

@app.route('/api/register', methods=['POST'])
def register():
    # Apenas para sabermos que a função foi chamada
    print("\n>>> SUCESSO! A ROTA /api/register FOI ACESSADA CORRETAMENTE! <<<\n")
    
    # Retorna uma resposta de sucesso simples
    return jsonify({'message': 'A rota de teste funcionou!'}), 201

# O código abaixo DEVE ser a última coisa no seu arquivo
if __name__ == '__main__':
    print("--- Servidor de DEPURAÇÃO iniciado. Aguardando chamada para /api/register ---")
    app.run(debug=True, port=5173)

    
@app.route('/api/register', methods=['POST'])
def register():

    data = request.get_json()
    nome = data.get('nome')
    email = data.get('email')
    password = data.get('password')
    bloco = data.get('bloco')
    apartamento = data.get('apartment')

    if not all([nome, email, password, bloco, apartamento]):
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400

    hashed_password = generate_password_hash(password)
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    try:
        # 1. Encontrar o apartamento_id
        cursor.execute('''
            SELECT a.apartamento_id FROM Apartamentos a
            JOIN Blocos b ON a.bloco_id = b.bloco_id
            WHERE b.numero_bloco = ? AND a.numero_apartamento = ?
        ''', (bloco, apartamento))
        
        ap_id_result = cursor.fetchone()

        if not ap_id_result:
            return jsonify({'error': 'Apartamento ou bloco não encontrado.'}), 404
        
        apartamento_id = ap_id_result[0]

        # 2. Inserir o novo morador com a senha criptografada
        cursor.execute('''
            INSERT INTO Moradores (nome, email, password, apartamento_id)
            VALUES (?, ?, ?, ?)
        ''', (nome, email, hashed_password, apartamento_id))
        
        conn.commit()
        return jsonify({'message': 'Usuário registrado com sucesso'}), 201

    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email já cadastrado'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Busca o morador pelo e-mail
    cursor.execute('SELECT * FROM Moradores WHERE email = ?', (email,))
    morador = cursor.fetchone()

    # --- LÓGICA DE LOGIN CORRIGIDA ---
    # Verifica se o morador existe e se a senha fornecida corresponde à senha criptografada no banco
    if morador and 'password' in morador.keys() and morador['password'] and check_password_hash(morador['password'], password):
        # Se o login for bem-sucedido, busca as informações do apartamento
        cursor.execute('''
            SELECT b.numero_bloco, a.numero_apartamento FROM Apartamentos a
            JOIN Blocos b ON a.bloco_id = b.bloco_id
            WHERE a.apartamento_id = ?
        ''', (morador['apartamento_id'],))
        ap_info = cursor.fetchone()

        conn.close()
        return jsonify({
            'morador_id': morador['morador_id'],
            'nome': morador['nome'],
            'email': morador['email'],
            'role': morador['role'],
            'bloco': ap_info['numero_bloco'] if ap_info else 'N/A',
            'apartamento': ap_info['numero_apartamento'] if ap_info else 'N/A'
        }), 200
    else:
        # Se o morador não existir ou a senha estiver incorreta
        conn.close()
        return jsonify({'error': 'E-mail ou senha inválidos'}), 401

# --- OUTRAS ROTAS (devem permanecer no seu arquivo) ---
# ... (deixe as outras rotas como /api/complaints, /api/users, etc., aqui) ...


# O código abaixo DEVE ser a última coisa no seu arquivo
if __name__ == '__main__':
    app.run(debug=True, port=5173)