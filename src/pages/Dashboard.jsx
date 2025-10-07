import { useState } from "react";

export default function Dashboard({ user }) {
  const [view, setView] = useState("menu"); // menu | form | table
  const [complaints, setComplaints] = useState([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const newComplaint = {
      date: new Date().toLocaleString(),
      subject,
      description,
      user: `${user.email} - Bloco ${user.bloco} / Apt ${user.apartment}`,
    };
    setComplaints([...complaints, newComplaint]);
    setSubject("");
    setDescription("");
    setView("table");
  };

  if (view === "menu") {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h2>Bem-vindo, {user.email}</h2>
        <button onClick={() => setView("form")}>Nova Reclamação</button>
        <button onClick={() => setView("table")}>Visualizar Reclamações</button>
      </div>
    );
  }

  if (view === "form") {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Nova Reclamação</h2>
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Assunto"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          /><br/><br/>
          <textarea
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          /><br/><br/>
          <button type="submit">Salvar</button>
        </form>
        <button onClick={() => setView("menu")}>Voltar</button>
      </div>
    );
  }

  if (view === "table") {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Reclamações</h2>
        <table border="1" cellPadding="5" style={{ margin: "0 auto" }}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Assunto</th>
              <th>Reclamante</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c, i) => (
              <tr key={i}>
                <td>{c.date}</td>
                <td>{c.subject}</td>
                <td>{c.user}</td>
                <td>{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <br/>
        <button onClick={() => setView("menu")}>Voltar</button>
      </div>
    );
  }
}
