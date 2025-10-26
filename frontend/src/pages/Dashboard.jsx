import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

const cursorPointerStyle = { cursor: 'pointer' };
const API_URL = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const location = useLocation();
  const user = location.state || { email: "Visitante", id: null, role: 'morador', is_admin: false };

  const [view, setView] = useState("menu");
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);

  // Estados para nova reclamação
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Estados para modal de edição
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [newAdminComment, setNewAdminComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- NOVOS ESTADOS PARA FILTRO DE BLOCO (SINDICO) ---
  const [blocks, setBlocks] = useState([]); // Armazena a lista de blocos
  const [selectedBlockFilter, setSelectedBlockFilter] = useState(''); // Armazena o ID do bloco selecionado (' ' = Todos)

  // --- FUNÇÃO PARA BUSCAR BLOCOS ---
  const fetchBlocks = async () => {
      // (Opcional: Verificar se user.id existe)
      try {
          const response = await fetch(`${API_URL}/api/blocks?user_id=${user.id}`); // Passa user_id se precisar de autenticação
          if (!response.ok) throw new Error('Falha ao buscar blocos.');
          const data = await response.json();
          // Adiciona a opção "Todos os Blocos" no início
          setBlocks([{ bloco_id: '', numero_bloco: 'Todos os Blocos' }, ...data]);
      } catch (error) {
          console.error("Erro ao buscar blocos:", error);
          // Opcional: Mostrar mensagem de erro
      }
  };

  // --- FUNÇÃO FETCH USERS MODIFICADA ---
  const fetchUsers = async () => {
    if (!user || !user.id) return;
    setIsLoading(true); // Indica que está carregando
    try {
      // Constrói a URL base
      let url = `${API_URL}/api/users?user_id=${user.id}`;
      // Adiciona o filtro de bloco APENAS se for SINDICO e um bloco estiver selecionado
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
      alert(error.message || 'Erro ao buscar usuários.'); // Mostra erro
      setUsers([]); // Limpa usuários em caso de erro
    } finally {
        setIsLoading(false); // Finaliza o carregamento
    }
  };

  // --- USE EFFECT ATUALIZADO ---
  useEffect(() => {
    // Busca reclamações se a view for 'table'
    if (view === "table") {
      fetchComplaints();
    }
    // Se a view for 'manage' E o usuário for admin...
    if (view === "manage" && user.is_admin) {
      // Busca a lista de usuários (agora respeita o filtro 'selectedBlockFilter')
      fetchUsers();
      // Se o usuário for SINDICO, busca também a lista de blocos para o dropdown
      if (user.role === 'sindico') {
        fetchBlocks();
      }
    }
    // Adiciona selectedBlockFilter às dependências para rebuscar usuários quando o filtro mudar
  }, [view, user.is_admin, user.role, selectedBlockFilter]);


  // --- (Handlers: handleSubmitComplaint, handleOpenEditModal, handleCloseModal, handleUpdateComplaint, handleChangeRole como antes) ---
  const handleSubmitComplaint = async (e) => { /* ... */ };
  const handleOpenEditModal = (complaint) => { /* ... */ };
  const handleCloseModal = () => { /* ... */ };
  const handleUpdateComplaint = async (e) => { /* ... */ };
  const handleChangeRole = async (targetUserId, targetUserName, newRole) => { /* ... */ };

  // --- RENDERIZAÇÃO CONDICIONAL ---

  // (Views "menu", "form", "table" como antes)
  if (view === "menu") { /* ... */ }
  if (view === "form") { /* ... */ }
  if (view === "table") { /* ... (incluindo o modal) ... */ }


  // --- VIEW "MANAGE" ATUALIZADA COM DROPDOWN ---
  if (view === "manage" && user.is_admin) {
    return (
      <div className="text-center">
        <h2>Gerenciamento de Moradores</h2>

        {/* Dropdown de Filtro - Visível apenas para o SINDICO */}
        {user.role === 'sindico' && (
          <div className="mb-3 d-flex justify-content-center">
            <div style={{ maxWidth: '300px' }}> {/* Limita a largura do dropdown */}
              <label htmlFor="blockFilter" className="form-label">Filtrar por Bloco:</label>
              <select
                id="blockFilter"
                className="form-select"
                value={selectedBlockFilter}
                onChange={(e) => setSelectedBlockFilter(e.target.value)}
                disabled={isLoading}
              >
                {/* Popula as opções com a lista de blocos */}
                {blocks.map(block => (
                  <option key={block.bloco_id} value={block.bloco_id}>
                    {/* Mostra 'Bloco X' ou 'Todos os Blocos' */}
                    {block.numero_bloco === 'Todos os Blocos' ? block.numero_bloco : `Bloco ${block.numero_bloco}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Mensagem dinâmica */}
        <p>
          {user.role === 'sindico'
            ? (selectedBlockFilter === '' ? 'Você (Super Admin) está vendo todos os moradores.' : `Você (Super Admin) está vendo moradores do Bloco ${blocks.find(b => b.bloco_id === parseInt(selectedBlockFilter))?.numero_bloco || selectedBlockFilter}.`)
            : `Você (Admin Bloco ${user.bloco}) está vendo os moradores do seu bloco.`
          }
        </p>

        {/* Tabela de Usuários (como antes, com a coluna Ações para o síndico) */}
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead>
              {/* ... (cabeçalho da tabela como antes) ... */}
            </thead>
            <tbody>
              {/* Mostra mensagem de carregando */}
              {isLoading && (
                  <tr><td colSpan={user.role === 'sindico' ? 6 : 5}>Carregando moradores...</td></tr>
              )}
              {/* Mostra moradores ou mensagem de 'nenhum encontrado' */}
              {!isLoading && users.length === 0 && (
                  <tr><td colSpan={user.role === 'sindico' ? 6 : 5}>Nenhum morador encontrado para este filtro.</td></tr>
              )}
              {!isLoading && users.map((u) => (
                <tr key={u.id} className={u.id === user.id ? 'table-info' : ''}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.bloco}</td>
                  <td>{u.apartment}</td>
                  <td>
                    {/* ... (badge da role como antes) ... */}
                  </td>
                  {user.role === 'sindico' && (
                    <td>
                      {/* ... (botões de ação como antes) ... */}
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

  return <div className="text-center"><h2>Carregando...</h2></div>;
}

// Cole aqui as definições completas das views "menu", "form" e "table" (com o modal)