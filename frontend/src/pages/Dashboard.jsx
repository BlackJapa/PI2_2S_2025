import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // --- BUSCA DE DADOS DO USUÁRIO E PERSISTÊNCIA ---
  const getInitialUser = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) return JSON.parse(savedUser);
    return location.state || null;
  };

  const [user, setUser] = useState(getInitialUser());
  // Proteção: Garante que activeApt comece como null se não houver dados
  //const [activeApt, setActiveApt] = useState(user?.apartamentos?.[0] || null);
  //const [view, setView] = useState("menu");
  const [activeApt, setActiveApt] = useState(user?.apartamento || null);
  
  // Estados de Listas
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(""); 

  // Estados para Reclamações
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para Gestão Administrativa
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminComment, setAdminComment] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  // --- FUNÇÕES DE BUSCA (FETCH) ---
  const fetchComplaints = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/complaints?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setComplaints(data);
      }
    } catch (err) {
      console.error("Erro ao carregar reclamações:", err);
    }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (user?.role === 'morador') return;
    try {
      const res = await fetch(`${API_URL}/api/users?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    fetchComplaints();
    if (user.role !== 'morador') fetchUsers();
  }, [user, navigate, fetchComplaints, fetchUsers]);

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          subject,
          description
        })
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

  // --- COMPONENTES DE INTERFACE ---
  if (!user) return null;

  return (
    <div className="container py-4">
      {/* Cabeçalho de Identificação - BLINDADO contra Null */}
      <div className="card mb-4 shadow-sm border-0">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div>
            <h4 className="mb-1 text-primary">Olá, {user?.nome || "Utilizador"}</h4>
            {activeApt ? (
              <p className="mb-0 text-muted">
                <strong>Apartamento:</strong> {activeApt?.numero_apartamento} — 
                <strong> Bloco:</strong> {activeApt?.numero_bloco}
              </p>
            ) : (
              <p className="mb-0 text-danger small">Nenhum apartamento vinculado.</p>
            )}
            <span className="badge bg-light text-dark border mt-1">Perfil: {user?.role}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">Sair</button>
        </div>
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

      {/* Vistas Condicionais */}
      {view === "registrar" && (
        <div className="card p-4 shadow-sm">
          <h5 className="mb-4">Registrar Ocorrência</h5>
          <form onSubmit={handleSubmitComplaint}>
            <input className="form-control mb-3" placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            <textarea className="form-control mb-3" rows="4" placeholder="Descrição detalhada..." value={description} onChange={(e) => setDescription(e.target.value)} required></textarea>
            <button className="btn btn-primary w-100" disabled={isSubmitting}>{isSubmitting ? "Enviando..." : "Enviar Reclamação"}</button>
          </form>
        </div>
      )}

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
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>{c.subject}</td>
                  <td>
                    <span className={`badge ${c.status === 'Resolvido' ? 'bg-success' : 'bg-warning text-dark'}`}>
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
                <tr><td colSpan="4" className="text-center py-4">Nenhuma reclamação encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalhes (Versão Simplificada Integrada) */}
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
                  <p><strong>Resposta da Administração:</strong> {selectedComplaint.admin_comment || "Aguardando resposta..."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}