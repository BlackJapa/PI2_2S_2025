import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Novo estado
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Agora 'data' já é o objeto do usuário direto
        localStorage.setItem("user", JSON.stringify(data));

        // Redireciona passando os dados no estado da rota
        navigate("/dashboard", { state: data });
      } else {
        alert(data.error || "Erro ao fazer login");
      }
    } catch (error) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input 
          type="email" 
          className="form-control mb-3" 
          placeholder="E-mail" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        
        {/* Campo de Senha com o Botão de Ver/Ocultar */}
        <div className="input-group mb-3">
          <input 
            type={showPassword ? "text" : "password"} 
            className="form-control" 
            placeholder="Senha" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          <button 
            className="btn btn-outline-secondary" 
            type="button" 
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Ocultar" : "Ver"}
          </button>
        </div>

        <button type="submit" className="btn btn-primary w-100">Entrar</button>
      </form>
      <p className="mt-3">Não tem conta? <Link to="/register">Cadastre-se</Link></p>
    </div>
  );
}