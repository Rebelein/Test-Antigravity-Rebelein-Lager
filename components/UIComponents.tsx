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
    default: "bg-white/5 border-white/10",
    subtle: "bg-white/0 border-white/5",
    prominent: "bg-white/10 border-white/20 shadow-[0_4px_16px_0_rgba(0,0,0,0.25)]" // Reduced shadow
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "backdrop-blur-md border rounded-3xl overflow-hidden flex flex-col will-change-transform", // Reduced blur xl->md
        variants[variant],
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
          {title && <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={cn("p-6 flex-1", contentClassName)}>
        {children}
      </div>
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
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50 group-focus-within:text-emerald-400 transition-colors duration-300">
          {icon}
        </div>
      )}
      <input
        className={cn(
          "w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-4 text-white placeholder-white/30",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 focus:bg-white/10",
          "transition-all duration-300",
          icon ? 'pl-10' : 'pl-4',
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
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/50 group-hover:text-white/80 transition-colors">
          {icon}
        </div>
      )}
      <select
        className={cn(
          "w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-10 text-white placeholder-white/40",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent",
          "transition-all duration-300 appearance-none cursor-pointer",
          "hover:bg-white/10",
          icon ? 'pl-10' : 'pl-4',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50 group-hover:text-white transition-colors">
        <ChevronDown size={16} />
      </div>
    </div>
  );
};

// --- Gradient Button ---
interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', icon, className = '', isLoading, disabled, ...props }) => {
  const variants = {
    primary: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border border-white/20 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40",
    secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/10",
    danger: "bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30",
    ghost: "bg-transparent hover:bg-white/5 text-white/70 hover:text-white border-transparent"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors duration-300 backdrop-blur-md",
        variants[variant],
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
          {icon && <span className="w-5 h-5 flex items-center justify-center">{icon}</span>}
          {children}
        </>
      )}
    </motion.button>
  );
};

// --- Badge ---
export const StatusBadge: React.FC<{ status: string, size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const getStyle = (s: string) => {
    switch (s) {
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
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({ isOpen, onClose, children, className = '', title }) => {
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
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          />

          {/* Modal Content */}
          <div className="fixed inset-0 z-[151] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className={cn(
                "w-full max-w-2xl pointer-events-auto will-change-transform",
                "bg-[#121212]/90 backdrop-blur-lg border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]", // Reduced blur 2xl->lg
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

