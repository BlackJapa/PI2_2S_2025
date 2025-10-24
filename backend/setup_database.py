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
            print("Verificando e criando tabelas (se não existirem)...")
            print("Criando tabelas...")

            # SERIAL PRIMARY KEY é o autoincremento do PostgreSQL
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
                nome TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                apartamento_id INTEGER NOT NULL REFERENCES Apartamentos(apartamento_id),
                role TEXT NOT NULL DEFAULT 'morador' CHECK(role IN ('morador', 'admin_bloco', 'sindico'))
            );
            CREATE TABLE IF NOT EXISTS Complaints (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES Moradores(morador_id),
                subject TEXT NOT NULL,
                description TEXT NOT NULL,
                date TIMESTAMP WITH TIME ZONE DEFAULT (now() at time zone 'America/Sao_Paulo'),
                status TEXT DEFAULT 'aberto',
                admin_comment TEXT
            );
            """)
            print("Tabelas verificadas/criadas com sucesso.")

            # ALTERAÇÃO: O loop agora começa em 0 para incluir o bloco do administrador.
        cursor.execute("SELECT COUNT(*) FROM Blocos")
        count = cursor.fetchone()[0]
            
        if count == 0:
                print("\nBanco de dados vazio. Populando blocos...")
                for i in range(0, 41): # De 0 a 40
                    cursor.execute("INSERT INTO Blocos (numero_bloco) VALUES (%s)", (i,))

                print("Populando apartamentos...")
                # Cria o apartamento do Bloco 0
                cursor.execute("SELECT bloco_id FROM Blocos WHERE numero_bloco = 0")
                bloco_admin_id = cursor.fetchone()[0]
                cursor.execute("INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (%s, %s)", (0, bloco_admin_id))

                # Cria os apartamentos dos Blocos 1-40
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
                
                print("Dados iniciais inseridos.")
        else:
            print("O banco de dados já está populado. Nenhuma ação necessária.")

        conn.commit()

    except psycopg2.Error as e:
        print(f"Erro no banco de dados: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    setup_database()
    print("\nSetup do banco de dados PostgreSQL concluído!")