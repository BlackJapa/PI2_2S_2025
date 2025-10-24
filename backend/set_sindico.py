"""
Script para promover um morador (idealmente do Bloco 0) à role de 'sindico' (Super Admin).
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise Exception("Variável de ambiente DATABASE_URL não foi definida.")

def set_sindico():
    """Promove um usuário a síndico (Super Admin)."""
    email = input("Digite o e-mail do morador a ser promovido a SÍNDICO (Super Admin): ")

    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        with conn.cursor() as cursor:
            cursor.execute("SELECT morador_id, nome FROM Moradores WHERE email = %s", (email,))
            morador = cursor.fetchone()

            if not morador:
                print(f"Erro: Morador com e-mail '{email}' não encontrado.")
                return

            print(f"\nMorador encontrado: {morador['nome']}")
            confirm = input("Deseja promover este usuário a SÍNDICO (acesso total)? (s/n): ")

            if confirm.lower() == 's':
                cursor.execute(
                    "UPDATE Moradores SET role = 'sindico' WHERE morador_id = %s",
                    (morador['morador_id'],)
                )
                conn.commit()
                print(f"\nSucesso! {morador['nome']} agora é o síndico (Super Admin).")
            else:
                print("Operação cancelada.")

    except psycopg2.Error as e:
        print(f"Ocorreu um erro no banco de dados: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # Lembre-se de definir a DATABASE_URL no seu terminal antes de rodar!
    # Windows: set DATABASE_URL="sua_url"
    # Linux/Mac: export DATABASE_URL="sua_url"
    set_sindico()