import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialUser = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) return JSON.parse(savedUser);
    return location.state || null;
  };

  const [user, setUser] = useState(getInitialUser());

  // BUG CORRIGIDO: estado 'view' estava comentado mas era usado em todo o componente
  const [view, setView] = useState("menu");

  // Suporte a múltiplos apartamentos
  const [activeApt, setActiveApt] = useState(() => {
    const u = getInitialUser();
    return u?.apartamento || u?.apartamentos?.[0] || null;
  });

  // Estados de listas
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);

  // Estados para reclamações
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para modal de detalhes
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminComment, setAdminComment] = useState("");

  // Estados para vincular novo apartamento
  const [showLinkApt, setShowLinkApt] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [linkBloco, setLinkBloco] = useState("");
  const [linkApartamento, setLinkApartamento] = useState("");
  const [availableApts, setAvailableApts] = useState([]);
  const [linkMsg, setLinkMsg] = useState({ type: "", text: "" });
  const [isLinking, setIsLinking] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  // Atualiza o apartamento ativo e persiste no localStorage
  const handleSwitchApt = (apt) => {
    setActiveApt(apt);
    const updated = { ...user, apartamento: apt };
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
  };

  // --- FETCH DE DADOS ---
  const fetchComplaints = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/complaints?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setComplaints(data);
    } catch (err) {
      console.error("Erro ao carregar reclamações:", err);
    }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (user?.role === 'morador') return;
    try {
      const res = await fetch(`${API_URL}/api/users?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    fetchComplaints();
    if (user.role !== 'morador') fetchUsers();
  }, [user, navigate, fetchComplaints, fetchUsers]);

  // Carrega blocos quando abre o painel de vincular apartamento
  useEffect(() => {
    if (showLinkApt && blocks.length === 0) {
      fetch(`${API_URL}/api/blocks`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setBlocks(d); })
        .catch(() => {});
    }
  }, [showLinkApt]);

  // Carrega apartamentos ao escolher bloco
  useEffect(() => {
    if (linkBloco) {
      setLinkApartamento("");
      fetch(`${API_URL}/api/blocks/${linkBloco}/apartments`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setAvailableApts(d); })
        .catch(() => setAvailableApts([]));
    } else {
      setAvailableApts([]);
    }
  }, [linkBloco]);

  // --- ENVIAR RECLAMAÇÃO ---
  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, subject, description })
      });
      if (res.ok) {
        alert("Reclamação enviada!");
        setSubject("");
        setDescription("");
        setView("visualizar");
        fetchComplaints();
      }
    } catch (err) {
      alert("Erro ao enviar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ATUALIZAR STATUS (admin) ---
  const handleUpdateStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/complaints/${selectedComplaint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_comment: adminComment })
      });
      if (res.ok) {
        setShowModal(false);
        fetchComplaints();
      }
    } catch (err) {
      alert("Erro ao atualizar.");
    }
  };

  // --- VINCULAR NOVO APARTAMENTO ---
  const handleLinkApartment = async (e) => {
    e.preventDefault();
    setIsLinking(true);
    setLinkMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API_URL}/api/apartments/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ morador_id: user.id, bloco: linkBloco, apartamento: linkApartamento })
      });
      const data = await res.json();
      if (res.ok) {
        setLinkMsg({ type: "success", text: "Apartamento vinculado com sucesso!" });
        // Atualiza a lista localmente
        const updatedApts = [...(user.apartamentos || []), data];
        const updatedUser = { ...user, apartamentos: updatedApts };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setLinkBloco("");
        setLinkApartamento("");
        setTimeout(() => setShowLinkApt(false), 1500);
      } else {
        setLinkMsg({ type: "error", text: data.error || "Erro ao vincular." });
      }
    } catch (err) {
      setLinkMsg({ type: "error", text: "Erro de conexão." });
    } finally {
      setIsLinking(false);
    }
  };

  if (!user) return null;

  const apartamentos = user.apartamentos || (user.apartamento ? [user.apartamento] : []);

  return (
    <div className="container py-4">

      {/* Cabeçalho */}
      <div className="card mb-4 shadow-sm border-0">
        <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h4 className="mb-1 text-primary">Olá, {user?.nome || "Utilizador"}</h4>
            {activeApt ? (
              <p className="mb-0 text-muted">
                <strong>Apartamento ativo:</strong> {activeApt.numero_apartamento} —{" "}
                <strong>Bloco:</strong> {activeApt.numero_bloco}
              </p>
            ) : (
              <p className="mb-0 text-danger small">Nenhum apartamento vinculado.</p>
            )}
            <span className="badge bg-light text-dark border mt-1">Perfil: {user?.role}</span>
          </div>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            {/* Seletor de apartamentos (caso tenha mais de um) */}
            {apartamentos.length > 1 && (
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={activeApt?.apartamento_id || ""}
                onChange={(e) => {
                  const apt = apartamentos.find(a => String(a.apartamento_id) === e.target.value);
                  if (apt) handleSwitchApt(apt);
                }}
              >
                {apartamentos.map((a) => (
                  <option key={a.apartamento_id} value={a.apartamento_id}>
                    Bloco {a.numero_bloco} — Apto {a.numero_apartamento}
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setShowLinkApt(!showLinkApt)}
              title="Vincular outro apartamento"
            >
              + Apartamento
            </button>
            <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">Sair</button>
          </div>
        </div>

        {/* Painel de vincular novo apartamento */}
        {showLinkApt && (
          <div className="card-footer bg-light">
            <p className="fw-bold mb-2 small">Vincular novo apartamento</p>
            <form onSubmit={handleLinkApartment} className="d-flex gap-2 flex-wrap align-items-end">
              <div>
                <label className="form-label small mb-1">Bloco</label>
                <select
                  className="form-select form-select-sm"
                  value={linkBloco}
                  onChange={(e) => setLinkBloco(e.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {blocks.map(b => (
                    <option key={b.bloco_id} value={b.numero_bloco}>Bloco {b.numero_bloco}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label small mb-1">Apartamento</label>
                <select
                  className="form-select form-select-sm"
                  value={linkApartamento}
                  onChange={(e) => setLinkApartamento(e.target.value)}
                  required
                  disabled={!linkBloco}
                >
                  <option value="">Selecione</option>
                  {availableApts.map((a, i) => (
                    <option key={i} value={a.numero_apartamento}>Apto {a.numero_apartamento}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={isLinking}>
                {isLinking ? "Vinculando..." : "Vincular"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setShowLinkApt(false)}>
                Cancelar
              </button>
            </form>
            {linkMsg.text && (
              <div className={`alert ${linkMsg.type === 'error' ? 'alert-danger' : 'alert-success'} mt-2 py-2 mb-0 small`}>
                {linkMsg.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navegação Principal */}
      <div className="btn-group w-100 mb-4 shadow-sm">
        <button className={`btn ${view === 'menu' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("menu")}>Menu</button>
        <button className={`btn ${view === 'registrar' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("registrar")}>Nova Reclamação</button>
        <button className={`btn ${view === 'visualizar' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("visualizar")}>Ver Histórico</button>
        {user.role !== 'morador' && (
          <button className={`btn ${view === 'admin' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("admin")}>Gestão</button>
        )}
      </div>

      {/* Vista: Menu */}
      {view === "menu" && (
        <div className="row g-3">
          <div className="col-md-4">
            <div className="card text-center p-3 shadow-sm h-100" role="button" onClick={() => setView("registrar")}>
              <div className="fs-1">📝</div>
              <h6 className="mt-2">Nova Reclamação</h6>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card text-center p-3 shadow-sm h-100" role="button" onClick={() => setView("visualizar")}>
              <div className="fs-1">📋</div>
              <h6 className="mt-2">Ver Histórico</h6>
            </div>
          </div>
          {user.role !== 'morador' && (
            <div className="col-md-4">
              <div className="card text-center p-3 shadow-sm h-100" role="button" onClick={() => setView("admin")}>
                <div className="fs-1">⚙️</div>
                <h6 className="mt-2">Gestão</h6>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vista: Registrar Reclamação */}
      {view === "registrar" && (
        <div className="card p-4 shadow-sm">
          <h5 className="mb-4">Registrar Ocorrência</h5>
          <form onSubmit={handleSubmitComplaint}>
      
            {/* NOVO: Menu de Seleção de Assuntos */}
              <label className="form-label fw-bold">Assunto da Ocorrência</label>
              <select 
                className="form-select mb-3" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                required
              >
                <option value="">Selecione um assunto...</option>
                <option value="Barulho">Barulho / Perturbação</option>
                <option value="Manutenção">Manutenção / Reparos</option>
                <option value="Limpeza">Limpeza das Áreas Comuns</option>
                <option value="Segurança">Segurança / Portaria</option>
                <option value="Vaga de Garagem">Vaga de Garagem</option>
                <option value="Convivência">Convivência / Vizinhos</option>
                <option value="Outros">Outros (especificar na descrição)</option>
              </select>

              <label className="form-label fw-bold">Descrição Detalhada</label>
              <textarea 
                className="form-control mb-3" 
                rows="4" 
                placeholder="Descreva aqui o que aconteceu..." 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                required
              ></textarea>
      
              <button 
                className="btn btn-primary w-100" 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Enviando..." : "Enviar Reclamação"}
              </button>
            </form>
          </div>
      )}

      {/* Vista: Histórico */}
      {view === "visualizar" && (
        <div className="table-responsive">
          <table className="table table-hover shadow-sm bg-white rounded">
            <thead className="table-light">
              <tr>
                <th>Data</th>
                <th>Assunto</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length > 0 ? complaints.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{c.subject}</td>
                  <td>
                    <span className={`badge ${c.status === 'Resolvido' ? 'bg-success' : c.status === 'Em Análise' ? 'bg-info' : 'bg-warning text-dark'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-info text-white" onClick={() => {
                      setSelectedComplaint(c);
                      setNewStatus(c.status);
                      setAdminComment(c.admin_comment || "");
                      setShowModal(true);
                    }}>Detalhes</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="text-center py-4 text-muted">Nenhuma reclamação encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista: Gestão (admin/síndico) */}
      {view === "admin" && (
        <div className="table-responsive">
          <h5 className="mb-3">Gestão de Moradores</h5>
          <table className="table table-hover shadow-sm bg-white rounded">
            <thead className="table-light">
              <tr><th>Nome</th><th>E-mail</th><th>Bloco</th><th>Apto</th><th>Perfil</th></tr>
            </thead>
            <tbody>
              {users.length > 0 ? users.map((u) => (
                <tr key={u.morador_id}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.numero_bloco || "—"}</td>
                  <td>{u.numero_apartamento || "—"}</td>
                  <td><span className="badge bg-secondary">{u.role}</span></td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="text-center py-4 text-muted">Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalhes */}
      {showModal && selectedComplaint && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="card w-75 shadow-lg" style={{ maxWidth: '600px' }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Detalhes da Reclamação</h5>
              <button className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="card-body">
              <p><strong>Assunto:</strong> {selectedComplaint.subject}</p>
              <p><strong>Descrição:</strong> {selectedComplaint.description}</p>
              <hr />
              {user.role !== 'morador' ? (
                <>
                  <label className="form-label fw-bold">Alterar Status</label>
                  <select className="form-select mb-3" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    <option value="Pendente">Pendente</option>
                    <option value="Em Análise">Em Análise</option>
                    <option value="Resolvido">Resolvido</option>
                  </select>
                  <label className="form-label fw-bold">Ações Tomadas / Comentário</label>
                  <textarea className="form-control mb-3" rows="3" value={adminComment} onChange={(e) => setAdminComment(e.target.value)}></textarea>
                  <button className="btn btn-success w-100" onClick={handleUpdateStatus}>Salvar Alterações</button>
                </>
              ) : (
                <div className="bg-light p-3 rounded">
                  <p><strong>Status Atual:</strong> <span className="badge bg-primary">{selectedComplaint.status}</span></p>
                  <p className="mb-0"><strong>Resposta:</strong> {selectedComplaint.admin_comment || "Aguardando resposta..."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}