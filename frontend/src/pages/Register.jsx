import { useState } from "react";
import { Link } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");

  // Substitua sua função 'handleRegister' por esta:
  const handleRegister = async (e) => {
    e.preventDefault();

    if (bloco < 1 || bloco > 40) {
      alert("Bloco inválido! Digite um valor de 1 a 40.");
      return;
    }
    if (apartamento < 1 || apartamento > 126) {
      alert("Apartamento inválido! Digite um valor de 1 a 126.");
      return;
    }

    try {
      const response = await fetch('http://localhost:5173/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, bloco, apartment: apartamento }),
      });

      // --- INÍCIO DA CORREÇÃO ---
      
      if (response.ok) {
        // Se a resposta for bem-sucedida, mostramos o alerta e limpamos o formulário.
        // Não precisamos ler o corpo da resposta se vamos apenas mostrar um alerta padrão.
        alert("Cadastro realizado com sucesso! Faça login para continuar.");
        setEmail("");
        setPassword("");
        setBloco("");
        setApartamento("");
      } else {
        // Se a resposta for um erro, lemos como texto para evitar o erro de JSON.
        const errorText = await response.text();
        // Tentamos interpretar o texto como JSON para pegar a mensagem de erro específica.
        try {
          const errorData = JSON.parse(errorText);
          alert(errorData.error || 'Ocorreu um erro ao cadastrar.');
        } catch (jsonError) {
          // Se não for JSON, mostramos o texto do erro ou uma mensagem genérica.
          alert(errorText || 'Ocorreu um erro ao cadastrar.');
        }
      }
      // --- FIM DA CORREÇÃO ---

    } catch (error) {
      // Este erro acontece se não houver conexão com o servidor.
      console.error('Erro de conexão:', error);
      alert('Erro ao conectar com o servidor.');
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}>
      <div>
        <h2>Cadastro</h2>
        <form onSubmit={handleRegister}>
          <input
            type="email"
            className="form-control mb-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="form-control mb-3"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="number"
            className="form-control mb-3"
            placeholder="Bloco (1-40)"
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            required
          />
          <input
            type="number"
            className="form-control mb-3"
            placeholder="Apartamento (1-126)"
            value={apartamento}
            onChange={(e) => setApartamento(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary w-100">Cadastrar</button>
        </form>
        <p className="mt-3">
          Já tem conta? <Link to="/">Entrar</Link>
        </p>
      </div>
    </div>
  );
}