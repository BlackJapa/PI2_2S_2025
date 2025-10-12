import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="container-fluid">
        {/* Navbar fixa no topo */}
        <nav className="navbar navbar-custom navbar-expand-lg">
          <div className="container">
            <span className="navbar-brand mb-0 h1 mx-auto">
              Condomínio Transparente
            </span>
          </div>
        </nav>

        {/* Conteúdo principal centralizado */}
        <main className="main-content">
          <div className="card">
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<DashboardWrapper />} />
            </Routes>
          </div>
        </main>

        {/* Footer fixo na base */}
        <footer className="footer-custom">
          {/* Footer vazio conforme solicitado */}
        </footer>
      </div>
    </Router>
  );
}

export default App;

// Wrapper para pegar os dados do estado da navegação
function DashboardWrapper() {
  const location = useLocation();
  const user = location.state || { email: "Visitante", bloco: "-", apartment: "-" };
  return <Dashboard user={user} />;
}