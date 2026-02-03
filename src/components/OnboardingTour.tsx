
import React, { useState } from 'react';
import { GlassCard, Button } from './UIComponents';
import { ArrowRight, Check, ScanLine, LayoutDashboard, WifiOff } from 'lucide-react';

interface OnboardingTourProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: "Willkommen!",
    content: "Willkommen in der Rebelein LagerApp. Diese kurze Tour zeigt dir die wichtigsten Funktionen, damit du sofort loslegen kannst.",
    icon: <LayoutDashboard size={48} className="text-emerald-400 mb-4" />
  },
  {
    title: "Navigation",
    content: "Am Desktop findest du das Menü links. Auf dem Handy ist das Menü unten. Dort erreichst du schnell Lagerbestand, Bestellungen und Werkzeuge.",
    icon: <ArrowRight size={48} className="text-blue-400 mb-4" />
  },
  {
    title: "Scanner Button",
    content: "Der große Button in der Mitte (unten) ist dein Universal-Scanner. Damit kannst du Artikel für Infos, Inventur oder Bestellungen scannen.",
    icon: <ScanLine size={48} className="text-purple-400 mb-4" />
  },
  {
    title: "Online Zwang",
    content: "Die App benötigt eine Internetverbindung, um sicherzustellen, dass der Lagerbestand immer aktuell ist. Ohne Netz sind keine Buchungen möglich.",
    icon: <WifiOff size={48} className="text-rose-400 mb-4" />
  }
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const stepData = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/90 backdrop-blur-lg animate-in fade-in duration-300">
      <GlassCard className="w-full max-w-sm flex flex-col items-center text-center relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }} 
          />
        </div>

        <div className="py-8 px-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-in zoom-in duration-300 key={currentStep}">
             {stepData.icon}
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">{stepData.title}</h2>
          <p className="text-white/70 text-sm leading-relaxed min-h-[80px]">
            {stepData.content}
          </p>
        </div>

        <div className="w-full pt-4 flex gap-3">
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} className="w-full bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20">
              Weiter <ArrowRight size={16} className="ml-1"/>
            </Button>
          ) : (
            <Button onClick={handleNext} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg">
              Los geht's! <Check size={16} className="ml-1"/>
            </Button>
          )}
        </div>
        
        <div className="mt-4 flex gap-1">
            {STEPS.map((_, idx) => (
                <div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === currentStep ? 'bg-white' : 'bg-white/20'}`} />
            ))}
        </div>
      </GlassCard>
    </div>
  );
};
