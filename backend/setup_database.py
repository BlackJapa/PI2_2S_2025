"""
Script para setup e população inicial do banco de dados PostgreSQL do condomínio.
"""
import os
import psycopg2
from psycopg2 import sql
from werkzeug.security import generate_password_hash

# 1. Primeiro pegamos a URL do ambiente
DATABASE_URL = os.environ.get('DATABASE_URL')

def setup_database():
    """Cria tabelas (se não existirem) e popula dados iniciais."""
    if not DATABASE_URL:
        print("Erro: Variável de ambiente DATABASE_URL não foi definida.")
        return

    conn = None
    try:
        # 2. Conectamos usando SSL (obrigatório para Supabase)
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        
        with conn.cursor() as cursor:
            print("Verificando e criando tabelas (se não existirem)...")
           
            # 3. SQL corrigido com aspas triplas
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

            # Verifica se o banco já tem dados
            cursor.execute("SELECT COUNT(*) FROM Blocos")
            count = cursor.fetchone()[0]

            if count == 0:
                print("Populando dados iniciais...")
                # Bloco 0 para o Síndico Geral
                cursor.execute("INSERT INTO Blocos (numero_bloco) VALUES (0) RETURNING bloco_id")
                bloco_0_id = cursor.fetchone()[0]
                
                cursor.execute("INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (0, %s) RETURNING apartamento_id", (bloco_0_id,))
                ap_0_id = cursor.fetchone()[0]

                # Criar Síndico
                senha_hash = generate_password_hash("admin123")
                cursor.execute("""
                    INSERT INTO Moradores (nome, email, password, role, apartamento_id) 
                    VALUES ('Síndico Geral', 'admin@condominio.com', %s, 'sindico', %s)
                """, (senha_hash, ap_0_id))

                # Criar outros blocos (1 a 40)
                for b in range(1, 41):
                    cursor.execute("INSERT INTO Blocos (numero_bloco) VALUES (%s) RETURNING bloco_id", (b,))
                    bloco_id = cursor.fetchone()[0]
                    # Criar apartamentos para cada bloco
                    for andar in range(1, 13):
                        for ap_final in range(1, 7):
                            num_ap = int(f"{andar}{ap_final}")
                            cursor.execute("INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (%s, %s)", (num_ap, bloco_id))
                
                print("Dados iniciais inseridos com sucesso.")
            else:
                print("O banco de dados já possui dados. Pulando população.")

            conn.commit() 

    except psycopg2.Error as e:
        print(f"Erro no banco de dados: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
            print("Conexão fechada.")

if __name__ == '__main__':
    setup_database()