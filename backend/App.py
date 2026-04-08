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
# Permitir CORS para todas as origens durante o teste, ou configure sua URL do Render
CORS(app)

# Variáveis de Ambiente
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'pi_condominio_2026_segredo')
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    return psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor,
        sslmode='require'
    )

# --- Middleware de Autenticação ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or " " not in auth_header:
            return jsonify({'error': 'Token ausente ou malformado'}), 401

        try:
            token = auth_header.split(" ")[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            g.user_id = data['user_id']
            g.role = data['role']
        except Exception:
            return jsonify({'error': 'Token inválido ou expirado'}), 401

        return f(*args, **kwargs)
    return decorated

# --- Rotas ---

@app.route('/api/db-status', methods=['GET'])
def db_status():
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({'status': 'online'}), 200
    except:
        return jsonify({'status': 'offline'}), 500

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
        
        return jsonify({'error': 'E-mail ou senha incorretos'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

# Exemplo de rota protegida para buscar reclamações
@app.route('/api/my-complaints', methods=['GET'])
@token_required
def get_my_complaints():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Complaints WHERE user_id = %s", (g.user_id,))
    complaints = cursor.fetchall()
    conn.close()
    return jsonify(complaints), 200

if __name__ == '__main__':
    app.run()