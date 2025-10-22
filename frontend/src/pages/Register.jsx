import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || 'https://condominio-transparente.onrender.com';

export default function Register() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // Novo estado para confirmar senha
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");
  
  // Novos estados para feedback ao usuário
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate(); // Hook para redirecionamento

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    // --- Novas Validações ---
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      setIsLoading(false);
      return;
    }
    if (bloco < 1 || bloco > 40) {
      setMessage({ type: "error", text: "Bloco inválido! Digite um valor de 1 a 40." });
      setIsLoading(false);
      return;
    }
    if (apartamento < 1 || apartamento > 126) {
      setMessage({ type: "error", text: "Apartamento inválido! Digite um valor de 1 a 126." });
      setIsLoading(false);
      return;
    }
    // --- Fim das Validações ---

    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome, email, password, bloco, apartment: apartamento }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Cadastro realizado com sucesso! Redirecionando para o login..." });
        setTimeout(() => {
          navigate("/"); // Redireciona para a página de login após 2 segundos
        }, 2000);
      } else {
        // --- LÓGICA DE ERRO CORRIGIDA ---
        // 1. Lê a resposta como texto para garantir que não quebre.
        const errorText = await response.text();
        try {
          // 2. Tenta interpretar o texto como JSON.
          const errorData = JSON.parse(errorText);
          setMessage({ type: "error", text: errorData.error || 'Ocorreu um erro ao cadastrar.' });
        } catch (jsonError) {
          // 3. Se não for JSON, mostra o texto do erro ou uma mensagem genérica.
          setMessage({ type: "error", text: `Erro ${response.status}: ${errorText || 'Ocorreu um erro no servidor.'}` });
        }
      }
    } catch (error) {
      // Este bloco agora só será ativado se o servidor estiver realmente offline.
      console.error('Erro de conexão:', error);
      setMessage({ type: "error", text: 'Erro ao conectar com o servidor. Verifique se o backend está em execução.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}>
      <div>
        <h2>Cadastro</h2>
        <form onSubmit={handleRegister}>
          <input
            type="text"
            className="form-control mb-3"
            placeholder="Nome Completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            disabled={isLoading}
          />
          <input
            type="email"
            className="form-control mb-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
          <input
            type="password"
            className="form-control mb-3"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
          {/* Novo campo para confirmar a senha */}
          <input
            type="password"
            className="form-control mb-3"
            placeholder="Confirmar Senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
          <input
            type="number"
            className="form-control mb-3"
            placeholder="Bloco (1-40)"
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            required
            disabled={isLoading}
          />
          <input
            type="number"
            className="form-control mb-3"
            placeholder="Apartamento (1-126)"
            value={apartamento}
            onChange={(e) => setApartamento(e.target.value)}
            required
            disabled={isLoading}
          />

          {/* Área para exibir mensagens de erro ou sucesso */}
          {message.text && (
            <div 
              className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'}`}
              role="alert"
            >
              {message.text}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
            {isLoading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>
        <p className="mt-3">
          Já tem conta? <Link to="/">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

