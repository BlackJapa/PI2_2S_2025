import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Pega a URL do banco do ambiente
DATABASE_URL = os.environ.get('DATABASE_URL')

def promover_para_master():
    email = input("Digite o e-mail da conta que será o Síndico Master: ")

    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor, sslmode='require')
        cursor = conn.cursor()

        # Verifica se o usuário existe
        cursor.execute("SELECT morador_id, nome FROM Moradores WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user:
            # Atualiza a permissão para 'sindico'
            cursor.execute("UPDATE Moradores SET role = 'sindico' WHERE email = %s", (email,))
            conn.commit()
            print(f"✅ SUCESSO! O usuário {user['nome']} ({email}) agora é o Síndico Master.")
        else:
            print(f"❌ ERRO: Nenhuma conta encontrada com o e-mail {email}.")

    except Exception as e:
        print(f"Erro no banco: {e}")
    finally:
        if conn: conn.close()

if __name__ == '__main__':
    promover_para_master()