import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Register() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Estados para o filtro em cascata
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");
  const [blocks, setBlocks] = useState([]); // Lista de blocos do servidor
  const [availableApartments, setAvailableApartments] = useState([]); // Aptos do bloco escolhido
  
  // Estados para visualização das senhas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // 1. Carrega a lista de blocos ao abrir a página
  useEffect(() => {
    fetch(`${API_URL}/api/blocks`)
      .then(res => res.json())
      .then(data => setBlocks(data))
      .catch(err => console.error("Erro ao carregar blocos:", err));
  }, []);

  // 2. Carrega os apartamentos sempre que o bloco selecionado mudar
  useEffect(() => {
    if (bloco) {
      setApartamento(""); // Limpa o apartamento selecionado anteriormente
      fetch(`${API_URL}/api/blocks/${bloco}/apartments`)
        .then(res => res.json())
        .then(data => setAvailableApartments(data))
        .catch(err => console.error("Erro ao carregar apartamentos:", err));
    } else {
      setAvailableApartments([]);
    }
  }, [bloco]);

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
    <div className="register-container container mt-5" style={{ maxWidth: '550px' }}>
      <div className="card p-4 shadow-sm border-0">
        <h2 className="text-center mb-4 fw-bold">Criar Conta</h2>
        
        <form onSubmit={handleRegister}>
          <div className="mb-3">
            <label className="form-label fw-bold">Nome Completo</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">E-mail</label>
            <input
              type="email"
              className="form-control"
              placeholder="exemplo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label fw-bold">Senha</label>
              <div className="input-group">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="Mín. 6 caracteres"
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
              <label className="form-label fw-bold">Confirmar Senha</label>
              <div className="input-group">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="Repita a senha"
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
              <label className="form-label fw-bold">Bloco</label>
              <select 
                className="form-select" 
                value={bloco} 
                onChange={(e) => setBloco(e.target.value)} 
                required
                disabled={isLoading || blocks.length === 0}
              >
                <option value="">Selecione o Bloco</option>
                {blocks.map(b => (
                  <option key={b.bloco_id} value={b.numero_bloco}>
                    Bloco {b.numero_bloco}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label fw-bold">Apartamento</label>
              <select 
                className="form-select" 
                value={apartamento} 
                onChange={(e) => setApartamento(e.target.value)} 
                required
                disabled={isLoading || !bloco}
              >
                <option value="">Selecione o Apto</option>
                {availableApartments.map((a, idx) => (
                  <option key={idx} value={a.numero_apartamento}>
                    Apto {a.numero_apartamento}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {message.text && (
            <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'} mb-4`}>
              {message.text}
            </div>
          )}

          <div className="d-flex gap-2">
            <button 
              type="button" 
              className="btn btn-outline-secondary w-50" 
              onClick={() => navigate("/")}
              disabled={isLoading}
            >
              Voltar
            </button>
            <button type="submit" className="btn btn-primary w-50" disabled={isLoading}>
              {isLoading ? "A processar..." : "Finalizar Registo"}
            </button>
          </div>
        </form>
      </div>
      <div className="text-center mt-3">
        <p>Já possui uma conta? <Link to="/" className="text-decoration-none fw-bold">Faça Login</Link></p>
      </div>
    </div>
  );
}