import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  LineChart, Line
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || '';
const STATUS_COLORS = { "Pendente": "#f59e0b", "Em Análise": "#3b82f6", "Resolvido": "#10b981" };
const BAR_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"];

// --- EXPORTAÇÃO ---
const exportToExcel = (complaints, isAdmin) => {
  import('xlsx').then(XLSX => {
    const rows = complaints.map(c => ({
      ...(isAdmin ? { Morador: c.morador_nome, Bloco: c.numero_bloco, Apartamento: c.numero_apartamento } : {}),
      Assunto: c.subject,
      Descrição: c.description,
      Status: c.status,
      'Resposta do Síndico': c.admin_comment || '',
      Data: new Date(c.created_at).toLocaleDateString('pt-BR'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ocorrências');
    XLSX.writeFile(wb, 'ocorrencias.xlsx');
  });
};

const exportToPDF = (complaints, isAdmin) => {
  import('jspdf').then(({ default: jsPDF }) => {
    import('jspdf-autotable').then(() => {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Relatório de Ocorrências', 14, 18);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 26);

      const head = isAdmin
        ? [['Morador', 'Bloco', 'Apto', 'Assunto', 'Status', 'Data']]
        : [['Assunto', 'Status', 'Resposta', 'Data']];

      const body = complaints.map(c => isAdmin
        ? [c.morador_nome, c.numero_bloco, c.numero_apartamento, c.subject, c.status, new Date(c.created_at).toLocaleDateString('pt-BR')]
        : [c.subject, c.status, c.admin_comment || '—', new Date(c.created_at).toLocaleDateString('pt-BR')]
      );

      doc.autoTable({ head, body, startY: 32, styles: { fontSize: 9 }, headStyles: { fillColor: [99, 102, 241] } });
      doc.save('ocorrencias.pdf');
    });
  });
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: "#1e1b4b", border: "1px solid #4338ca", borderRadius: 8, padding: "8px 14px" }}>
        <p style={{ color: "#a5b4fc", margin: 0, fontSize: 12 }}>{label}</p>
        <p style={{ color: "#fff", margin: 0, fontWeight: 700 }}>{payload[0].value} ocorrência(s)</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialUser = () => {
    const saved = localStorage.getItem("user");
    if (saved) return JSON.parse(saved);
    return location.state || null;
  };

  const [user, setUser] = useState(getInitialUser);
  const [view, setView] = useState("menu");
  const [activeApt, setActiveApt] = useState(() => {
    const u = getInitialUser();
    return u?.apartamento || u?.apartamentos?.[0] || null;
  });

  // Listas principais
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);

  // Reclamação
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de detalhes
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminComment, setAdminComment] = useState("");

  // Solicitação de apartamento (morador)
  const [blocks, setBlocks] = useState([]);
  const [reqBloco, setReqBloco] = useState("");
  const [reqApartamento, setReqApartamento] = useState("");
  const [reqAvailableApts, setReqAvailableApts] = useState([]);
  const [reqMsg, setReqMsg] = useState({ type: "", text: "" });
  const [isSendingReq, setIsSendingReq] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  // Solicitações pendentes (síndico)
  const [pendingRequests, setPendingRequests] = useState([]);

  // Configurações de perfil
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState({ type: "", text: "" });
  const [isSavingPass, setIsSavingPass] = useState(false);

  const userRole = user?.role?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
  const isAdmin = userRole === "sindico" || userRole === "admin_bloco";

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleSwitchApt = (apt) => {
    setActiveApt(apt);
    const updated = { ...user, apartamento: apt };
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
  };

  // --- FETCH ---
  const fetchComplaints = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/complaints?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setComplaints(data);
    } catch (err) { console.error(err); }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_URL}/api/users?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) { console.error(err); }
  }, [user, isAdmin]);

  const fetchPendingRequests = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_URL}/api/apartments/requests?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setPendingRequests(data);
    } catch (err) { console.error(err); }
  }, [user, isAdmin]);

  const fetchMyRequests = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/apartments/requests/me?morador_id=${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setMyRequests(data);
    } catch (err) { console.error(err); }
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    fetchComplaints();
    if (isAdmin) { fetchUsers(); fetchPendingRequests(); }
    fetchMyRequests();
  }, [user, navigate, fetchComplaints, fetchUsers, fetchPendingRequests, fetchMyRequests, isAdmin]);

  // Carrega blocos para solicitação de apartamento
  useEffect(() => {
    if (view === "meus_apts" && blocks.length === 0) {
      fetch(`${API_URL}/api/blocks`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setBlocks(d); })
        .catch(() => {});
    }
  }, [view]);

  useEffect(() => {
    if (reqBloco) {
      setReqApartamento("");
      fetch(`${API_URL}/api/blocks/${reqBloco}/apartments`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setReqAvailableApts(d); })
        .catch(() => setReqAvailableApts([]));
    } else {
      setReqAvailableApts([]);
    }
  }, [reqBloco]);

  // --- AÇÕES ---
  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, subject, description })
      });
      if (res.ok) {
        alert("Reclamação enviada!");
        setSubject("");
        setDescription("");
        setView("visualizar");
        fetchComplaints();
      }
    } catch { alert("Erro ao enviar."); }
    finally { setIsSubmitting(false); }
  };

  const handleUpdateStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/complaints/${selectedComplaint.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, admin_comment: adminComment })
      });
      if (res.ok) { setShowModal(false); fetchComplaints(); }
    } catch { alert("Erro ao atualizar."); }
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    setIsSendingReq(true);
    setReqMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API_URL}/api/apartments/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ morador_id: user.id, bloco: reqBloco, apartamento: reqApartamento })
      });
      const data = await res.json();
      if (res.ok) {
        setReqMsg({ type: "success", text: data.message });
        setReqBloco("");
        setReqApartamento("");
        fetchMyRequests();
      } else {
        setReqMsg({ type: "error", text: data.error });
      }
    } catch { setReqMsg({ type: "error", text: "Erro de conexão." }); }
    finally { setIsSendingReq(false); }
  };

  const handleRequestAction = async (requestId, action) => {
    try {
      const res = await fetch(`${API_URL}/api/apartments/requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role: user.role })
      });
      const data = await res.json();
      if (res.ok) {
        fetchPendingRequests();
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch { alert("Erro ao processar."); }
  };

  const handleDeleteUser = async (moradorId, nome) => {
    if (!window.confirm(`Confirmar exclusão de "${nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/moradores/${moradorId}?requester_id=${user.id}&role=${user.role}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch { alert("Erro ao excluir."); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSenhaMsg({ type: "", text: "" });
    if (novaSenha !== confirmarSenha) {
      setSenhaMsg({ type: "error", text: "As senhas não coincidem." });
      return;
    }
    setIsSavingPass(true);
    try {
      const res = await fetch(`${API_URL}/api/moradores/${user.id}/senha`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha })
      });
      const data = await res.json();
      if (res.ok) {
        setSenhaMsg({ type: "success", text: "Senha alterada com sucesso!" });
        setSenhaAtual("");
        setNovaSenha("");
        setConfirmarSenha("");
      } else {
        setSenhaMsg({ type: "error", text: data.error });
      }
    } catch { setSenhaMsg({ type: "error", text: "Erro de conexão." }); }
    finally { setIsSavingPass(false); }
  };

  // --- DADOS RECHARTS ---
  const categoryData = Object.entries(
    complaints.reduce((acc, c) => { acc[c.subject] = (acc[c.subject] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const statusData = ["Pendente", "Em Análise", "Resolvido"].map(s => ({
    name: s, value: complaints.filter(c => c.status === s).length
  }));

  const monthlyData = complaints.reduce((acc, c) => {
    const month = new Date(c.created_at).toLocaleString("pt-BR", { month: "short", year: "2-digit" });
    const existing = acc.find(a => a.mes === month);
    if (existing) existing.total++;
    else acc.push({ mes: month, total: 1 });
    return acc;
  }, []);

  if (!user) return null;

  const apartamentos = user.apartamentos || (user.apartamento ? [user.apartamento] : []);

  return (
    <div className="container py-4">

      {/* Cabeçalho */}
      <div className="card mb-4 shadow-sm border-0 bg-light">
        <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h4 className="mb-1 text-primary">Bem-vindo, {user.nome}</h4>
            {activeApt ? (
              <p className="mb-0 text-muted small">Bloco {activeApt.numero_bloco} — Apto {activeApt.numero_apartamento}</p>
            ) : (
              <p className="mb-0 text-danger small">Nenhum apartamento vinculado.</p>
            )}
            <span className="badge bg-dark mt-1">{user.role}</span>
            {isAdmin && pendingRequests.length > 0 && (
              <span className="badge bg-danger ms-2">{pendingRequests.length} solicitação(ões) pendente(s)</span>
            )}
          </div>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            {apartamentos.length > 1 && (
              <select
                className="form-select form-select-sm"
                style={{ width: "auto" }}
                value={activeApt?.apartamento_id || ""}
                onChange={(e) => {
                  const apt = apartamentos.find(a => String(a.apartamento_id) === e.target.value);
                  if (apt) handleSwitchApt(apt);
                }}
              >
                {apartamentos.map(a => (
                  <option key={a.apartamento_id} value={a.apartamento_id}>
                    Bloco {a.numero_bloco} — Apto {a.numero_apartamento}
                  </option>
                ))}
              </select>
            )}
            <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">Sair</button>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        {[
          { key: "menu", label: "🏠 Início" },
          { key: "registrar", label: "📝 Nova Ocorrência" },
          { key: "visualizar", label: "📋 Histórico" },
          { key: "meus_apts", label: "🏢 Meus Aptos" },
          ...(isAdmin ? [
            { key: "solicitacoes", label: `🔔 Solicitações${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}` },
            { key: "gestao", label: "👥 Gestão de Moradores" },
            { key: "analise", label: "📊 Análise" },
          ] : []),
          { key: "configuracoes", label: "⚙️ Configurações" },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`btn btn-sm ${view === key ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ===================== VIEW: MENU ===================== */}
      {view === "menu" && (
        <div className="row">
          <div className="col-md-6 mb-3">
            <div className="card p-4 shadow-sm h-100">
              <h5>Suas Ocorrências</h5>
              <p className="text-muted">Total registrado: <strong>{complaints.length}</strong></p>
              <button className="btn btn-primary mt-auto" onClick={() => setView("visualizar")}>Ver Histórico</button>
            </div>
          </div>
          {isAdmin && (
            <div className="col-md-6 mb-3">
              <div className="card p-4 shadow-sm h-100 border-success">
                <h5 className="text-success">Gestão</h5>
                <p className="text-muted">Moradores: <strong>{users.length}</strong></p>
                {pendingRequests.length > 0 && (
                  <div className="alert alert-warning py-2 small mb-2">
                    ⚠️ {pendingRequests.length} solicitação(ões) pendente(s) de aprovação.
                  </div>
                )}
                <button className="btn btn-outline-success mt-auto" onClick={() => setView("solicitacoes")}>Ver Solicitações</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== VIEW: REGISTRAR ===================== */}
      {view === "registrar" && (
        <div className="card p-4 shadow-sm">
          <h5 className="mb-4">Registrar Ocorrência</h5>
          <form onSubmit={handleSubmitComplaint}>
            <label className="form-label fw-bold">Assunto</label>
            <select className="form-select mb-3" value={subject} onChange={e => setSubject(e.target.value)} required>
              <option value="">Selecione...</option>
              <option>Barulho</option>
              <option>Manutenção</option>
              <option>Limpeza</option>
              <option>Outros</option>
            </select>
            <label className="form-label fw-bold">Descrição</label>
            <textarea className="form-control mb-3" rows="4" placeholder="Descreva o problema..." value={description} onChange={e => setDescription(e.target.value)} required />
            <button className="btn btn-primary w-100" disabled={isSubmitting}>{isSubmitting ? "Enviando..." : "Enviar"}</button>
          </form>
        </div>
      )}

      {/* ===================== VIEW: HISTÓRICO + EXPORTAÇÃO ===================== */}
      {view === "visualizar" && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h5 className="mb-0">Histórico de Ocorrências</h5>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-success" onClick={() => exportToExcel(complaints, isAdmin)}>
                ⬇️ Excel
              </button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => exportToPDF(complaints, isAdmin)}>
                ⬇️ PDF
              </button>
            </div>
          </div>
          <div className="table-responsive card shadow-sm p-3 border-0">
            <table className="table table-hover">
              <thead className="table-light">
                <tr>
                  {isAdmin && <th>Morador</th>}
                  <th>Assunto</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {complaints.length > 0 ? complaints.map(c => (
                  <tr key={c.id}>
                    {isAdmin && (
                      <td>
                        <div className="fw-bold">{c.morador_nome}</div>
                        <small className="text-muted">B{c.numero_bloco} · Ap{c.numero_apartamento}</small>
                      </td>
                    )}
                    <td>{c.subject}</td>
                    <td>
                      <span className={`badge ${c.status === "Resolvido" ? "bg-success" : c.status === "Em Análise" ? "bg-info" : "bg-warning text-dark"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td><small>{new Date(c.created_at).toLocaleDateString('pt-BR')}</small></td>
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
                  <tr><td colSpan="5" className="text-center py-4 text-muted">Nenhuma ocorrência encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== VIEW: MEUS APARTAMENTOS ===================== */}
      {view === "meus_apts" && (
        <div>
          <h5 className="mb-4">Meus Apartamentos</h5>

          {/* Apartamentos já vinculados */}
          <div className="card p-4 shadow-sm mb-4">
            <h6 className="fw-bold mb-3">Vinculados</h6>
            {apartamentos.length > 0 ? (
              <ul className="list-group list-group-flush">
                {apartamentos.map(a => (
                  <li key={a.apartamento_id} className="list-group-item d-flex justify-content-between align-items-center">
                    <span>Bloco {a.numero_bloco} — Apto {a.numero_apartamento}</span>
                    {activeApt?.apartamento_id === a.apartamento_id ? (
                      <span className="badge bg-primary">Ativo</span>
                    ) : (
                      <button className="btn btn-sm btn-outline-primary" onClick={() => handleSwitchApt(a)}>Usar este</button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted small">Nenhum apartamento vinculado.</p>
            )}
          </div>

          {/* Formulário de solicitação */}
          <div className="card p-4 shadow-sm mb-4">
            <h6 className="fw-bold mb-3">Solicitar vínculo com novo apartamento</h6>
            <p className="text-muted small">A solicitação será analisada pelo síndico do bloco antes de ser aprovada.</p>
            <form onSubmit={handleSendRequest} className="d-flex gap-2 flex-wrap align-items-end">
              <div>
                <label className="form-label small mb-1">Bloco</label>
                <select className="form-select form-select-sm" value={reqBloco} onChange={e => setReqBloco(e.target.value)} required>
                  <option value="">Selecione</option>
                  {blocks.map(b => <option key={b.bloco_id} value={b.numero_bloco}>Bloco {b.numero_bloco}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label small mb-1">Apartamento</label>
                <select className="form-select form-select-sm" value={reqApartamento} onChange={e => setReqApartamento(e.target.value)} required disabled={!reqBloco}>
                  <option value="">Selecione</option>
                  {reqAvailableApts.map((a, i) => <option key={i} value={a.numero_apartamento}>Apto {a.numero_apartamento}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={isSendingReq}>
                {isSendingReq ? "Enviando..." : "Enviar Solicitação"}
              </button>
            </form>
            {reqMsg.text && (
              <div className={`alert ${reqMsg.type === "error" ? "alert-danger" : "alert-success"} mt-3 py-2 mb-0 small`}>
                {reqMsg.text}
              </div>
            )}
          </div>

          {/* Minhas solicitações */}
          {myRequests.length > 0 && (
            <div className="card p-4 shadow-sm">
              <h6 className="fw-bold mb-3">Minhas Solicitações</h6>
              <table className="table table-sm">
                <thead className="table-light">
                  <tr><th>Bloco</th><th>Apto</th><th>Status</th><th>Data</th></tr>
                </thead>
                <tbody>
                  {myRequests.map(r => (
                    <tr key={r.request_id}>
                      <td>{r.numero_bloco}</td>
                      <td>{r.numero_apartamento}</td>
                      <td>
                        <span className={`badge ${r.status === "Aprovado" ? "bg-success" : r.status === "Negado" ? "bg-danger" : "bg-warning text-dark"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td><small>{new Date(r.created_at).toLocaleDateString('pt-BR')}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================== VIEW: SOLICITAÇÕES (SÍNDICO) ===================== */}
      {view === "solicitacoes" && isAdmin && (
        <div className="card p-4 shadow-sm">
          <h5 className="mb-4">Solicitações de Vínculo Pendentes</h5>
          {pendingRequests.length === 0 ? (
            <p className="text-muted">Nenhuma solicitação pendente.</p>
          ) : (
            <table className="table table-hover">
              <thead className="table-light">
                <tr><th>Morador</th><th>E-mail</th><th>Bloco</th><th>Apto</th><th>Data</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {pendingRequests.map(r => (
                  <tr key={r.request_id}>
                    <td className="fw-bold">{r.morador_nome}</td>
                    <td><small>{r.morador_email}</small></td>
                    <td>{r.numero_bloco}</td>
                    <td>{r.numero_apartamento}</td>
                    <td><small>{new Date(r.created_at).toLocaleDateString('pt-BR')}</small></td>
                    <td>
                      <div className="d-flex gap-1">
                        <button className="btn btn-sm btn-success" onClick={() => handleRequestAction(r.request_id, "Aprovado")}>✓ Aprovar</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleRequestAction(r.request_id, "Negado")}>✗ Negar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===================== VIEW: GESTÃO DE MORADORES ===================== */}
      {view === "gestao" && isAdmin && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h5 className="mb-0">Gestão de Moradores</h5>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-success" onClick={() => exportToExcel(users.map(u => ({ Nome: u.nome, Email: u.email, Bloco: u.numero_bloco, Apartamento: u.numero_apartamento, Perfil: u.role })), false)}>
                ⬇️ Excel
              </button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => exportToPDF(users.map(u => ({ subject: u.nome, description: u.email, status: u.role, admin_comment: `B${u.numero_bloco} Ap${u.numero_apartamento}`, created_at: new Date() })), false)}>
                ⬇️ PDF
              </button>
            </div>
          </div>
          <div className="table-responsive card shadow-sm p-3 border-0">
            <table className="table table-hover">
              <thead className="table-light">
                <tr><th>Nome</th><th>E-mail</th><th>Bloco</th><th>Apto</th><th>Perfil</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {users.length > 0 ? users.map(u => (
                  <tr key={u.morador_id}>
                    <td className="fw-bold">{u.nome}</td>
                    <td><small>{u.email}</small></td>
                    <td>{u.numero_bloco || "—"}</td>
                    <td>{u.numero_apartamento || "—"}</td>
                    <td><span className="badge bg-secondary">{u.role}</span></td>
                    <td>
                      {u.morador_id !== user.id && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteUser(u.morador_id, u.nome)}
                        >
                          🗑 Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="text-center py-4 text-muted">Nenhum morador encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== VIEW: ANÁLISE ===================== */}
      {view === "analise" && isAdmin && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h5 className="mb-0">Análise de Dados</h5>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-success" onClick={() => exportToExcel(complaints, isAdmin)}>⬇️ Excel</button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => exportToPDF(complaints, isAdmin)}>⬇️ PDF</button>
            </div>
          </div>

          <div className="row mb-4">
            {statusData.map(s => (
              <div key={s.name} className="col-md-4 mb-3">
                <div className="card shadow-sm border-0 p-3 d-flex flex-row justify-content-between align-items-center">
                  <div>
                    <div className="text-muted small">{s.name}</div>
                    <div className="fw-bold fs-3" style={{ color: STATUS_COLORS[s.name] }}>{s.value}</div>
                  </div>
                  <span style={{ fontSize: 28 }}>{s.name === "Pendente" ? "⏳" : s.name === "Em Análise" ? "🔍" : "✅"}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="row mb-4">
            <div className="col-lg-7 mb-4">
              <div className="card shadow-sm border-0 p-4 h-100">
                <h6 className="text-primary mb-3">Ocorrências por Categoria</h6>
                {categoryData.length === 0 ? <p className="text-muted small">Sem dados.</p> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={categoryData} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {categoryData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="col-lg-5 mb-4">
              <div className="card shadow-sm border-0 p-4 h-100">
                <h6 className="text-primary mb-3">Distribuição de Status</h6>
                {complaints.length === 0 ? <p className="text-muted small">Sem dados.</p> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="45%" outerRadius={80} innerRadius={45} dataKey="value" paddingAngle={4}>
                        {statusData.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />)}
                      </Pie>
                      <Legend iconType="circle" iconSize={10} />
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="card shadow-sm border-0 p-4">
            <h6 className="text-primary mb-3">Evolução Mensal</h6>
            {monthlyData.length === 0 ? <p className="text-muted small">Sem dados.</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={{ fill: "#6366f1", r: 5 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ===================== VIEW: CONFIGURAÇÕES ===================== */}
      {view === "configuracoes" && (
        <div className="row">
          <div className="col-md-6">
            <div className="card p-4 shadow-sm">
              <h5 className="mb-1">Perfil</h5>
              <p className="text-muted small mb-4">Informações da sua conta</p>
              <div className="mb-2"><strong>Nome:</strong> {user.nome}</div>
              <div className="mb-2"><strong>Cargo:</strong> {user.role}</div>
              {activeApt && (
                <div className="mb-2">
                  <strong>Apartamento ativo:</strong> Bloco {activeApt.numero_bloco} — Apto {activeApt.numero_apartamento}
                </div>
              )}
            </div>
          </div>

          <div className="col-md-6 mt-4 mt-md-0">
            <div className="card p-4 shadow-sm">
              <h5 className="mb-1">Alterar Senha</h5>
              <p className="text-muted small mb-4">Preencha os campos abaixo para redefinir sua senha</p>
              <form onSubmit={handleChangePassword}>
                <div className="mb-3">
                  <label className="form-label fw-bold small">Senha Atual</label>
                  <input
                    type="password"
                    className="form-control"
                    value={senhaAtual}
                    onChange={e => setSenhaAtual(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold small">Nova Senha</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Mín. 6 caracteres"
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold small">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    className="form-control"
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {senhaMsg.text && (
                  <div className={`alert ${senhaMsg.type === "error" ? "alert-danger" : "alert-success"} py-2 small`}>
                    {senhaMsg.text}
                  </div>
                )}
                <button className="btn btn-primary w-100" type="submit" disabled={isSavingPass}>
                  {isSavingPass ? "Salvando..." : "Salvar Nova Senha"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {showModal && selectedComplaint && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detalhes da Ocorrência</h5>
                <button className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <p><strong>Assunto:</strong> {selectedComplaint.subject}</p>
                <p><strong>Descrição:</strong> {selectedComplaint.description}</p>
                {isAdmin ? (
                  <div className="mt-3 bg-light p-3 rounded">
                    <label className="form-label fw-bold">Atualizar Status</label>
                    <select className="form-select mb-3" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                      <option>Pendente</option>
                      <option>Em Análise</option>
                      <option>Resolvido</option>
                    </select>
                    <label className="form-label fw-bold">Comentário do Síndico</label>
                    <textarea className="form-control" rows="2" value={adminComment} onChange={e => setAdminComment(e.target.value)} />
                  </div>
                ) : (
                  <div className="mt-3 bg-light p-3 rounded">
                    <p><strong>Status:</strong> <span className="badge bg-primary">{selectedComplaint.status}</span></p>
                    <p className="mb-0"><strong>Resposta:</strong> {selectedComplaint.admin_comment || "Nenhuma resposta ainda."}</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Fechar</button>
                {isAdmin && <button className="btn btn-success" onClick={handleUpdateStatus}>Salvar</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}