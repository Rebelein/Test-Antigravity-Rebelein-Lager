import React from 'react';
import { clsx } from 'clsx';

interface GlassLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassLayout: React.FC<GlassLayoutProps> = ({ children, className }) => {
  return (
    <div className={clsx("fixed inset-0 w-full h-full bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-teal-500/30", className)}>
      <style>{`
        /* Dynamic Mesh Gradient Animation */

        .mesh-blob {
          opacity: 0.6;
        }
      `}</style>

      {/* Main Background Layers */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Deep Base Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />

        {/* Vibrant Orbs */}
        <div className="mesh-blob absolute -top-[10%] -right-[10%] w-[50vw] h-[50vw] bg-teal-500/20 rounded-full blur-[100px] mix-blend-screen" />
        <div className="mesh-blob mesh-blob-delay-1 absolute -bottom-[10%] -left-[10%] w-[60vw] h-[60vw] bg-emerald-600/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="mesh-blob mesh-blob-delay-2 absolute top-[20%] left-[20%] w-[40vw] h-[40vw] bg-blue-600/10 rounded-full blur-[100px] mix-blend-screen" />

        {/* Noise Texture Overlay Removed */}
      </div>

      {/* Content Area (Independently Scrollable) */}
      <div className="relative z-10 w-full h-full overflow-y-auto overflow-x-hidden glass-scrollbar">
        {children}
      </div>
    </div>
  );
};
