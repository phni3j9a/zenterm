import { Route, Routes, Navigate } from 'react-router-dom';
import { LoginRoute } from './routes/login';
import { SessionsRoute } from './routes/sessions';
import { useAuthStore } from './stores/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthed) return <Navigate to="/web/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/web/login" element={<LoginRoute />} />
      <Route
        path="/web/sessions"
        element={
          <RequireAuth>
            <SessionsRoute />
          </RequireAuth>
        }
      />
      <Route path="/web" element={<Navigate to="/web/sessions" replace />} />
      <Route path="*" element={<Navigate to="/web" replace />} />
    </Routes>
  );
}
