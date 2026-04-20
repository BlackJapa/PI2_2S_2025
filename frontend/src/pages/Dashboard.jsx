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

  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminComment, setAdminComment] = useState("");

  const [showLinkApt, setShowLinkApt] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [linkBloco, setLinkBloco] = useState("");
  const [linkApartamento, setLinkApartamento] = useState("");
  const [availableApts, setAvailableApts] = useState([]);
  const [linkMsg, setLinkMsg] = useState({ type: "", text: "" });
  const [isLinking, setIsLinking] = useState(false);

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
    } catch (err) { console.error("Erro reclamações:", err); }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_URL}/api/users?user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) { console.error("Erro usuários:", err); }
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    fetchComplaints();
    if (isAdmin) fetchUsers();
  }, [user, navigate, fetchComplaints, fetchUsers, isAdmin]);

  useEffect(() => {
    if (showLinkApt && blocks.length === 0) {
      fetch(`${API_URL}/api/blocks`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setBlocks(d); })
        .catch(() => {});
    }
  }, [showLinkApt]);

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

  const handleLinkApartment = async (e) => {
    e.preventDefault();
    setIsLinking(true);
    setLinkMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API_URL}/api/apartments/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ morador_id: user.id, bloco: linkBloco, apartamento: linkApartamento })
      });
      const data = await res.json();
      if (res.ok) {
        setLinkMsg({ type: "success", text: "Apartamento vinculado!" });
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
    } catch { setLinkMsg({ type: "error", text: "Erro de conexão." }); }
    finally { setIsLinking(false); }
  };

  // --- DADOS PARA RECHARTS — processados dos dados reais da API ---
  const categoryData = Object.entries(
    complaints.reduce((acc, c) => { acc[c.subject] = (acc[c.subject] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const statusData = ["Pendente", "Em Análise", "Resolvido"].map(s => ({
    name: s,
    value: complaints.filter(c => c.status === s).length
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
            <span className="badge bg-dark mt-1">Cargo: {user.role}</span>
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
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowLinkApt(!showLinkApt)}>+ Apartamento</button>
            <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">Sair</button>
          </div>
        </div>

        {showLinkApt && (
          <div className="card-footer bg-white">
            <p className="fw-bold mb-2 small">Vincular novo apartamento</p>
            <form onSubmit={handleLinkApartment} className="d-flex gap-2 flex-wrap align-items-end">
              <div>
                <label className="form-label small mb-1">Bloco</label>
                <select className="form-select form-select-sm" value={linkBloco} onChange={e => setLinkBloco(e.target.value)} required>
                  <option value="">Selecione</option>
                  {blocks.map(b => <option key={b.bloco_id} value={b.numero_bloco}>Bloco {b.numero_bloco}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label small mb-1">Apartamento</label>
                <select className="form-select form-select-sm" value={linkApartamento} onChange={e => setLinkApartamento(e.target.value)} required disabled={!linkBloco}>
                  <option value="">Selecione</option>
                  {availableApts.map((a, i) => <option key={i} value={a.numero_apartamento}>Apto {a.numero_apartamento}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={isLinking}>{isLinking ? "Vinculando..." : "Vincular"}</button>
              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setShowLinkApt(false)}>Cancelar</button>
            </form>
            {linkMsg.text && (
              <div className={`alert ${linkMsg.type === "error" ? "alert-danger" : "alert-success"} mt-2 py-2 mb-0 small`}>
                {linkMsg.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navegação */}
      <div className="btn-group w-100 mb-4 shadow-sm">
        <button className={`btn ${view === "menu" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("menu")}>Início</button>
        <button className={`btn ${view === "registrar" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("registrar")}>Nova Ocorrência</button>
        <button className={`btn ${view === "visualizar" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setView("visualizar")}>Histórico</button>
        {isAdmin && (
          <button className={`btn ${view === "analise" ? "btn-success" : "btn-outline-success"}`} onClick={() => setView("analise")}>📊 Análise</button>
        )}
      </div>

      {/* VIEW: MENU */}
      {view === "menu" && (
        <div className="row">
          <div className="col-md-6 mb-3">
            <div className="card p-4 shadow-sm h-100">
              <h5>Resumo</h5>
              <p className="text-muted">Total de ocorrências: <strong>{complaints.length}</strong></p>
              <button className="btn btn-primary w-100 mt-auto" onClick={() => setView("visualizar")}>Ver Histórico</button>
            </div>
          </div>
          {isAdmin && (
            <div className="col-md-6 mb-3">
              <div className="card p-4 shadow-sm h-100 border-success">
                <h5 className="text-success">Gestão</h5>
                <p className="text-muted">Moradores cadastrados: <strong>{users.length}</strong></p>
                <button className="btn btn-outline-success w-100 mt-auto" onClick={() => setView("analise")}>Ver Análise</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: REGISTRAR */}
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

      {/* VIEW: HISTÓRICO */}
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
                      <small className="text-muted">B{c.numero_bloco} · Ap{c.numero_apartamento}</small>
                    </td>
                  )}
                  <td>{c.subject}</td>
                  <td>
                    <span className={`badge ${c.status === "Resolvido" ? "bg-success" : c.status === "Em Análise" ? "bg-info" : "bg-warning text-dark"}`}>
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
                <tr><td colSpan="4" className="text-center py-4 text-muted">Nenhuma ocorrência encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW: ANÁLISE COM RECHARTS — dados reais vindos da API */}
      {view === "analise" && isAdmin && (
        <div>
          {/* KPI Cards */}
          <div className="row mb-4">
            {statusData.map(s => (
              <div key={s.name} className="col-md-4 mb-3">
                <div className="card shadow-sm border-0 p-3 d-flex flex-row justify-content-between align-items-center">
                  <div>
                    <div className="text-muted small">{s.name}</div>
                    <div className="fw-bold fs-3" style={{ color: STATUS_COLORS[s.name] }}>{s.value}</div>
                  </div>
                  <span style={{ fontSize: 28 }}>
                    {s.name === "Pendente" ? "⏳" : s.name === "Em Análise" ? "🔍" : "✅"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="row mb-4">
            {/* BarChart */}
            <div className="col-lg-7 mb-4">
              <div className="card shadow-sm border-0 p-4 h-100">
                <h6 className="text-primary mb-3">Ocorrências por Categoria</h6>
                {categoryData.length === 0 ? (
                  <p className="text-muted small">Sem dados suficientes.</p>
                ) : (
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

            {/* PieChart */}
            <div className="col-lg-5 mb-4">
              <div className="card shadow-sm border-0 p-4 h-100">
                <h6 className="text-primary mb-3">Distribuição de Status</h6>
                {complaints.length === 0 ? (
                  <p className="text-muted small">Sem dados suficientes.</p>
                ) : (
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

          {/* LineChart */}
          <div className="card shadow-sm border-0 p-4">
            <h6 className="text-primary mb-3">Evolução Mensal de Ocorrências</h6>
            {monthlyData.length === 0 ? (
              <p className="text-muted small">Sem dados suficientes.</p>
            ) : (
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

      {/* Modal */}
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