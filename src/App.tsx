import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Layout } from '@/components/Layout/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Contacts from '@/pages/Contacts';
import ContactoDetalle from '@/pages/ContactoDetalle';
import Companies from '@/pages/Companies';
import Deals from '@/pages/Deals';
import Activities from '@/pages/Activities';
import Automations from '@/pages/Automations';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Whatsapp from '@/pages/Whatsapp';
import Correo from '@/pages/Correo';
import Admin from '@/pages/Admin';
import Join from '@/pages/Join';
import Productos from '@/pages/Productos';

const queryClient = new QueryClient();

function AuthGate() {
  const { user, loading, isMaster } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  // Detectar link de invitación: /?join=TOKEN
  const joinToken = new URLSearchParams(window.location.search).get('join');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-white text-xl">storefront</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (joinToken) {
      return <Join token={joinToken} onSwitch={() => { window.history.replaceState({}, '', '/'); setShowRegister(false); }} />;
    }
    return showRegister
      ? <Register onSwitch={() => setShowRegister(false)} />
      : <Login onSwitch={() => setShowRegister(true)} />;
  }

  if (isMaster) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/contactos" element={<Contacts />} />
        <Route path="/contactos/:id" element={<ContactoDetalle />} />
        <Route path="/empresas" element={<Companies />} />
        <Route path="/negocios" element={<Deals />} />
        <Route path="/actividades" element={<Activities />} />
        <Route path="/automatizaciones" element={<Automations />} />
        <Route path="/reportes" element={<Reports />} />
        <Route path="/whatsapp" element={<Whatsapp />} />
        <Route path="/correo" element={<Correo />} />
        <Route path="/configuracion" element={<Settings />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AuthGate />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
