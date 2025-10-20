"""
Script para setup e população do banco de dados do condomínio.

Este script cria o schema do banco de dados e insere os dados iniciais
de blocos e apartamentos.
"""
import sqlite3
import os

DATABASE_FILE = 'condominio.db'


def create_database():
    """Cria um novo banco de dados com o schema correto."""
    if os.path.exists(DATABASE_FILE):
        os.remove(DATABASE_FILE)
        print(f"Banco de dados '{DATABASE_FILE}' antigo removido.")

    conn = None
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        print("Criando tabelas...")

        # --- Tabela Blocos ---
        cursor.execute("""
        CREATE TABLE "Blocos" (
            "bloco_id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "numero_bloco" INTEGER NOT NULL UNIQUE
        );
        """)

        # --- Tabela Apartamentos ---
        cursor.execute("""
        CREATE TABLE "Apartamentos" (
            "apartamento_id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "numero_apartamento" INTEGER NOT NULL,
            "bloco_id" INTEGER NOT NULL,
            FOREIGN KEY("bloco_id") REFERENCES "Blocos"("bloco_id"),
            UNIQUE("bloco_id", "numero_apartamento")
        );
        """)

        # --- Tabela Moradores (com o novo 'role') ---
        cursor.execute("""
        CREATE TABLE "Moradores" (
            "morador_id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "nome" TEXT NOT NULL,
            "email" TEXT NOT NULL UNIQUE,
            "password" TEXT NOT NULL,
            "apartamento_id" INTEGER NOT NULL,
            "role" TEXT NOT NULL DEFAULT 'morador'
                CHECK("role" IN ('morador', 'admin_bloco', 'sindico')),
            FOREIGN KEY("apartamento_id") REFERENCES "Apartamentos"("apartamento_id")
        );
        """)

        # --- Tabela Reclamações (Exemplo) ---
        cursor.execute("""
        CREATE TABLE "Complaints" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "user_id" INTEGER NOT NULL,
            "subject" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "date" TEXT,
            "status" TEXT DEFAULT 'aberto',
            "admin_comment" TEXT,
            FOREIGN KEY("user_id") REFERENCES "Moradores"("morador_id")
        );
        """)

        conn.commit()
        print("Tabelas criadas com sucesso!")

    except sqlite3.Error as e:
        print(f"Erro ao criar tabelas: {e}")
    finally:
        if conn:
            conn.close()


def populate_data():
    """Popula as tabelas com os blocos e apartamentos."""
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()

        # Popula Blocos
        print("\nPopulando blocos...")
        for i in range(1, 41):
            cursor.execute("INSERT INTO Blocos (numero_bloco) VALUES (?)", (i,))

        # Popula Apartamentos
        print("Populando apartamentos...")
        cursor.execute("SELECT bloco_id, numero_bloco FROM Blocos")
        blocos = cursor.fetchall()
        # A variável 'numero_bloco' não era usada, então foi substituída por '_'
        for bloco_id, _ in blocos:
            terreo_aps = [1, 2, 5, 6]
            for ap_num in terreo_aps:
                cursor.execute(
                    "INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (?, ?)",
                    (ap_num, bloco_id)
                )
            for andar in range(1, 13):
                for ap_final in range(1, 7):
                    numero_apartamento = int(f"{andar}{ap_final}")
                    cursor.execute(
                        "INSERT INTO Apartamentos (numero_apartamento, bloco_id) VALUES (?, ?)",
                        (numero_apartamento, bloco_id)
                    )

        conn.commit()
        print("Dados de blocos e apartamentos inseridos.")

    except sqlite3.Error as e:
        print(f"Erro ao popular dados: {e}")
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    create_database()
    populate_data()
    print("\nSetup do banco de dados concluído!")

# Linha final adicionada para conformidade com o Pylint