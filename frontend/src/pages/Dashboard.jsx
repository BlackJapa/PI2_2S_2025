import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // --- PERSISTÊNCIA E CARREGAMENTO DE DADOS ---
  const getInitialUser = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) return JSON.parse(savedUser);
    return location.state || null;
  };

  const [user, setUser] = useState(getInitialUser());
  const [view, setView] = useState("menu");
  const [activeApt] = useState(user?.apartamento || user?.apartamentos?.[0] || null);

  // Estados de Listas
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Estados para Novas Reclamações
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  
  // Estados para Gestão Administrativa (Modais)
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminComment, setAdminComment] = useState("");

  // Lógica de Permissões
  const userRole = user?.role?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
  const isAdmin = userRole === 'sindico' || userRole === 'admin_bloco';

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  // --- COMUNICAÇÃO COM O BACKEND ---
  const fetchComplaints = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/complaints?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setComplaints(data);
    } catch (err) { console.error("Erro Reclamações:", err); }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_URL}/api/users?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) { console.error("Erro Usuários:", err); }
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    fetchComplaints();
    if (isAdmin) fetchUsers();
  }, [user, navigate, fetchComplaints, fetchUsers, isAdmin]);

  // --- PROCESSAMENTO DE DADOS PARA GRÁFICOS NATIVOS ---
  const getCategoryData = () => {
    const stats = {};
    complaints.forEach(c => { stats[c.subject] = (stats[c.subject] || 0) + 1; });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]); // Ordena do maior para o menor
  };

  const getStatusCount = (statusName) => {
    return complaints.filter(c => c.status === statusName).length;
  };

  if (!user) return null;

  return (
    <div className="container py-4">
      {/* Cabeçalho de Identificação */}
      <div className="card mb-4 shadow-sm border-0 bg-light">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div>
            <h4 className="mb-1 text-primary">Bem-vindo, {user.nome}</h4>
            {activeApt && (
              <p className="mb-0 text-muted small">
                Bloco {activeApt.numero_bloco} — Apto {activeApt.numero_apartamento}
              </p>
            )}
            <span className="badge bg-dark mt-1">Cargo: {user.role}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">Sair</button>
        </div>
      </div>

      {/* Navegação Superior */}
      <div className="btn-group w-100 mb-4 shadow-sm">
        <button className={`btn ${view === 'menu' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("menu")}>Início</button>
        <button className={`btn ${view === 'registrar' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("registrar")}>Nova Ocorrência</button>
        <button className={`btn ${view === 'visualizar' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView("visualizar")}>Histórico</button>
        {isAdmin && (
          <button className={`btn ${view === 'analise' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setView("analise")}>📊 Análise</button>
        )}
      </div>

      {/* VIEW: MENU INICIAL */}
      {view === "menu" && (
        <div className="row">
          <div className="col-md-6 mb-3">
            <div className="card p-4 shadow-sm h-100">
              <h5>Resumo do Condomínio</h5>
              <p className="text-muted">Você tem {complaints.length} ocorrências registradas no total.</p>
              <button className="btn btn-primary w-100 mt-auto" onClick={() => setView("visualizar")}>Ver Detalhes</button>
            </div>
          </div>
          {isAdmin && (
            <div className="col-md-6 mb-3">
              <div className="card p-4 shadow-sm h-100 border-success">
                <h5 className="text-success">Gestão Administrativa</h5>
                <p className="text-muted">Total de moradores cadastrados: {users.length}</p>
                <div className="alert alert-success py-2 small">Aba de estatísticas liberada.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: REGISTRAR NOVA OCORRÊNCIA */}
      {view === "registrar" && (
        <div className="card p-4 shadow-sm">
          <h5 className="mb-4">Registrar Ocorrência</h5>
          <form onSubmit={(e) => { e.preventDefault(); /* Adicione seu fetch de POST aqui */ }}>
            <label className="form-label fw-bold">Assunto</label>
            <select className="form-select mb-3" value={subject} onChange={(e) => setSubject(e.target.value)} required>
              <option value="">Selecione...</option>
              <option value="Barulho">Barulho</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Limpeza">Limpeza</option>
              <option value="Outros">Outros</option>
            </select>
            <textarea className="form-control mb-3" rows="4" placeholder="Descrição..." value={description} onChange={(e) => setDescription(e.target.value)} required />
            <button className="btn btn-primary w-100">Enviar</button>
          </form>
        </div>
      )}

      {/* VIEW: HISTÓRICO / TABELA */}
      {view === "visualizar" && (
        <div className="table-responsive card shadow-sm p-3 border-0">
          <table className="table table-hover">
            <thead className="table-light">
              <tr>
                {isAdmin && <th>Morador</th>}
                <th>Assunto</th>
                <th>Status</th>
                <th>Ações</th>
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
                  <td>
                    <button className="btn btn-sm btn-info text-white" onClick={() => {
                      setSelectedComplaint(c);
                      setShowModal(true);
                    }}>Detalhes</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="text-center py-3">Nenhum dado encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW: ANÁLISE DE DADOS (NATIVA SEM BIBLIOTECAS) */}
      {view === "analise" && isAdmin && (
        <div className="row">
          
          {/* Gráfico Nativo de Categorias */}
          <div className="col-lg-8 mb-4">
            <div className="card shadow-sm p-4 h-100 border-0">
              <h5 className="mb-4 text-primary">Ocorrências por Categoria</h5>
              {complaints.length === 0 ? (
                <p className="text-muted">Sem dados suficientes.</p>
              ) : (
                getCategoryData().map(([tipo, quantidade], index) => {
                  const maxCount = Math.max(...getCategoryData().map(d => d[1]));
                  const percent = (quantidade / maxCount) * 100;
                  
                  return (
                    <div key={index} className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="fw-bold">{tipo}</span>
                        <span className="text-muted">{quantidade} registo(s)</span>
                      </div>
                      <div className="progress" style={{ height: '25px', borderRadius: '6px' }}>
                        <div 
                          className={`progress-bar ${index % 2 === 0 ? 'bg-primary' : 'bg-info'}`} 
                          style={{ width: `${percent}%` }}
                        >
                          {quantidade}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Resumo de Status Nativo */}
          <div className="col-lg-4 mb-4">
            <div className="card shadow-sm p-4 h-100 border-0 bg-light">
              <h5 className="mb-4 text-dark">Status Geral</h5>
              
              <div className="card border-warning mb-3">
                <div className="card-body d-flex justify-content-between align-items-center">
                  <span className="fw-bold text-warning">Pendentes</span>
                  <span className="badge bg-warning text-dark fs-5">{getStatusCount('Pendente')}</span>
                </div>
              </div>

              <div className="card border-info mb-3">
                <div className="card-body d-flex justify-content-between align-items-center">
                  <span className="fw-bold text-info">Em Análise</span>
                  <span className="badge bg-info text-white fs-5">{getStatusCount('Em Análise')}</span>
                </div>
              </div>

              <div className="card border-success">
                <div className="card-body d-flex justify-content-between align-items-center">
                  <span className="fw-bold text-success">Resolvidos</span>
                  <span className="badge bg-success fs-5">{getStatusCount('Resolvido')}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES (Com restrição de comentários para admins) */}
      {showModal && selectedComplaint && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detalhes da Ocorrência</h5>
                <button className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <p><strong>Assunto:</strong> {selectedComplaint.subject}</p>
                <p><strong>Descrição:</strong> {selectedComplaint.description}</p>
                
                {/* Apenas administradores podem alterar o status e comentar */}
                {isAdmin ? (
                   <div className="mt-3 bg-light p-3 rounded">
                     <label className="form-label fw-bold">Atualizar Status</label>
                     <select className="form-select mb-3" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                        <option value="Pendente">Pendente</option>
                        <option value="Em Análise">Em Análise</option>
                        <option value="Resolvido">Resolvido</option>
                     </select>
                     <label className="form-label fw-bold">Comentário do Síndico</label>
                     <textarea className="form-control" rows="2" value={adminComment} onChange={(e) => setAdminComment(e.target.value)}></textarea>
                   </div>
                ) : (
                  <div className="mt-3 bg-light p-3 rounded">
                    <p><strong>Status Atual:</strong> <span className="badge bg-primary">{selectedComplaint.status}</span></p>
                    <p className="mb-0"><strong>Resposta do Síndico:</strong> {selectedComplaint.admin_comment || "Nenhuma resposta ainda."}</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Fechar</button>
                {isAdmin && <button className="btn btn-success">Salvar</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}