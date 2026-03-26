import React from 'react';
import { clsx } from 'clsx';

interface GlassLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassLayout: React.FC<GlassLayoutProps> = ({ children, className }) => {
  return (
    <div className={clsx("relative h-[100dvh] w-full bg-gray-900 text-slate-100 font-sans selection:bg-teal-500/30 overflow-hidden", className)}>

      {/* Main Background Layers - Animated Blobs matching Login page */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-teal-600/20 rounded-full blur-[100px]" />
      </div>

      {/* Content Area */}
      <div className="relative z-10 w-full h-full p-safe flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
};
