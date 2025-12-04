
import React from 'react';
import { ChevronDown } from 'lucide-react';

// --- Glass Card ---
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', title, action, ...props }) => {
  return (
    <div className={`bg-white/80 dark:bg-white/10 backdrop-blur-lg border border-gray-200 dark:border-white/20 rounded-3xl shadow-xl dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden ${className}`} {...props}>
      {(title || action) && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
          {title && <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-300 dark:to-teal-200">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

// --- Glass Input ---
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const GlassInput: React.FC<GlassInputProps> = ({ icon, className = '', ...props }) => {
  return (
    <div className="relative w-full">
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-white/50">
          {icon}
        </div>
      )}
      <input
        className={`w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 ${icon ? 'pl-10' : 'pl-4'} pr-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent transition-all duration-300 ${className}`}
        {...props}
      />
    </div>
  );
};

// --- Glass Select (NEW) ---
interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
}

export const GlassSelect: React.FC<GlassSelectProps> = ({ icon, children, className = '', ...props }) => {
  return (
    <div className="relative w-full group">
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-white/50 group-hover:text-gray-600 dark:group-hover:text-white/80 transition-colors">
          {icon}
        </div>
      )}
      <select
        className={`
            w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 
            ${icon ? 'pl-10' : 'pl-4'} pr-10 
            text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 
            focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent 
            transition-all duration-300 appearance-none cursor-pointer
            hover:bg-gray-100 dark:hover:bg-white/10
            ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {/* Custom Chevron */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-white/50 group-hover:text-gray-600 dark:group-hover:text-white transition-colors">
        <ChevronDown size={16} />
      </div>
    </div>
  );
};

// --- Gradient Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', icon, className = '', ...props }) => {
  const baseStyles = "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 active:scale-95 backdrop-blur-md shadow-lg";

  const variants = {
    primary: "bg-gradient-to-r from-emerald-500/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-600 text-white border border-white/10 shadow-lg shadow-emerald-500/20",
    secondary: "bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-200 dark:border-white/10",
    danger: "bg-red-500/10 dark:bg-red-500/20 hover:bg-red-500/20 dark:hover:bg-red-500/40 text-red-600 dark:text-red-200 border border-red-500/20 dark:border-red-500/30"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      {children}
    </button>
  );
};

// --- Badge ---
export const StatusBadge: React.FC<{ status: string, type: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = ({ status, type }) => {
  const colors = {
    success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    danger: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    neutral: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    info: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors[type]}`}>
      {status}
    </span>
  );
};

// --- Glass Modal (NEW) ---
interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const GlassModal: React.FC<GlassModalProps> = ({ isOpen, onClose, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl animate-in zoom-in-95 duration-200 ${className}`}>
        <GlassCard className="flex flex-col max-h-[85vh] overflow-hidden p-0 shadow-2xl !bg-white/95 dark:!bg-gray-900/95">
          {children}
        </GlassCard>
      </div>
    </div>
  );
};
