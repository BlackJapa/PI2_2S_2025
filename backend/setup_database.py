"""
Script para setup e população do banco de dados PostgreSQL do condomínio.
"""
import os
import psycopg2
from psycopg2 import sql

# Pega a URL do banco de dados da variável de ambiente
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise Exception("Variável de ambiente DATABASE_URL não foi definida.")

def setup_database():
    """Cria as tabelas e popula com dados iniciais no PostgreSQL."""
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cursor:
            print("Limpando tabelas existentes (se houver)...")
            cursor.execute("DROP TABLE IF EXISTS Complaints, Moradores, Apartamentos, Blocos CASCADE;")

            print("Criando tabelas...")
            # SERIAL PRIMARY KEY é o autoincremento do PostgreSQL
            cursor.execute("""
            CREATE TABLE Blocos (
                bloco_id SERIAL PRIMARY KEY,
                numero_bloco INTEGER NOT NULL UNIQUE
            );
            CREATE TABLE Apartamentos (
                apartamento_id SERIAL PRIMARY KEY,
                numero_apartamento INTEGER NOT NULL,
                bloco_id INTEGER NOT NULL REFERENCES Blocos(bloco_id),
                UNIQUE(bloco_id, numero_apartamento)
            );
            CREATE TABLE Moradores (
                morador_id SERIAL PRIMARY KEY,
                nome TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                apartamento_id INTEGER NOT NULL REFERENCES Apartamentos(apartamento_id),
                role TEXT NOT NULL DEFAULT 'morador' CHECK(role IN ('morador', 'admin_bloco', 'sindico'))
            );
            CREATE TABLE Complaints (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES Moradores(morador_id),
                subject TEXT NOT NULL,
                description TEXT NOT NULL,
                date TIMESTAMP WITH TIME ZONE DEFAULT (now() at time zone 'America/Sao_Paulo'),
                status TEXT DEFAULT 'aberto',
                admin_comment TEXT
            );
            """)
            print("Tabelas criadas com sucesso.")

            print("\nPopulando blocos...")
            # ALTERAÇÃO: O loop agora começa em 0 para incluir o bloco do administrador.
            for i in range(0, 41):
                cursor.execute("INSERT INTO Blocos (numero_bloco) VALUES (%s)", (i,))

            print("Populando apartamentos...")
            
            # --- LÓGICA ATUALIZADA PARA OS APARTAMENTOS ---

            # 1. Cria o apartamento especial para o Bloco 0
            print("-> Criando apartamento do administrador geral (Bloco 0, Apto 0)...")
            cursor.execute("SELECT bloco_id FROM Blocos WHERE numero_bloco = 0")
            bloco_admin_id = cursor.fetchone()[0]
            cursor.execute("INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (%s, %s)", (0, bloco_admin_id))

            # 2. Cria os apartamentos para os blocos residenciais (1 a 40)
            print("-> Criando apartamentos dos blocos residenciais...")
            cursor.execute("SELECT bloco_id FROM Blocos WHERE numero_bloco > 0 ORDER BY numero_bloco")
            blocos_residenciais = cursor.fetchall()
            
            for (bloco_id,) in blocos_residenciais:
                terreo_aps = [1, 2, 5, 6]
                for ap_num in terreo_aps:
                    cursor.execute("INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (%s, %s)", (ap_num, bloco_id))
                for andar in range(1, 13):
                    for ap_final in range(1, 7):
                        num_ap = int(f"{andar}{ap_final}")
                        cursor.execute("INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (%s, %s)", (num_ap, bloco_id))
            
            print("Dados inseridos.")

        conn.commit()

    except psycopg2.Error as e:
        print(f"Erro no banco de dados: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    setup_database()
    print("\nSetup do banco de dados PostgreSQL concluído!")