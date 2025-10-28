import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (bloco && (bloco < 0 || bloco > 40)) {
      alert("Bloco inválido! Digite um valor de 1 a 40.");
      return;
    }
    if (apartamento && (apartamento < 0 || apartamento > 126)) {
      alert("Apartamento inválido! Digite um valor de 1 a 126.");
      return;
    }

    try {
      const response = await await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        navigate("/dashboard", {
          state: { 
            id: data.id,
            nome: data.nome,
            email: data.email, 
            bloco: data.bloco, 
            apartment: data.apartment,
            is_admin: data.is_admin,
            role: data.role, // Passando o role
            bloco_id: data.bloco_id // Passando o ID do bloco
          },
        });
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      alert('Erro ao conectar com o servidor.');
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}>
      <div>
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
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
            placeholder="Bloco (1-40) - Opcional para admin"
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
          />
          <input
            type="number"
            className="form-control mb-3"
            placeholder="Apartamento (1-126) - Opcional para admin"
            value={apartamento}
            onChange={(e) => setApartamento(e.target.value)}
          />
          <button type="submit" className="btn btn-primary w-100">Entrar</button>
        </form>
        <p className="mt-3">
          Não tem conta? <Link to="/register">Cadastre-se</Link>
        </p>
        <div className="mt-3 p-2 bg-light rounded">
          <small>
            <p style={{ textAlign: 'center', fontSize: '0.9em', color: '#555' }}>
                Esse trabalho foi feito pelo <Link to="/integrantes">grupo 21</Link>, 
                da faculdade <a href="https://univesp.br" target="_blank" rel="noopener noreferrer">Univesp</a>.
            </p>
          </small>
        </div>
      </div>
    </div>
  );
}