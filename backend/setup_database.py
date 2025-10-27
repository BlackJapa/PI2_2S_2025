"""
Script para setup e população inicial do banco de dados PostgreSQL do condomínio,
incluindo a criação do usuário síndico (Super Admin) no Bloco 0, Apto 0.
Este script é idempotente (seguro para rodar múltiplas vezes).
"""
import os
import psycopg2
from psycopg2 import sql
from werkzeug.security import generate_password_hash

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise Exception("Variável de ambiente DATABASE_URL não foi definida.")

def setup_database():
    """Cria tabelas (se não existirem) e popula dados iniciais se o banco estiver vazio."""
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cursor: # <-- Bloco 'with' começa aqui
            print("Verificando e criando tabelas (se não existirem)...")
           
            # Criação das tabelas
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

            # --- CORREÇÃO DE INDENTAÇÃO E LÓGICA DE POPULAÇÃO ---
            # Verifica se o banco já tem blocos (DENTRO do 'with')
            cursor.execute("SELECT COUNT(*) FROM Blocos")
            count_result = cursor.fetchone() 
            count = count_result[0] if count_result else 0
            
            # Só popula se o banco estiver vazio
            if count == 0:
                print("\nBanco de dados vazio. Iniciando população...")
                
                # Popula Blocos (0 a 40)
                print("-> Populando blocos...")
                for i in range(0, 41):
                    cursor.execute("INSERT INTO Blocos (numero_bloco) VALUES (%s)", (i,))

                # Popula Apartamentos
                print("-> Populando apartamentos...")
                # Cria o Apto 0 para o Bloco 0 e pega o ID do apartamento
                cursor.execute("SELECT bloco_id FROM Blocos WHERE numero_bloco = 0")
                bloco_admin_id_result = cursor.fetchone()
                if not bloco_admin_id_result:
                    raise Exception("Erro crítico: Bloco 0 não foi encontrado após inserção.")
                bloco_admin_id = bloco_admin_id_result[0]

                cursor.execute(
                    "INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (%s, %s) RETURNING apartamento_id", 
                    (0, bloco_admin_id)
                )
                apto_sindico_id_result = cursor.fetchone()
                if not apto_sindico_id_result:
                     raise Exception("Erro crítico: Apartamento 0 não foi criado.")
                apto_sindico_id = apto_sindico_id_result[0]
                print(f"--> Apartamento do Síndico (ID: {apto_sindico_id}) criado.")

                # --- CORREÇÃO DE ORDEM: Define as variáveis ANTES de usar ---
                #print("-> Preparando dados do usuário Síndico...")
                #sindico_nome = "Yuri H"
                #sindico_email = "yuri.hamano@gmail.com"
                #sindico_senha_plain = "Hamano152047"
                #sindico_senha_hash = generate_password_hash(sindico_senha_plain)

                # --- Tenta criar o usuário SÍNDICO ---
                try:
                    print(f"-> Inserindo usuário Síndico '{sindico_nome}'...")
                    cursor.execute("""
                        INSERT INTO Moradores (nome, email, password, apartamento_id, role)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (sindico_nome, sindico_email, sindico_senha_hash, apto_sindico_id, 'sindico'))
                    print(f"--> Usuário Síndico '{sindico_nome}' criado com sucesso.")
                except psycopg2.IntegrityError:
                     print(f"--> Aviso: Usuário Síndico com email '{sindico_email}' já existe (rollback).")
                     conn.rollback() # Desfaz a tentativa de insert duplicado
                except psycopg2.Error as insert_err:
                     print(f"--> Erro ao inserir Síndico (rollback): {insert_err}")
                     conn.rollback()

                # Cria os apartamentos dos Blocos 1-40
                print("-> Populando apartamentos residenciais...")
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
            # Fim do if count == 0 (Ainda DENTRO do 'with')
            else:
                print("O banco de dados já está populado. Nenhuma ação de população necessária.")

            # Commit final fora do if, mas DENTRO do 'with'
            conn.commit() 
        # Fim do bloco 'with' (cursor é fechado aqui)

    except psycopg2.Error as e:
        print(f"Erro no banco de dados: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
            print("Conexão com o banco de dados fechada.")

if __name__ == '__main__':
    try:
        from werkzeug.security import generate_password_hash
    except ImportError:
        print("\n!!! AVISO: Biblioteca 'werkzeug' não encontrada.")
        print("!!! Execute 'pip install werkzeug' antes de rodar este script.")
        exit(1)
        
    print("Iniciando setup do banco de dados...")
    setup_database()
    print("\nSetup do banco de dados PostgreSQL concluído/verificado!")