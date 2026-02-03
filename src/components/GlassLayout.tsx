import React from 'react';
import { clsx } from 'clsx';

interface GlassLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassLayout: React.FC<GlassLayoutProps> = ({ children, className }) => {
  return (
    <div className={clsx("relative h-[100dvh] w-full bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30 overflow-hidden", className)}>

      {/* Main Background Layers - Static & Performance Optimized */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Deep Base Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />

        {/* Optional: Subtle static accent without heavy blur/blend modes if needed, 
            otherwise clean dark background is best for stability. */}
      </div>

      {/* Content Area */}
      {/* Changed from overflow-container to normal flow to allow native iOS scrolling */}
      <div className="relative z-10 w-full h-full p-safe flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
};
