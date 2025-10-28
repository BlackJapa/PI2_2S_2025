import React from 'react';
import { useNavigate } from 'react-router-dom';

// --- Estilos CSS (Inline) ---
// (Definir os estilos como objetos aqui deixa o JSX mais limpo)

const pageStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#f0f2f5', // Um fundo suave, como o da sua tela de login
  padding: '20px',
};

const cardStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  padding: '32px 40px',
  maxWidth: '700px',
  width: '100%',
  textAlign: 'center',
};

const titleStyle = {
  color: '#333',
  marginBottom: '24px',
  borderBottom: '2px solid #007bff', // Uma linha azul para destacar o título
  paddingBottom: '10px',
};

const listStyle = {
  listStyleType: 'none',
  padding: 0,
  marginBottom: '24px',
};

const listItemStyle = {
  fontSize: '1.1em',
  color: '#555',
  marginBottom: '10px',
};

const sectionTitleStyle = {
  color: '#111',
  fontSize: '1.2em',
  marginTop: '24px',
  marginBottom: '12px',
  borderTop: '1px solid #eee',
  paddingTop: '24px',
};

const polosStyle = {
  fontSize: '1em',
  color: '#667',
  fontStyle: 'italic',
};

const buttonStyle = {
  backgroundColor: '#6c757d', // Cor 'secondary' do Bootstrap
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  padding: '12px 24px',
  cursor: 'pointer',
  fontSize: '1em',
  marginTop: '30px',
  fontWeight: 'bold',
  transition: 'background-color 0.2s',
};

// --- Componente React ---

export default function Integrantes() {
  const navigate = useNavigate();

  // Função para voltar para a página anterior no histórico do navegador
  const handleBack = () => {
    navigate(-1); 
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        
        <h2 style={titleStyle}>Integrantes do Projeto</h2> {/* [cite: 6] */}
        
        <ul style={listStyle}>
          <li style={listItemStyle}>Christian Monteiro dos Santos Pereira</li> {/* [cite: 7] */}
          <li style={listItemStyle}>Deryk Filipe Hamano</li> {/* [cite: 8] */}
          <li style={listItemStyle}>Lucas Lima Torres</li> {/* [cite: 9] */}
          <li style={listItemStyle}>Luciano Miguel de Oliveira</li> {/* [cite: 10] */}
          <li style={listItemStyle}>Marcelo de Souza David</li> {/* [cite: 11] */}
          <li style={listItemStyle}>Marcos Felipe Gouvea</li> {/* [cite: 12] */}
          <li style={listItemStyle}>Matheus Haruo Prado Takehara</li> {/* [cite: 13] */}
          <li style={listItemStyle}>Pablo Santos Barros</li> {/* [cite: 14] */}
        </ul>

        <h3 style={sectionTitleStyle}>Tutor/Mediador</h3> {/* [cite: 15] */}
        <p style={{...listItemStyle, fontWeight: 'bold', fontSize: '1.15em' }}>
          Prof.ª Elva Karina Mayhua Quispe
        </p> {/* [cite: 16] */}

        <h3 style={sectionTitleStyle}>Polos Participantes</h3> {/* [cite: 17] */}
        <p style={polosStyle}>
          Osasco • Caieiras • Francisco • Suzano • São Bernardo do Campo {/* [cite: 18] */}
        </p>

        <button 
          style={buttonStyle} 
          onClick={handleBack}
          // Adiciona um efeito 'hover' simples
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
        >
          Voltar
        </button>

      </div>
    </div>
  );
}