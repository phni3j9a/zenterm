import { Route, Routes, Navigate } from 'react-router-dom';
import { LoginRoute } from './routes/login';
import { SessionsRoute } from './routes/sessions';
import { SettingsRoute } from './routes/settings';
import { useAuthStore } from './stores/auth';
import { ConfirmDialogHost } from './components/ui/ConfirmDialogHost';
import { ToastViewport } from './components/ui/ToastViewport';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthed) return <Navigate to="/web/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
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
        <Route
          path="/web/settings"
          element={
            <RequireAuth>
              <SettingsRoute />
            </RequireAuth>
          }
        />
        <Route path="/web/files" element={<Navigate to="/web/sessions" replace />} />
        <Route path="/web" element={<Navigate to="/web/sessions" replace />} />
        <Route path="*" element={<Navigate to="/web" replace />} />
      </Routes>
      <ConfirmDialogHost />
      <ToastViewport />
    </>
  );
}
