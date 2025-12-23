import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export const LastWorkingDaySign: React.FC = () => {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0, rotate: 5 }}
                animate={{ y: 0, opacity: 1, rotate: -5 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-[100] group"
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            >
                {/* Snow cap */}
                <div className="absolute -top-3 -left-2 -right-2 h-6 bg-white rounded-full blur-[2px] z-20 pointer-events-none" />
                <div className="absolute -top-4 left-4 w-8 h-8 bg-white rounded-full z-20 pointer-events-none" />
                <div className="absolute -top-2 right-6 w-10 h-6 bg-white rounded-full z-20 pointer-events-none" />
                
                {/* Sign Board */}
                <div className="relative bg-yellow-400 border-4 border-black p-4 rounded shadow-xl w-64 transform transition-transform hover:scale-105 cursor-pointer">
                    
                    {/* Close button that appears on hover */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md border-2 border-white"
                        aria-label="Schild entfernen"
                    >
                        <X size={12} strokeWidth={3} />
                    </button>

                    {/* Industrial Stripes Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[length:20px_20px]" />

                    {/* Content */}
                    <div className="relative z-10 text-center">
                        <div className="bg-black text-yellow-400 font-black uppercase text-xs tracking-widest px-2 py-0.5 inline-block mb-1 transform -rotate-1">
                            Achtung
                        </div>
                        <h3 className="text-black font-black text-xl leading-none uppercase drop-shadow-sm font-sans">
                            Letzter<br/>Arbeitstag<br/>
                            <span className="text-3xl text-red-600 block mt-1">2025</span>
                        </h3>
                        <div className="mt-2 text-[10px] font-bold text-black/60 uppercase tracking-widest border-t-2 border-black/10 pt-1">
                            Baustelle Ende 
                        </div>
                    </div>

                    {/* Snow piles on corners */}
                    <div className="absolute -bottom-1 left-2 w-4 h-4 bg-white rounded-full z-20" />

                    {/* Pole (visual only) */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-4 h-32 bg-gray-700/50 -z-10 rounded-b-full hidden" />
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
