import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
CORS(app) # Permite todas as origens para eliminar erro de CORS

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'chave_mestra_condominio')
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor, sslmode='require')

# --- Middleware ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or " " not in auth_header:
            return jsonify({'error': 'Token ausente'}), 401
        try:
            token = auth_header.split(" ")[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            g.user_id = data['user_id']
        except:
            return jsonify({'error': 'Token inválido'}), 401
        return f(*args, **kwargs)
    return decorated

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
        cursor.execute("""
            SELECT m.*, a.numero_apartamento, b.numero_bloco 
            FROM Moradores m
            JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
            JOIN Blocos b ON a.bloco_id = b.bloco_id
            WHERE m.email = %s
        """, (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password'], password):
            token = jwt.encode({
                'user_id': user['morador_id'],
                'role': user['role'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=8)
            }, app.config['SECRET_KEY'], algorithm='HS256')

            return jsonify({
                'token': token,
                'user': {
                    'id': user['morador_id'],
                    'nome': user['nome'],
                    'role': user['role'],
                    'bloco': user['numero_bloco'],
                    'apartment': user['numero_apartamento']
                }
            }), 200
        
        return jsonify({'error': 'Credenciais inválidas'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()