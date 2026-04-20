import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

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
  const [view, setView] = useState("menu");
  const [complaints, setComplaints] = useState([]);
  const [activeApt] = useState(() => {
    const u = getInitialUser();
    return u?.apartamento || u?.apartamentos?.[0] || null;
  });

  // CORREÇÃO: Verificação de admin insensível a maiúsculas/acentos
  const userRole = user?.role?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
  const isAdmin = userRole === 'sindico' || userRole === 'admin_bloco';

  const fetchComplaints = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/complaints?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setComplaints(data);
    } catch (err) { console.error("Erro ao carregar dados:", err); }
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    fetchComplaints();
  }, [user, navigate, fetchComplaints]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const getChartData = () => {
    const stats = {};
    complaints.forEach(c => {
      stats[c.subject] = (stats[c.subject] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  if (!user) return null;

  return (
    <div className="container py-4">
      {/* Cabeçalho de Identificação */}
      <div className="card mb-4 shadow-sm border-0 bg-light">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div>
            <h4 className="mb-1 text-primary">Olá, {user.nome}</h4>
            {activeApt && (
              <p className="mb-0 text-muted small">
                <strong>Local:</strong> Bloco {activeApt.numero_bloco} - Apto {activeApt.numero_apartamento}
              </p>
            )}
            <span className="badge bg-primary mt-1">Perfil: {user.role}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">Sair</button>
        </div>
      </div>

      {/* Navegação Principal */}
      <div className="btn-group w-100 mb-4 shadow-sm">
        <button className={`btn ${view === 'menu' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("menu")}>Início</button>
        <button className={`btn ${view === 'visualizar' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("visualizar")}>Histórico</button>
        {isAdmin && (
          <button className={`btn ${view === 'analise' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setView("analise")}>📊 Análise de Dados</button>
        )}
      </div>

      {/* VIEW: MENU (Página Inicial / Resumo) */}
      {view === "menu" && (
        <div className="row text-center">
          <div className="col-md-4 mb-3">
            <div className="card p-3 shadow-sm border-primary">
              <h6>Suas Ocorrências</h6>
              <h2 className="text-primary">{isAdmin ? complaints.length : complaints.filter(c => c.user_id === user.id).length}</h2>
            </div>
          </div>
          <div className="col-md-8 mb-3 text-start">
            <div className="card p-4 shadow-sm">
              <h5>Bem-vindo ao Condomínio Transparente</h5>
              <p className="text-muted">Utilize o menu acima para registar novas ocorrências ou verificar o status das reclamações existentes.</p>
              {isAdmin && <div className="alert alert-info py-2">Você possui privilégios de administrador. A aba de análise está disponível.</div>}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: VISUALIZAR */}
      {view === "visualizar" && (
        <div className="table-responsive card shadow-sm p-3 border-0">
          <table className="table table-hover">
            <thead className="table-light">
              <tr>
                {isAdmin && <th>Morador</th>}
                <th>Assunto</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length > 0 ? complaints.map(c => (
                <tr key={c.id}>
                  {isAdmin && (
                    <td>
                      <div className="fw-bold">{c.morador_nome}</div>
                      <small className="text-muted">B{c.numero_bloco} - Ap{c.numero_apartamento}</small>
                    </td>
                  )}
                  <td>{c.subject}</td>
                  <td><span className={`badge ${c.status === 'Resolvido' ? 'bg-success' : 'bg-warning text-dark'}`}>{c.status}</span></td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="text-center py-4">Nenhuma ocorrência registada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW: ANÁLISE (Gráficos) */}
      {view === "analise" && isAdmin && (
        <div className="row">
          <div className="col-12 mb-4">
            <div className="card shadow-sm p-4 border-0">
              <h5 className="mb-4 text-success">Ocorrências por Categoria</h5>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip cursor={{fill: '#f8f9fa'}} />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                      {getChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#0d6efd' : '#198754'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}