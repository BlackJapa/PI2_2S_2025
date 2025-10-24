import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

// Adicionei um estilo para o cursor "pointer" para os status clicáveis
const cursorPointerStyle = { cursor: 'pointer' };

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const location = useLocation();
  const user = location.state || { email: "Visitante", id: null, role: 'morador', is_admin: false };

  const [view, setView] = useState("menu");
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);

  // Estados para o formulário de nova reclamação
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Estados para o modal de edição
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [newAdminComment, setNewAdminComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- FUNÇÕES DE BUSCA DE DADOS ---
  const fetchComplaints = async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetch(`${API_URL}/api/complaints?user_id=${user.id}`);
      if (!response.ok) throw new Error('Falha ao buscar reclamações.');
      const data = await response.json();
      setComplaints(data);
    } catch (error) { console.error(error); }
  };

  const fetchUsers = async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetch(`${API_URL}/api/users?user_id=${user.id}`);
      if (!response.ok) throw new Error('Falha na autorização ou busca.');
      const data = await response.json();
      setUsers(data);
    } catch (error) { console.error('Erro ao buscar usuários:', error); }
  };

  useEffect(() => {
    if (view === "table") { fetchComplaints(); }
    if (view === "manage" && user.is_admin) { fetchUsers(); }
  }, [view, user.is_admin]);

  // --- FUNÇÕES DE MANIPULAÇÃO (HANDLERS) ---
  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, subject, description }),
      });
      if (response.ok) {
        setSubject("");
        setDescription("");
        alert("Reclamação enviada com sucesso!");
        setView("table");
      } else {
        const data = await response.json();
        alert(`Erro: ${data.error || "Ocorreu um erro."}`);
      }
    } catch (error) {
      alert("Erro ao conectar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditModal = (complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status);
    setNewAdminComment(complaint.admin_comment || "");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedComplaint(null);
  };

  const handleUpdateComplaint = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/complaints/${selectedComplaint.id}?user_id=${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_comment: newAdminComment }),
      });
      if (response.ok) {
        alert("Reclamação atualizada com sucesso!");
        handleCloseModal();
        fetchComplaints();
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error || 'Não foi possível atualizar.'}`);
      }
    } catch (error) {
      alert("Erro ao conectar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = async (targetUserId, targetUserName, newRole) => {
    // Confirmação dupla para evitar cliques acidentais
    const actionText = newRole === 'admin_bloco' ? 'promover' : 'rebaixar';
    if (!confirm(`Tem certeza que deseja ${actionText} ${targetUserName} para ${newRole}?`)) {
      return;
    }

    setIsLoading(true); // Reutiliza o estado de loading
    try {
      const response = await fetch(`${API_URL}/api/users/${targetUserId}/role?user_id=${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_role: newRole }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Role atualizada com sucesso!");
        fetchUsers(); // Atualiza a lista de usuários para refletir a mudança
      } else {
        alert(`Erro: ${data.error || 'Não foi possível atualizar a role.'}`);
      }
    } catch (error) {
      console.error("Erro de conexão ao mudar role:", error);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  
// --- ATUALIZAÇÃO DA RENDERIZAÇÃO DA TABELA DE USUÁRIOS ---
  if (view === "manage" && user.is_admin) {
    return (
      <div className="text-center">
        <h2>Gerenciamento de Moradores</h2>
        {/* Mensagem diferente dependendo se é sindico ou admin_bloco */}
        {user.role === 'sindico' ? (
          <p>Você (Super Admin) está vendo todos os moradores.</p>
        ) : (
          <p>Você (Admin Bloco {user.bloco}) está vendo os moradores do seu bloco.</p>
        )}
        <div className="table-responsive">
          <table className="table table-striped table-hover"> {/* Adicionado table-hover */}
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Bloco</th>
                <th>Apto</th>
                <th>Função</th>
                {/* Coluna de Ações visível apenas para o SINDICO */}
                {user.role === 'sindico' && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                // Destaca a linha do próprio admin logado (opcional)
                <tr key={u.id} className={u.id === user.id ? 'table-info' : ''}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.bloco}</td>
                  <td>{u.apartment}</td>
                  <td>
                    <span className={`badge ${u.role === 'sindico' ? 'bg-danger' : u.role === 'admin_bloco' ? 'bg-warning' : 'bg-info'}`}>
                      {u.role === 'sindico' ? 'Super Admin' : u.role === 'admin_bloco' ? 'Admin Bloco' : 'Morador'}
                    </span>
                  </td>
                  {/* Botões de Ação visíveis apenas para o SINDICO e não para ele mesmo */}
                  {user.role === 'sindico' && (
                    <td>
                      {u.id !== user.id && u.role !== 'sindico' && ( // Não mostra botões para o próprio síndico ou outros síndicos
                        <>
                          {u.role === 'morador' ? (
                            <button
                              className="btn btn-sm btn-success me-1"
                              onClick={() => handleChangeRole(u.id, u.nome, 'admin_bloco')}
                              disabled={isLoading}
                              title={`Promover ${u.nome} a Admin do Bloco ${u.bloco}`}
                            >
                              Promover
                            </button>
                          ) : ( // Se for 'admin_bloco'
                            <button
                              className="btn btn-sm btn-danger me-1"
                              onClick={() => handleChangeRole(u.id, u.nome, 'morador')}
                              disabled={isLoading}
                              title={`Rebaixar ${u.nome} a Morador`}
                            >
                              Rebaixar
                            </button>
                          )}
                        </>
                      )}
                      {/* Mostra um texto se for o próprio síndico */}
                      {u.id === user.id && u.role === 'sindico' && (
                          <span className="text-muted fst-italic">Você</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-secondary mt-3" onClick={() => setView("menu")}>Voltar</button>
      </div>
    );
  }
  // --- RENDERIZAÇÃO CONDICIONAL ---

  if (view === "menu") {
    return (
      <div className="text-center">
        <h2>Bem-vindo, {user.email}</h2>
        {user.is_admin && <p style={{ color: 'gold' }}><strong>👑 Modo Administrador ({user.role})</strong></p>}
        <button className="btn btn-primary m-2" onClick={() => setView("form")}>
          Nova Reclamação
        </button>
        <button className="btn btn-secondary m-2" onClick={() => setView("table")}>
          Visualizar Reclamações
        </button>
        {user.is_admin && (
          <button className="btn btn-warning m-2" onClick={() => setView("manage")}>
            Gerenciar Moradores
          </button>
        )}
      </div>
    );
  }

  if (view === "form") {
    return (
      <div>
        <h2 className="text-center">Nova Reclamação</h2>
        <form onSubmit={handleSubmitComplaint}>
          <div className="mb-3">
            <input type="text" className="form-control" placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="mb-3">
            <textarea className="form-control" placeholder="Descreva sua reclamação" rows="5" value={description} onChange={(e) => setDescription(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="d-flex justify-content-end">
            <button type="button" className="btn btn-secondary me-2" onClick={() => setView("menu")} disabled={isLoading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-success" disabled={isLoading}>
              {isLoading ? 'Enviando...' : 'Enviar Reclamação'}
            </button>
          </div>
        </form>
      </div>
    );
  }
  
  if (view === "table") {
    return (
      <>
        <div className="text-center">
          <h2>Reclamações</h2>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Data e Hora</th>
                  <th>Status</th>
                  <th>Assunto</th>
                  {user.is_admin ? <th>Nome do Reclamante</th> : <th>Descrição</th>}
                  <th>Comentário do Admin</th>
                </tr>
              </thead>
              <tbody>
                {complaints.length > 0 ? complaints.map((c) => (
                  <tr key={c.id}>
                    <td>{new Date(c.date).toLocaleString('pt-BR')}</td>
                    <td>
                      <span
                        className={`badge ${c.status === 'aberto' ? 'bg-danger' : c.status === 'em análise' ? 'bg-warning' : 'bg-success'}`}
                        style={user.is_admin ? cursorPointerStyle : {}}
                        onClick={() => user.is_admin && handleOpenEditModal(c)}
                        title={user.is_admin ? "Clique para editar o status" : ""}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td>{c.subject}</td>
                    {user.is_admin ? (
                      <td>{c.user_name} (Bl: {c.user_bloco})</td>
                    ) : (
                      <td>{c.description.substring(0, 50)}...</td>
                    )}
                    <td>{c.admin_comment || '-'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="5">Nenhuma reclamação encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary mt-3" onClick={() => setView("menu")}>Voltar</button>
        </div>

        {showModal && selectedComplaint && (
          <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <form onSubmit={handleUpdateComplaint}>
                  <div className="modal-header">
                    <h5 className="modal-title">Editar Reclamação #{selectedComplaint.id}</h5>
                    <button type="button" className="btn-close" onClick={handleCloseModal} disabled={isLoading}></button>
                  </div>
                  <div className="modal-body">
                    <p><strong>Reclamante:</strong> {selectedComplaint.user_name}</p>
                    <p><strong>Assunto:</strong> {selectedComplaint.subject}</p>
                    <div className="mb-3">
                      <label htmlFor="statusSelect" className="form-label">Status</label>
                      <select id="statusSelect" className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                        <option value="aberto">Aberto</option>
                        <option value="em análise">Em Análise</option>
                        <option value="fechado">Fechado</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label htmlFor="adminComment" className="form-label">Comentário do Administrador</label>
                      <textarea id="adminComment" className="form-control" rows="4" value={newAdminComment} onChange={(e) => setNewAdminComment(e.target.value)}></textarea>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={isLoading}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={isLoading}>
                      {isLoading ? "Salvando..." : "Salvar Alterações"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (view === "manage" && user.is_admin) {
    return (
      <div className="text-center">
        <h2>Gerenciamento de Moradores</h2>
        <p>Você está vendo os moradores do seu bloco.</p>
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Bloco</th>
                <th>Apto</th>
                <th>Função</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome || u.user_name}</td>
                  <td>{u.email}</td>
                  <td>{u.bloco}</td>
                  <td>{u.apartment}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin_bloco' ? 'bg-warning' : 'bg-info'}`}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-secondary mt-3" onClick={() => setView("menu")}>Voltar</button>
      </div>
    );
  }
  
  return <div className="text-center"><h2>Carregando...</h2></div>;
}