import { Route, Routes, Navigate } from 'react-router-dom';

function PlaceholderHome() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>ZenTerm</h1>
      <p>Phase 1 bootstrap. Login screen coming next.</p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/web" element={<PlaceholderHome />} />
      <Route path="/web/*" element={<PlaceholderHome />} />
      <Route path="*" element={<Navigate to="/web" replace />} />
    </Routes>
  );
}
