import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

const isNarrow = () => window.matchMedia('(max-width: 768px)').matches;

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(!isNarrow());

  return (
    <div className={styles.layout} data-testid="main-layout">
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
      />
      <div className={styles.body} data-sidebar-open={sidebarOpen}>
        <Sidebar />
        <main className={styles.main}>{children}</main>
      </div>
      <StatusBar />
    </div>
  );
}
