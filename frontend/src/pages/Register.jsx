import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Register() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");
  
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    // Validações de Frontend
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Enviamos 'apartamento' para coincidir com o backend corrigido
        body: JSON.stringify({ 
          nome, 
          email, 
          password, 
          bloco: String(bloco), 
          apartamento: String(apartamento) 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Cadastro realizado com sucesso! Redirecionando..." });
        setTimeout(() => navigate("/"), 2000); // Redireciona após 2 segundos
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao realizar cadastro." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erro de conexão com o servidor." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <h2 className="text-center mb-4">Criar Conta</h2>
      
      <form onSubmit={handleRegister}>
        <div className="mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Nome Completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="mb-3">
          <input
            type="email"
            className="form-control"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="row">
          <div className="col-md-6 mb-3">
            <input
              type="password"
              className="form-control"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="col-md-6 mb-3">
            <input
              type="password"
              className="form-control"
              placeholder="Confirmar Senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="row">
          <div className="col-md-6 mb-3">
            <input
              type="number"
              className="form-control"
              placeholder="Bloco (0-40)"
              value={bloco}
              onChange={(e) => setBloco(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="col-md-6 mb-3">
            <input
              type="number"
              className="form-control"
              placeholder="Apto"
              value={apartamento}
              onChange={(e) => setApartamento(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {message.text && (
          <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'}`}>
            {message.text}
          </div>
        )}

        <button type="submit" className="btn btn-primary w-100 py-2" disabled={isLoading}>
          {isLoading ? "Processando..." : "Finalizar Cadastro"}
        </button>

        <div className="text-center mt-3">
          <span>Já tem uma conta? </span>
          <Link to="/" className="text-decoration-none">Faça Login</Link>
        </div>
      </form>
    </div>
  );
}