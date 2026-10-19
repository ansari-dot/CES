import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '../common/Toast';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#121c2a]">
      <Sidebar />
      <div className="pl-0 lg:pl-64 flex flex-col min-h-screen transition-all">
        <Header />
        <main className="pt-16 w-full px-3 sm:px-6 lg:px-8 flex-1">
          <div className="py-4 sm:py-6">{children}</div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};
