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
  const [activeApt, setActiveApt] = useState(user?.apartamentos?.[0] || null);
  const [view, setView] = useState("menu");
  
  // Estados de Listas
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(""); // Filtro para o Master

  // Estados para Reclamações
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para Gestão Administrativa
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminComment, setAdminComment] = useState("");

  // Redireciona se não houver usuário logado
  useEffect(() => {
    if (!user || !user.id) {
      navigate("/");
    }
  }, [user, navigate]);

  // --- BUSCA DE RECLAMAÇÕES (Com Filtro de Role) ---
  const fetchComplaints = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/complaints?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (res.ok) setComplaints(data);
    } catch (error) {
      console.error("Erro ao buscar reclamações:", error);
    }
  }, [user]);

  // --- BUSCA DE USUÁRIOS (Hierárquica) ---
  const fetchUsers = useCallback(async () => {
    if (user?.role !== 'sindico' && user?.role !== 'admin_bloco') return;
    try {
      const res = await fetch(`${API_URL}/api/users?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
  }, [user]);

  useEffect(() => {
    if (view === "list" || view === "stats" || view === "admin") fetchComplaints();
    if (view === "users") fetchUsers();
  }, [view, fetchComplaints, fetchUsers]);

  // --- GESTÃO DE RECLAMAÇÕES (Update Status/Ações) ---
  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/complaints/${selectedComplaint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus, 
          admin_comment: adminComment 
        }),
      });
      if (res.ok) {
        alert("Reclamação atualizada com sucesso!");
        setShowModal(false);
        fetchComplaints();
      }
    } catch (error) {
      alert("Erro ao atualizar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateComplaint = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          subject,
          description
        }),
      });
      if (res.ok) {
        alert("Reclamação registada!");
        setSubject("");
        setDescription("");
        setView("menu");
      }
    } catch (error) {
      alert("Erro ao enviar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const BackButton = () => (
    <button className="btn btn-outline-secondary mb-3" onClick={() => { setView("menu"); setSelectedBlock(""); }}>
      ← Voltar
    </button>
  );

  // --- VIEW: MENU PRINCIPAL ---
  if (view === "menu") {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Olá, {user?.nome}!</h2>
          <button className="btn btn-outline-danger" onClick={handleLogout}>Sair</button>
        </div>
        
        <div className="card p-3 mb-4 bg-light shadow-sm">
          <div className="row align-items-center">
            <div className="col-md-6">
              <p className="mb-1"><strong>Perfil:</strong> {user?.role === 'sindico' ? 'Síndico Geral' : user?.role === 'admin_bloco' ? 'Admin de Bloco' : 'Morador'}</p>
            </div>
            {user?.apartamentos?.length > 1 && (
              <div className="col-md-6 text-md-end">
                <label className="me-2 fw-bold">Apartamento Ativo:</label>
                <select 
                  className="form-select form-select-sm d-inline-block w-auto"
                  value={JSON.stringify(activeApt)}
                  onChange={(e) => setActiveApt(JSON.parse(e.target.value))}
                >
                  {user.apartamentos.map((apt, idx) => (
                    <option key={idx} value={JSON.stringify(apt)}>
                      Bloco {apt.numero_bloco} - Ap {apt.numero_apartamento}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="row g-3">
          <div className="col-md-6">
            <button className="btn btn-primary w-100 py-3" onClick={() => setView("new")}> Nova Reclamação </button>
          </div>
          <div className="col-md-6">
            <button className="btn btn-secondary w-100 py-3" onClick={() => setView("list")}> Minhas Reclamações </button>
          </div>
          
          {(user?.role === 'sindico' || user?.role === 'admin_bloco') && (
            <>
              <div className="col-md-6">
                <button className="btn btn-dark w-100 py-3" onClick={() => setView("users")}> Gerenciar Moradores </button>
              </div>
              <div className="col-md-6">
                <button className="btn btn-dark w-100 py-3" onClick={() => setView("admin")}> Gerenciar Reclamações </button>
              </div>
              <div className="col-md-12">
                <button className="btn btn-info w-100 py-3" onClick={() => setView("stats")}> Estatísticas </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- VIEW: NOVA RECLAMAÇÃO (Com Dropdown de Assunto) ---
  if (view === "new") {
    return (
      <div className="container mt-4">
        <BackButton />
        <h3>Nova Reclamação</h3>
        <form onSubmit={handleCreateComplaint} className="card p-4 shadow-sm">
          <label className="fw-bold mb-1">Assunto:</label>
          <select 
            className="form-select mb-3" 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)} 
            required
          >
            <option value="">Selecione um motivo...</option>
            <option value="Cobrança">Cobrança</option>
            <option value="Barulho">Barulho</option>
            <option value="Limpeza">Limpeza</option>
            <option value="Encomendas">Encomendas</option>
            <option value="Serviços">Serviços</option>
          </select>

          <label className="fw-bold mb-1">Descrição:</label>
          <textarea 
            className="form-control mb-3" 
            placeholder="Detalhe o ocorrido..." 
            rows="4" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            required 
          />
          <button type="submit" className="btn btn-success w-100" disabled={isSubmitting}>
            {isSubmitting ? "A enviar..." : "Registrar Reclamação"}
          </button>
        </form>
      </div>
    );
  }

  // --- VIEW: GERENCIAR MORADORES ---
  if (view === "users") {
    const filteredUsers = selectedBlock 
      ? users.filter(u => String(u.numero_bloco) === selectedBlock)
      : users;

    return (
      <div className="container mt-4">
        <BackButton />
        <h3>Moradores</h3>
        
        {user.role === 'sindico' && (
          <div className="card p-3 mb-3 bg-light">
            <label className="fw-bold mb-1">Filtrar por Bloco:</label>
            <select className="form-select" value={selectedBlock} onChange={(e) => setSelectedBlock(e.target.value)}>
              <option value="">Todos os Blocos</option>
              {[...Array(41).keys()].map(i => <option key={i} value={i}>Bloco {i}</option>)}
            </select>
          </div>
        )}

        <div className="table-responsive card shadow-sm">
          <table className="table table-hover mb-0">
            <thead className="table-dark">
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Bloco</th>
                <th>Apto</th>
                <th>Cargo</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.morador_id}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.numero_bloco}</td>
                  <td>{u.numero_apartamento}</td>
                  <td><span className="badge bg-secondary">{u.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- VIEW: LISTA / ADMINISTRAÇÃO DE RECLAMAÇÕES ---
  if (view === "list" || view === "admin") {
    return (
      <div className="container mt-4">
        <BackButton />
        <h3>{view === "list" ? "Minhas Reclamações" : "Gestão de Reclamações"}</h3>
        <div className="table-responsive card shadow-sm mt-3">
          <table className="table table-striped mb-0">
            <thead className="table-dark">
              <tr>
                <th>Data</th>
                <th>Assunto</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>{c.subject}</td>
                  <td><span className={`badge bg-${c.status === 'Resolvido' ? 'success' : 'warning'}`}>{c.status}</span></td>
                  <td>
                    <button className="btn btn-sm btn-info" onClick={() => {
                      setSelectedComplaint(c);
                      setNewStatus(c.status);
                      setAdminComment(c.admin_comment || "");
                      setShowModal(true);
                    }}>Ver Detalhes</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal de Detalhes e Ações (Simulado com uma div condicional para simplicidade) */}
        {showModal && selectedComplaint && (
          <div className="modal-backdrop show"></div>
          /* Recomendo usar um componente Modal do Bootstrap aqui. 
             Para simplificar, pode-se usar um alert ou uma view dedicada. */
        )}
      </div>
    );
  }

  return <div className="text-center mt-5">A carregar dashboard...</div>;
}