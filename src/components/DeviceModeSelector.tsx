import React from 'react';
import { useDeviceMode, DeviceOverride } from '../../hooks/useDeviceMode';
import { Smartphone, Tablet, Monitor, Settings2 } from 'lucide-react';
import { clsx } from 'clsx';

export const DeviceModeSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { override, mode, setOverride } = useDeviceMode();

  const options: { id: DeviceOverride; label: string; icon: React.ReactNode }[] = [
    { id: 'auto', label: `Auto (${mode.replace('_', ' ')})`, icon: <Settings2 size={15} /> },
    { id: 'smartphone', label: 'Smartphone', icon: <Smartphone size={15} /> },
    { id: 'tablet_portrait', label: 'Tablet (Hoch)', icon: <Tablet size={15} className="rotate-90" /> },
    { id: 'tablet_landscape', label: 'Tablet (Quer)', icon: <Tablet size={15} /> },
    { id: 'desktop', label: 'Desktop', icon: <Monitor size={15} /> },
  ];

  return (
    <div className={clsx("flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border text-xs", className)}>
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setOverride(opt.id)}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all font-medium cursor-pointer whitespace-nowrap",
            override === opt.id
              ? "bg-primary text-primary-foreground shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title={opt.label}
        >
          {opt.icon}
          <span className="hidden xl:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
};
