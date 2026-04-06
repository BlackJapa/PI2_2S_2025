import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

import Login from "./src/pages/Login";
import Register from "./src/pages/Register";
import Dashboard from "./src/pages/Dashboard";
import Integrantes from "./src/pages/Integrantes";
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './index.css';

function App() {
  const [highContrast, setHighContrast] = useState(false);

  const [dbStatus, setDbStatus] = useState("checking");

  useEffect(() => {
  const checkStatus = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/db-status`);
      const data = await res.json();
      setDbStatus(data.status);
    } catch {
      setDbStatus("offline");
    }
  };

  checkStatus();
  const interval = setInterval(checkStatus, 30000); // Checa a cada 30s
  return () => clearInterval(interval);
}, []);

  // Efeito para adicionar/remover a classe do body
  useEffect(() => {
    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
    // Cleanup function para remover a classe se o componente for desmontado
    return () => {
      document.body.classList.remove('high-contrast');
    };
  }, [highContrast]); // Roda sempre que highContrast mudar

  return (
    <Router>
      {/* Container principal - NÃO precisa mais da classe high-contrast aqui */}
      <div className="container-fluid"> 
        <nav className="navbar navbar-custom"> {/* Removido navbar-expand-lg */}
          <div className="container">
            <span className="navbar-brand mb-0 h1"> {/* Removido mx-auto */}
              Condomínio Transparente
            </span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => setHighContrast(!highContrast)}
              title={highContrast ? 'Desativar Alto Contraste' : 'Ativar Alto Contraste'}
            >
              {highContrast ? '☀️ Normal' : '🌙 Alto Contraste'}
            </button>
          </div>
        </nav>

        <main className="main-content">
          <div className="card">
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/integrantes" element={<Integrantes />} />
              <Route path="/dashboard" element={<Dashboard />} /> 
            </Routes>
          </div>
        </main>

        <footer className="footer-custom">
          {/* Pode adicionar um texto simples aqui se quiser */}
          {/* <p className="mb-0">&copy; 2025 Condomínio Transparente</p> */}
        </footer>
      </div>
      {/* No seu JSX, dentro da div className="container" da navbar:*/}
        <div className="d-flex align-items-center">
          <span className={`db-indicator ${dbStatus}`} title={`Banco de Dados: ${dbStatus}`}></span>
         <span className="navbar-brand mb-0 h1 ms-2">Condomínio Transparente</span>
        </div>
    </Router>
    
  );
}

export default App;

// Removido o DashboardWrapper - O Dashboard agora pega o state diretamente com useLocation