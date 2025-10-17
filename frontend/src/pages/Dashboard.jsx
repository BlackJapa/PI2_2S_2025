import { useState, useEffect } from "react";

export default function Dashboard({ user }) {
  const [view, setView] = useState("menu");
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [status, setStatus] = useState("aberto");
  const [adminComment, setAdminComment] = useState("");

  // Buscar reclamações
  const fetchComplaints = async () => {
    try {
      const response = await fetch(
        `http://localhost:5173/api/complaints?user_id=${user.id}&is_admin=${user.is_admin}`
      );
      const data = await response.json();
      setComplaints(data);
    } catch (error) {
      console.error('Erro ao buscar reclamações:', error);
    }
  };

  // Buscar usuários (apenas admin)
  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5173/api/users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  useEffect(() => {
    if (view === "table" || view === "manage") {
      fetchComplaints();
    }
    if (view === "manage" && user.is_admin) {
      fetchUsers();
    }
  }, [view, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5173/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          subject,
          description,
          date: new Date().toLocaleString(),
        }),
      });
      if (response.ok) {
        setSubject("");
        setDescription("");
        setView("table");
        fetchComplaints();
      }
    } catch (error) {
      console.error('Erro ao enviar reclamação:', error);
    }
  };

  const handleUpdateComplaint = async (complaintId) => {
    try {
      const response = await fetch(`http://localhost:5173/api/complaints/${complaintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_comment: adminComment }),
      });
      if (response.ok) {
        setEditingComplaint(null);
        fetchComplaints();
      }
    } catch (error) {
      console.error('Erro ao atualizar reclamação:', error);
    }
  };

  // NOVA FUNÇÃO para excluir um usuário
  const handleDeleteUser = async (userIdToDelete) => {
    if (window.confirm("Tem certeza que deseja excluir este usuário? Esta ação é irreversível.")) {
      try {
        const response = await fetch(`http://localhost:5173/api/users/${userIdToDelete}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          alert("Usuário excluído com sucesso.");
          fetchUsers(); // Atualiza a lista de usuários
          fetchComplaints(); // Atualiza a lista de reclamações (caso alguma tenha sido excluída)
        }
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        alert('Erro ao conectar com o servidor.');
      }
    }
  };


  if (view === "menu") {
    // (Esta parte do código permanece a mesma)
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h2>Bem-vindo, {user.email}</h2>
        {user.is_admin && <p style={{color: 'gold'}}><strong>👑 Modo Administrador</strong></p>}
        <button className="btn btn-primary m-2" onClick={() => setView("form")}>
          Nova Reclamação
        </button>
        <button className="btn btn-secondary m-2" onClick={() => setView("table")}>
          Visualizar Reclamações
        </button>
        {user.is_admin && (
          <button className="btn btn-warning m-2" onClick={() => setView("manage")}>
            Gerenciar Sistema
          </button>
        )}
      </div>
    );
  }

  if (view === "form" || view === "table") {
    // (Estas partes do código permanecem as mesmas)
    return view === "form" ? (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Nova Reclamação</h2>
        <form onSubmit={handleSubmit}>
          <input className="form-control mb-3" placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <textarea className="form-control mb-3" placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} required rows="4" />
          <button className="btn btn-success me-2" type="submit">Salvar</button>
          <button className="btn btn-secondary" onClick={() => setView("menu")}>Voltar</button>
        </form>
      </div>
    ) : (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Reclamações</h2>
        <table className="table table-striped">
          <thead><tr><th>Data</th><th>Assunto</th><th>Reclamante</th><th>Descrição</th><th>Status</th><th>Comentário Admin</th></tr></thead>
          <tbody>
            {complaints.map((c) => (<tr key={c.id}><td>{c.date}</td><td>{c.subject}</td><td>{c.user_email} - Bloco {c.user_bloco} / Apt {c.user_apartment}</td><td>{c.description}</td><td><span className={`badge ${c.status === 'aberto' ? 'bg-danger' : c.status === 'em análise' ? 'bg-warning' : 'bg-success'}`}>{c.status}</span></td><td>{c.admin_comment || '-'}</td></tr>))}
          </tbody>
        </table>
        <button className="btn btn-secondary" onClick={() => setView("menu")}>Voltar</button>
      </div>
    );
  }

  if (view === "manage" && user.is_admin) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Gerenciamento do Sistema</h2>

        <h3>Reclamações</h3>
        {/* Tabela de reclamações (sem alterações) */}
        <table className="table table-striped">
          <thead><tr><th>Data</th><th>Assunto</th><th>Reclamante</th><th>Descrição</th><th>Status</th><th>Comentário Admin</th><th>Ações</th></tr></thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.id}>
                <td>{c.date}</td><td>{c.subject}</td><td>{c.user_email} - Bloco {c.user_bloco} / Apt {c.user_apartment}</td><td>{c.description}</td>
                <td>
                  {editingComplaint === c.id ? (<select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="aberto">Aberto</option><option value="em análise">Em Análise</option><option value="fechado">Fechado</option></select>) : (<span className={`badge ${c.status === 'aberto' ? 'bg-danger' : c.status === 'em análise' ? 'bg-warning' : 'bg-success'}`}>{c.status}</span>)}
                </td>
                <td>
                  {editingComplaint === c.id ? (<textarea className="form-control" value={adminComment} onChange={(e) => setAdminComment(e.target.value)} rows="2" />) : (c.admin_comment || '-')}
                </td>
                <td>
                  {editingComplaint === c.id ? (<><button className="btn btn-success btn-sm me-1" onClick={() => handleUpdateComplaint(c.id)}>✓</button><button className="btn btn-secondary btn-sm" onClick={() => setEditingComplaint(null)}>✗</button></>) : (<button className="btn btn-primary btn-sm" onClick={() => { setEditingComplaint(c.id); setStatus(c.status); setAdminComment(c.admin_comment || ''); }}>Editar</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Usuários Cadastrados</h3>
        {/* Tabela de usuários COM a nova coluna de Ações */}
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Email</th>
              <th>Bloco</th>
              <th>Apartamento</th>
              <th>Tipo</th>
              <th>Ações</th> {/* <-- NOVA COLUNA */}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.bloco}</td>
                <td>{u.apartment}</td>
                <td><span className={`badge ${u.is_admin ? 'bg-warning' : 'bg-info'}`}>{u.is_admin ? 'Administrador' : 'Morador'}</span></td>
                <td>
                  {/* Se o usuário da linha não for o admin logado, mostra o botão */}
                  {u.id !== user.id && (
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-secondary" onClick={() => setView("menu")}>Voltar</button>
      </div>
    );
  }
}