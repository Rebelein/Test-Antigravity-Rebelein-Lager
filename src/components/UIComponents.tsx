import React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Glass Card ---
interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  contentClassName?: string;
  variant?: 'default' | 'subtle' | 'prominent';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  title,
  action,
  contentClassName = '',
  variant = 'default',
  ...props
}) => {
  const variants = {
    default: "bg-white/[0.08] border-white/[0.15]", // Reference default
    subtle: "bg-white/[0.02] border-white/5",
    prominent: "bg-white/[0.12] border-white/20 shadow-2xl"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative backdrop-blur-2xl border rounded-3xl overflow-hidden flex flex-col will-change-transform",
        "shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]", // Reference shadow
        variants[variant],
        className
      )}
      {...props}
    >
      {/* Reference: Top Highlight Line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 pointer-events-none" />

      {/* Shine Effect (Original) */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      {(title || action) && (
        <div className="relative px-8 py-6 border-b border-white/15 flex justify-between items-center shrink-0 z-10">
          {title && <h3 className="text-xl font-bold text-white">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={cn("relative p-8 flex-1 z-10", contentClassName)}>
        {children}
      </div>

      {/* Reference: Bottom Shadow Line */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent opacity-50 pointer-events-none" />
    </motion.div>
  );
};

// --- Glass Input ---
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const GlassInput: React.FC<GlassInputProps> = ({ icon, className = '', ...props }) => {
  return (
    <div className="relative w-full group">
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/50 group-focus-within:text-teal-400 transition-colors duration-300">
          {icon}
        </div>
      )}
      <input
        className={cn(
          "w-full bg-black/20 backdrop-blur-md border border-white/10 rounded-xl py-3 pr-4 text-white placeholder-white/20",
          "shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]", // Reference Inner Shadow
          "focus:outline-none focus:bg-black/30 focus:border-teal-500/30 focus:ring-2 focus:ring-teal-500/50",
          "transition-all duration-200",
          icon ? 'pl-11' : 'pl-5',
          className
        )}
        {...props}
      />
    </div>
  );
};

// --- Glass Select ---
interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
}

export const GlassSelect: React.FC<GlassSelectProps> = ({ icon, children, className = '', ...props }) => {
  return (
    <div className="relative w-full group">
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/50 group-hover:text-white/80 transition-colors">
          {icon}
        </div>
      )}
      <select
        className={cn(
          "w-full bg-black/20 border border-white/5 rounded-xl py-3 pr-10 text-white placeholder-white/20",
          "focus:outline-none focus:bg-black/30 focus:border-teal-500/30 focus:ring-1 focus:ring-teal-500/30",
          "transition-all duration-200 appearance-none cursor-pointer",
          "hover:bg-black/30",
          // Fix for dropdown options visibility in dark mode
          "[&>option]:bg-[#050b14] [&>option]:text-white",
          icon ? 'pl-11' : 'pl-5',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50 group-hover:text-white transition-colors">
        <ChevronDown size={18} />
      </div>
    </div>
  );
};

// --- Gradient Button ---
interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', icon, className = '', isLoading, disabled, ...props }) => {
  const variants = {
    primary: "bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-teal-900/20 border border-white/20 group relative overflow-hidden",
    secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md",
    danger: "bg-gradient-to-br from-red-500/80 to-rose-600/80 hover:from-red-500 hover:to-rose-600 text-white border border-red-500/30 shadow-red-900/20",
    ghost: "bg-transparent hover:bg-white/5 text-white/50 hover:text-white border-transparent shadow-none"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 backdrop-blur-md relative overflow-hidden",
        variants[variant],
        sizes[size],
        className,
        (isLoading || disabled) && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {icon && <span className="w-5 h-5 flex items-center justify-center relative z-10">{icon}</span>}
          <span className="relative z-10">{children}</span>
          {/* Reference: Button Shine */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        </>
      )}
    </motion.button>
  );
};

// --- Badge ---
export const StatusBadge: React.FC<{ status: string, size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const getStyle = (s: string) => {
    switch (s) {
      case 'Available':
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case 'Rented':
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case 'In Repair':
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case 'Ready':
      case 'ReturnReady':
      case 'ReturnComplete':
      case 'Withdrawn':
      case 'Received':
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case 'Preparing':
      case 'ReturnPending':
      case 'PartiallyReceived':
      case 'Ordered':
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case 'ReadyForPickup':
        return "bg-sky-500/20 text-sky-300 border-sky-500/30";
      case 'Draft':
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case 'Missing':
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      default:
        return "bg-white/10 text-white/50 border-white/10";
    }
  };

  const translate = (s: string) => {
    switch (s) {
      case 'Available': return 'Verfügbar';
      case 'Rented': return 'Verliehen';
      case 'In Repair': return 'In Reparatur';
      case 'Draft': return 'Entwurf';
      case 'Preparing': return 'In Arbeit';
      case 'Ready': return 'Bereit';
      case 'Withdrawn': return 'Abgeschlossen';
      case 'ReturnPending': return 'Retoure (Angemeldet)';
      case 'ReturnReady': return 'Retoure (Abholbereit)';
      case 'ReturnComplete': return 'Retoure (Erledigt)';
      case 'Missing': return 'VERMISST';
      case 'Ordered': return 'Bestellt';
      case 'PartiallyReceived': return 'Teilw. Erhalten';
      case 'Received': return 'Erhalten';
      case 'ReadyForPickup': return 'Abholbereit';
      default: return s;
    }
  };

  return (
    <span className={cn(
      "rounded-full font-medium border backdrop-blur-sm flex items-center justify-center",
      getStyle(status),
      size === 'sm' ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
    )}>
      {translate(status)}
    </span>
  );
};

// --- Animated Modal (Replaces GlassModal) ---
interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  fullScreen?: boolean;
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({ isOpen, onClose, children, className = '', title, fullScreen = false }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[170] bg-black/50 backdrop-blur-lg flex items-center justify-center p-4 content-center"
          />

          {/* Modal Content */}
          <div className={`fixed inset-0 z-[180] flex items-center justify-center ${fullScreen ? 'p-0' : 'p-4'} pointer-events-none`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className={cn(
                "w-full pointer-events-auto will-change-transform",
                "bg-slate-950/50 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col",
                fullScreen ? "h-full max-w-none rounded-none border-0" : "max-w-2xl rounded-3xl max-h-[85vh]",
                className
              )}
            >
              {title && (
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
              )}
              <div className="p-0 overflow-y-auto custom-scrollbar flex-1 h-full">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

// Export GlassModal for backward compatibility, but alias it to AnimatedModal
export const GlassModal = AnimatedModal;

// --- Page Header ---
export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
    <div>
      <h1 className="text-3xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">{title}</h1>
      {subtitle && <p className="text-white/50">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </header>
);

