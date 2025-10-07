import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<DashboardWrapper />} />
      </Routes>
    </Router>
  );
}

// Wrapper para pegar os dados do estado da navegação
function DashboardWrapper() {
  const location = useLocation();
  const user = location.state || { email: "Visitante", bloco: "-", apartment: "-" };
  return <Dashboard user={user} />;
}
