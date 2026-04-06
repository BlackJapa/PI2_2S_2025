import os
import psycopg2
from werkzeug.security import generate_password_hash

DATABASE_URL = os.environ.get('DATABASE_URL')

def setup_database():
    print("Iniciando setup do banco de dados...")
    if not DATABASE_URL:
        print("Erro: DATABASE_URL não encontrada!")
        return

    try:
        # Conexão com SSL obrigatória para Supabase
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        conn.autocommit = True
        cursor = conn.cursor()

        # Criação das tabelas com aspas triplas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS Blocos (
                bloco_id SERIAL PRIMARY KEY,
                numero_bloco INTEGER NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS Apartamentos (
                apartamento_id SERIAL PRIMARY KEY,
                numero_apartamento INTEGER NOT NULL,
                bloco_id INTEGER NOT NULL REFERENCES Blocos(bloco_id),
                UNIQUE(bloco_id, numero_apartamento)
            );
            CREATE TABLE IF NOT EXISTS Moradores (
                morador_id SERIAL PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'morador',
                apartamento_id INTEGER REFERENCES Apartamentos(apartamento_id)
            );
            CREATE TABLE IF NOT EXISTS Complaints (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES Moradores(morador_id),
                subject VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'Aberto',
                admin_comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        print("Tabelas verificadas/criadas com sucesso no Supabase!")
        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Erro no banco de dados: {e}")

if __name__ == '__main__':
    setup_database()