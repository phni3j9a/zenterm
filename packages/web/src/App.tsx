import { Route, Routes, Navigate } from 'react-router-dom';
import { LoginRoute } from './routes/login';
import { useAuthStore } from './stores/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthed) return <Navigate to="/web/login" replace />;
  return <>{children}</>;
}

function SessionsPlaceholder() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>ZenTerm — Sessions</h1>
      <p>Coming next: Sidebar + TerminalPane.</p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/web/login" element={<LoginRoute />} />
      <Route
        path="/web/sessions"
        element={
          <RequireAuth>
            <SessionsPlaceholder />
          </RequireAuth>
        }
      />
      <Route path="/web" element={<Navigate to="/web/sessions" replace />} />
      <Route path="*" element={<Navigate to="/web" replace />} />
    </Routes>
  );
}
