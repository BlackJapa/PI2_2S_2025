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
  
  // Estados para visualização das senhas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        setMessage({ type: "success", text: "Registo concluído! A redirecionar para o login..." });
        setTimeout(() => navigate("/"), 2000);
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao realizar registo." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erro de conexão com o servidor." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container container mt-5" style={{ maxWidth: '500px' }}>
      <div className="card p-4 shadow-sm">
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
              <div className="input-group">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>
            
            <div className="col-md-6 mb-3">
              <div className="input-group">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="Confirmar"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
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

          <div className="d-flex gap-2">
            <button 
              type="button" 
              className="btn btn-secondary w-50" 
              onClick={() => navigate("/")}
              disabled={isLoading}
            >
              Voltar
            </button>
            <button type="submit" className="btn btn-primary w-50" disabled={isLoading}>
              {isLoading ? "A processar..." : "Finalizar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}