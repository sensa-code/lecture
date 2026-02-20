import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { LogPanel } from './LogPanel';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

        {/* Log panel (collapsible at bottom) */}
        <LogPanel />
      </div>
    </div>
  );
}
