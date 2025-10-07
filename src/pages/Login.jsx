import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    if (bloco < 1 || bloco > 10) {
      alert("Bloco inválido! Digite um valor de 1 a 10.");
      return;
    }
    if (apartamento < 1 || apartamento > 300) {
      alert("Apartamento inválido! Digite um valor de 1 a 300.");
      return;
    }

    // Redireciona para Dashboard passando dados do usuário
    navigate("/dashboard", {
      state: { email, bloco, apartment: apartamento },
    });
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}>
      <div>
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          /><br/>
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          /><br/>
          <input
            type="number"
            placeholder="Bloco (1-10)"
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            required
          /><br/>
          <input
            type="number"
            placeholder="Apartamento (1-300)"
            value={apartamento}
            onChange={(e) => setApartamento(e.target.value)}
            required
          /><br/>
          <button type="submit">Entrar</button>
        </form>
        <p>
          Não tem conta? <Link to="/register">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}
