"""
Script para promover um morador a administrador do seu respectivo bloco.

Este script interativo solicita o e-mail de um morador, localiza o usuário
no banco de dados e, após confirmação, atualiza sua 'role' para 'admin_bloco'.
"""
import sqlite3

DATABASE_FILE = 'condominio.db'


def set_block_admin():
    """Promove um usuário a administrador do seu bloco."""
    email = input("Digite o e-mail do morador a ser promovido a admin do seu bloco: ")

    conn = None
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        query = """
        SELECT m.morador_id, m.nome, b.numero_bloco
        FROM Moradores m
        JOIN Apartamentos a ON m.apartamento_id = a.apartamento_id
        JOIN Blocos b ON a.bloco_id = b.bloco_id
        WHERE m.email = ?
        """
        cursor.execute(query, (email,))
        morador = cursor.fetchone()

        if not morador:
            print(f"Erro: Morador com e-mail '{email}' não encontrado.")
            return

        print(f"\nMorador encontrado: {morador['nome']}")
        print(f"Bloco associado: {morador['numero_bloco']}")
        
        prompt_message = (
            f"Deseja promover este usuário a admin do Bloco {morador['numero_bloco']}? "
            "(s/n): "
        )
        confirm = input(prompt_message)

        if confirm.lower() == 's':
            cursor.execute(
                "UPDATE Moradores SET role = 'admin_bloco' WHERE morador_id = ?",
                (morador['morador_id'],)
            )
            conn.commit()
            success_message = (
                f"\nSucesso! {morador['nome']} agora é administrador do "
                f"Bloco {morador['numero_bloco']}."
            )
            print(success_message)
        else:
            print("Operação cancelada.")

    except sqlite3.Error as e:
        print(f"Ocorreu um erro no banco de dados: {e}")
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    set_block_admin()