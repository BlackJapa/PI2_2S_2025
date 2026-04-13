import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // --- CORREÇÃO PARTE 3: BUSCA DE DADOS DO USUÁRIO ---
  // Tentamos pegar do localStorage para evitar que os dados sumam no F5
  const getInitialUser = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) return JSON.parse(savedUser);
    return location.state || null;
  };

  const [user, setUser] = useState(getInitialUser());
  const [view, setView] = useState("menu");
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Estados para formulários e modais
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [newAdminComment, setNewAdminComment] = useState("");

  // Redireciona se não houver usuário logado
  useEffect(() => {
    if (!user || !user.id) {
      navigate("/");
    }
  }, [user, navigate]);

  // --- BUSCA DE RECLAMAÇÕES (Sem Token) ---
  const fetchComplaints = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Passamos o user_id e role via Query String para o backend filtrar
      const res = await fetch(`${API_URL}/api/complaints?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (res.ok) setComplaints(data);
    } catch (error) {
      console.error("Erro ao buscar reclamações:", error);
    }
  }, [user]);

  // --- BUSCA DE USUÁRIOS (Apenas para Admins) ---
  const fetchUsers = useCallback(async () => {
    if (user?.role !== 'sindico' && user?.role !== 'admin_bloco') return;
    try {
      const res = await fetch(`${API_URL}/api/users`);
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
  }, [user]);

  useEffect(() => {
    if (view === "list" || view === "stats") fetchComplaints();
    if (view === "admin") fetchUsers();
  }, [view, fetchComplaints, fetchUsers]);

  // --- CRIAR RECLAMAÇÃO ---
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
        alert("Reclamação enviada!");
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

  // --- LOGOUT ---
  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  // --- RENDERIZAÇÃO DO MENU PRINCIPAL ---
  if (view === "menu") {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Olá, {user?.nome}!</h2>
          <button className="btn btn-outline-danger" onClick={handleLogout}>Sair</button>
        </div>
        
        <div className="card p-3 mb-4 bg-light">
          <p className="mb-1"><strong>Bloco:</strong> {user?.bloco} | <strong>Apartamento:</strong> {user?.apartment}</p>
          <p className="mb-0"><strong>Perfil:</strong> {user?.role === 'sindico' ? 'Síndico Geral' : user?.role === 'admin_bloco' ? 'Admin de Bloco' : 'Morador'}</p>
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
                <button className="btn btn-dark w-100 py-3" onClick={() => setView("admin")}> Gerenciar Condomínio </button>
              </div>
              <div className="col-md-6">
                <button className="btn btn-info w-100 py-3" onClick={() => setView("stats")}> Estatísticas </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO DE NOVA RECLAMAÇÃO ---
  if (view === "new") {
    return (
      <div className="container mt-4">
        <h3>Nova Reclamação</h3>
        <form onSubmit={handleCreateComplaint}>
          <input 
            className="form-control mb-3" 
            placeholder="Assunto" 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)} 
            required 
          />
          <textarea 
            className="form-control mb-3" 
            placeholder="Descrição detalhada" 
            rows="4" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            required 
          />
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-success" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setView("menu")}>Voltar</button>
          </div>
        </form>
      </div>
    );
  }

  // --- RENDERIZAÇÃO DA LISTA DE RECLAMAÇÕES ---
  if (view === "list") {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3>{user.role === 'morador' ? 'Minhas Reclamações' : 'Gerenciar Reclamações'}</h3>
          <button className="btn btn-secondary" onClick={() => setView("menu")}>Voltar</button>
        </div>
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
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
                  <td>
                    <span className={`badge bg-${c.status === 'Resolvido' ? 'success' : 'warning'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-info" onClick={() => {
                      setSelectedComplaint(c);
                      setShowModal(true);
                    }}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return <div className="text-center mt-5">Carregando dados do dashboard...</div>;
}