import { useState, useEffect, useCallback } from "react"; // Importa useCallback
import { useLocation } from "react-router-dom";

const cursorPointerStyle = { cursor: 'pointer' };
const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const location = useLocation();
  const user = location.state || { nome: "Visitante", id: null, role: 'morador', is_admin: false, bloco: 'N/A', apartment: 'N/A', bloco_id: null };
  console.log("Dashboard carregado com dados do usuário:", user);

  const [view, setView] = useState("menu");
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);

  // Estados para nova reclamação
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Estados para modal de edição de reclamação
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [newAdminComment, setNewAdminComment] = useState("");

  // **CORREÇÃO: Estados de loading separados**
  const [isViewLoading, setIsViewLoading] = useState(false); // Para carregar listas (fetchComplaints, fetchUsers)
  const [isSubmitting, setIsSubmitting] = useState(false); // Para ações (submit, update, delete, change role)

  const [formMessage, setFormMessage] = useState({ type: "", text: ""});

  // Estados para filtro de bloco (Sindico)
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('');

  // --- FUNÇÕES DE BUSCA DE DADOS (COM useCallback) ---
  const fetchBlocks = useCallback(async () => {
      if (!user || !user.id || user.role !== 'sindico') return;
      try {
          const response = await fetch(`${API_URL}/api/blocks?user_id=${user.id}`);
          if (!response.ok) throw new Error('Falha ao buscar blocos.');
          const data = await response.json();
          // Garante que "Todos os Blocos" só apareça uma vez
          setBlocks(prev => prev.length > 0 ? prev : [{ bloco_id: '', numero_bloco: 'Todos os Blocos' }, ...data]);
      } catch (error) {
          console.error("Erro ao buscar blocos:", error);
          if (view === 'manage') {
              setFormMessage({ type: 'error', text: 'Erro ao carregar lista de blocos.' });
          }
      }
  }, [user.id, user.role, API_URL, view]); // Adiciona 'view' para contexto de erro

  const fetchUsers = useCallback(async () => {
    if (!user || !user.id || !user.is_admin) return;
    console.log(`Buscando usuários com filtro: ${selectedBlockFilter}`);
    setIsViewLoading(true); // Loading da VIEW
    setFormMessage({ type: "", text: ""});
    try {
      let url = `${API_URL}/api/users?user_id=${user.id}`;
      if (user.role === 'sindico' && selectedBlockFilter !== '') {
        url += `&bloco_id_filter=${selectedBlockFilter}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Falha na autorização ou busca.');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      setFormMessage({ type: 'error', text: error.message || 'Erro ao buscar usuários.' });
      setUsers([]);
    } finally {
        setIsViewLoading(false); // Loading da VIEW
    }
  }, [user.id, user.is_admin, user.role, selectedBlockFilter, API_URL]);

   const fetchComplaints = useCallback(async () => {
    if (!user || !user.id) return;
    setIsViewLoading(true); // Loading da VIEW
    setFormMessage({ type: "", text: ""});
    try {
      const response = await fetch(`${API_URL}/api/complaints?user_id=${user.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar reclamações.');
      }
      const data = await response.json();
      setComplaints(data);
    } catch (error) {
      console.error('Erro ao buscar reclamações:', error);
      setFormMessage({ type: 'error', text: error.message || 'Erro ao buscar reclamações.' });
      setComplaints([]);
    } finally {
        setIsViewLoading(false); // Loading da VIEW
    }
  }, [user.id, API_URL]);


  // --- USE EFFECTS ATUALIZADOS E DIVIDIDOS ---

  // Efeito 1: Limpa mensagens ao mudar de view
  useEffect(() => {
    setFormMessage({ type: "", text: "" });
  }, [view]);

  // Efeito 2: Busca dados da view "table"
  useEffect(() => {
    if (view === "table") {
      fetchComplaints();
    }
  }, [view, fetchComplaints]); // Depende da view e da função memoizada

  // Efeito 3: Busca dados da view "manage"
  useEffect(() => {
    if (view === "manage" && user.is_admin) {
      fetchUsers(); // Busca usuários ao entrar na view ou ao mudar o filtro
    }
  }, [view, user.is_admin, selectedBlockFilter, fetchUsers]); // Depende da view, admin, filtro e função

  // Efeito 4: Busca blocos (apenas para síndico, uma vez ao entrar na view)
  useEffect(() => {
    if (view === "manage" && user.role === 'sindico') {
      fetchBlocks(); // Busca blocos apenas quando entra na view como síndico
    }
  }, [view, user.role, fetchBlocks]); // Depende da view, role e função


  // --- HANDLERS (Usando isSubmitting) ---
  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!user || !user.id) {
        setFormMessage({ type: 'error', text: 'Erro: Usuário não identificado.' });
        return;
    }
    setIsSubmitting(true); // Loading de AÇÃO
    setFormMessage({ type: "", text: "" });
    try {
      const response = await fetch(`${API_URL}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, subject, description }),
      });
      const data = await response.json();
      if (response.ok) {
        setSubject("");
        setDescription("");
        // **MELHORIA: Feedback de sucesso antes de redirecionar**
        setFormMessage({ type: 'success', text: data.message || "Reclamação enviada com sucesso! Redirecionando..." });
        setTimeout(() => {
            setView("table");
        }, 2000);
      } else {
        throw new Error(data.error || "Ocorreu um erro ao enviar a reclamação.");
      }
    } catch (error) {
      console.error('Erro ao enviar reclamação:', error);
      setFormMessage({ type: 'error', text: error.message || "Erro ao conectar com o servidor." });
    } finally {
      setIsSubmitting(false); // Loading de AÇÃO
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
    setFormMessage({ type: "", text: "" });
  };

  const handleUpdateComplaint = async (e) => {
    e.preventDefault();
    if (!selectedComplaint || !user || !user.id) return;
    setIsSubmitting(true); // Loading de AÇÃO
    setFormMessage({ type: "", text: "" });
    try {
      const response = await fetch(`${API_URL}/api/complaints/${selectedComplaint.id}?user_id=${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_comment: newAdminComment }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message || "Reclamação atualizada com sucesso!"); // Alert é ok aqui pois o modal fecha
        handleCloseModal();
        fetchComplaints(); // Recarrega a lista
      } else {
         throw new Error(data.error || 'Não foi possível atualizar.');
      }
    } catch (error) {
      console.error("Erro ao atualizar reclamação:", error);
      setFormMessage({ type: 'error', text: error.message || "Erro ao conectar com o servidor." });
    } finally {
      setIsSubmitting(false); // Loading de AÇÃO
    }
  };

  const handleChangeRole = async (targetUserId, targetUserName, newRole) => {
    if (!user || user.role !== 'sindico') return;
    const actionText = newRole === 'admin_bloco' ? 'promover' : 'rebaixar';
    if (!confirm(`Tem certeza que deseja ${actionText} ${targetUserName} para ${newRole}?`)) {
      return;
    }
    setIsSubmitting(true); // Loading de AÇÃO
    setFormMessage({ type: "", text: "" });
    try {
      const response = await fetch(`${API_URL}/api/users/${targetUserId}/role?user_id=${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_role: newRole }),
      });
      const data = await response.json();
      if (response.ok) {
        // **MELHORIA: Feedback na tela ao invés de alert**
        setFormMessage({ type: 'success', text: data.message || "Função atualizada com sucesso!"});
        fetchUsers(); // Atualiza a lista
      } else {
        throw new Error(data.error || 'Não foi possível atualizar a role.');
      }
    } catch (error) {
      console.error("Erro ao mudar role:", error);
      setFormMessage({ type: 'error', text: error.message || "Erro ao conectar com o servidor." });
    } finally {
      setIsSubmitting(false); // Loading de AÇÃO
    }
  };

  const handleDeleteUser = async (targetUserId, targetUserName) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o usuário ${targetUserName}?\n\nATENÇÃO: Todas as reclamações e dados deste usuário serão apagados. Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsSubmitting(true); // Loading de AÇÃO
    setFormMessage({ type: "", text: "" });
    try {
      const response = await fetch(`${API_URL}/api/users/${targetUserId}?user_id=${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok) {
        // **MELHORIA: Feedback na tela ao invés de alert**
        setFormMessage({ type: 'success', text: data.message || "Usuário excluído com sucesso!"});
        fetchUsers(); // Atualiza a lista de usuários
      } else {
        throw new Error(data.error || 'Não foi possível excluir o usuário.');
      }
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      setFormMessage({ type: 'error', text: error.message || "Erro ao conectar com o servidor." });
    } finally {
      setIsSubmitting(false); // Loading de AÇÃO
    }
  };

  // --- RENDERIZAÇÃO CONDICIONAL ---

  if (view === "menu") {
    return (
      <div className="text-center">
        <h2>Bem-vindo, {user.nome || 'Usuário'}!</h2>
        <p>Bloco: {user.bloco ?? 'N/A'} / Apto: {user.apartment ?? 'N/A'}</p>
        {user.is_admin && <p style={{ color: 'gold' }}><strong>👑 Modo Administrador ({user.role === 'sindico' ? 'Super Admin' : 'Admin Bloco'})</strong></p>}
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
            <input type="text" className="form-control" placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={isSubmitting} />
          </div>
          <div className="mb-3">
            <textarea className="form-control" placeholder="Descreva sua reclamação" rows="5" value={description} onChange={(e) => setDescription(e.target.value)} required disabled={isSubmitting} />
          </div>
          {/* Mostra mensagem de erro/sucesso */}
          {formMessage.text && (
            <div className={`alert ${formMessage.type === 'error' ? 'alert-danger' : 'alert-success'}`}>
              {formMessage.text}
            </div>
           )}
          <div className="d-flex justify-content-end">
            <button type="button" className="btn btn-secondary me-2" onClick={() => setView("menu")} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-success" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar Reclamação'}
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
           {/* Mostra mensagem de erro/loading da VIEW */}
           {isViewLoading && <p>Carregando reclamações...</p>}
           {formMessage.text && formMessage.type === 'error' && (
            <div className="alert alert-danger">{formMessage.text}</div>
           )}
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
                {!isViewLoading && complaints.length === 0 && (
                  <tr><td colSpan="5">Nenhuma reclamação encontrada.</td></tr>
                )}
                {!isViewLoading && complaints.map((c) => (
                  <tr key={c.id}>
                    <td>{c.date ? new Date(c.date).toLocaleString('pt-BR') : '-'}</td>
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
                      <td title={c.description}>{c.description ? c.description.substring(0, 50) + (c.description.length > 50 ? '...' : '') : '-'}</td>
                    )}
                    <td>{c.admin_comment || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary mt-3" onClick={() => setView("menu")}>Voltar</button>
        </div>

        {/* --- MODAL DE EDIÇÃO (usando isSubmitting) --- */}
        {showModal && selectedComplaint && (
          <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <form onSubmit={handleUpdateComplaint}>
                  <div className="modal-header">
                    <h5 className="modal-title">Editar Reclamação #{selectedComplaint.id}</h5>
                    <button type="button" className="btn-close" onClick={handleCloseModal} disabled={isSubmitting}></button>
                  </div>
                  <div className="modal-body">
                    <p><strong>Reclamante:</strong> {selectedComplaint.user_name}</p>
                    <p><strong>Assunto:</strong> {selectedComplaint.subject}</p>
                     <p><strong>Descrição:</strong> {selectedComplaint.description}</p>
                    <hr/>
                    <div className="mb-3">
                      <label htmlFor="statusSelect" className="form-label">Status</label>
                      <select id="statusSelect" className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} disabled={isSubmitting}>
                        <option value="aberto">Aberto</option>
                        <option value="em análise">Em Análise</option>
                        <option value="fechado">Fechado</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label htmlFor="adminComment" className="form-label">Comentário do Administrador</label>
                      <textarea id="adminComment" className="form-control" rows="4" value={newAdminComment} onChange={(e) => setNewAdminComment(e.target.value)} disabled={isSubmitting}></textarea>
                    </div>
                     {formMessage.text && formMessage.type === 'error' && (
                        <div className="alert alert-danger">
                           {formMessage.text}
                        </div>
                     )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={isSubmitting}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? "Salvando..." : "Salvar Alterações"}
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

        {user.role === 'sindico' && (
          <div className="mb-3 d-flex justify-content-center">
            <div style={{ maxWidth: '300px' }}>
              <label htmlFor="blockFilter" className="form-label">Filtrar por Bloco:</label>
              <select
                id="blockFilter"
                className="form-select"
                value={selectedBlockFilter}
                onChange={(e) => setSelectedBlockFilter(e.target.value)}
                disabled={isViewLoading || blocks.length === 0} // Desabilita se carregando VIEW
              >
                {blocks.length === 0 && <option>Carregando blocos...</option>}
                {blocks.map(block => (
                  <option key={block.bloco_id ?? 'all'} value={block.bloco_id}>
                    {block.numero_bloco === 'Todos os Blocos' ? block.numero_bloco : `Bloco ${block.numero_bloco}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <p>
          {user.role === 'sindico'
            ? (selectedBlockFilter === '' ? 'Você (Super Admin) está vendo todos os moradores.' : `Você (Super Admin) está vendo moradores do Bloco ${blocks.find(b => b.bloco_id === parseInt(selectedBlockFilter))?.numero_bloco ?? '...'}.`)
            : `Você (Admin Bloco ${user.bloco ?? 'N/A'}) está vendo os moradores do seu bloco.`
          }
        </p>

         {/* Mostra mensagem de erro/loading da VIEW ou de SUCESSO da AÇÃO */}
         {isViewLoading && <p>Carregando moradores...</p>}
         {formMessage.text && (
            <div className={`alert ${formMessage.type === 'error' ? 'alert-danger' : 'alert-success'}`}>
              {formMessage.text}
            </div>
         )}

        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Bloco</th>
                <th>Apto</th>
                <th>Função</th>
                {user.role === 'sindico' && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {!isViewLoading && users.length === 0 && (
                  <tr><td colSpan={user.role === 'sindico' ? 6 : 5}>Nenhum morador encontrado para este filtro.</td></tr>
              )}
              {!isViewLoading && users.map((u) => (
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
                  {user.role === 'sindico' && (
                    <td>
                      {u.id !== user.id && u.role !== 'sindico' && (
                        <>
                          {u.role === 'morador' ? (
                            <button
                              className="btn btn-sm btn-success me-1"
                              onClick={() => handleChangeRole(u.id, u.nome, 'admin_bloco')}
                              disabled={isSubmitting} // Desabilita na AÇÃO
                              title={`Promover ${u.nome} a Admin do Bloco ${u.bloco}`}
                            >
                              Promover
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-danger me-1"
                              onClick={() => handleChangeRole(u.id, u.nome, 'morador')}
                              disabled={isSubmitting} // Desabilita na AÇÃO
                              title={`Rebaixar ${u.nome} a Morador`}
                            >
                              Rebaixar
                            </button>
                          )}
                            {
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteUser(u.id, u.nome)}
                              disabled={isSubmitting} // Desabilita na AÇÃO
                              title={`Excluir ${u.nome} permanentemente`}
                            >
                            Excluir
                            </button>
                            }
                        </>
                      )}
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

  // Fallback
  return <div className="text-center"><h2>Carregando...</h2></div>;
}