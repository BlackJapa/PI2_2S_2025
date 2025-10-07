import { useState } from "react";
import { Link } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");

  const handleRegister = (e) => {
    e.preventDefault();

    // validação dos campos bloco e apartamento
    if (bloco < 1 || bloco > 10) {
      alert("Bloco inválido! Digite um valor de 1 a 10.");
      return;
    }
    if (apartamento < 1 || apartamento > 300) {
      alert("Apartamento inválido! Digite um valor de 1 a 300.");
      return;
    }

    console.log("Cadastro enviado:", { email, password, bloco, apartamento });
    alert("Cadastro enviado! (ainda sem banco de dados)");
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}>
      <div>
        <h2>Cadastro</h2>
        <form onSubmit={handleRegister}>
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
          <button type="submit">Cadastrar</button>
        </form>
        <p>
          Já tem conta? <Link to="/">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
