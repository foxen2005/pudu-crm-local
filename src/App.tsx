import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Contacts from '@/pages/Contacts';
import Companies from '@/pages/Companies';
import Deals from '@/pages/Deals';
import Activities from '@/pages/Activities';
import Automations from '@/pages/Automations';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Dev bypass — remove when login is ready
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/contactos" element={<Contacts />} />
                    <Route path="/empresas" element={<Companies />} />
                    <Route path="/negocios" element={<Deals />} />
                    <Route path="/actividades" element={<Activities />} />
                    <Route path="/automatizaciones" element={<Automations />} />
                    <Route path="/reportes" element={<Reports />} />
                    <Route path="/configuracion" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
