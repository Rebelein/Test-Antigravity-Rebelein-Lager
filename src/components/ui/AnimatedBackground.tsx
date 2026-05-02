import React from 'react';

export const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute w-[400px] h-[400px] bg-primary/10 rounded-full blur-[80px] top-[10%] left-[10%] animate-blob transform-gpu" />
      <div className="absolute w-[350px] h-[350px] bg-secondary/10 rounded-full blur-[80px] top-[60%] right-[10%] animate-blob transform-gpu" style={{ animationDelay: '-5s' }} />
      <div className="absolute w-[300px] h-[300px] bg-accent/10 rounded-full blur-[80px] bottom-[10%] left-[30%] animate-blob transform-gpu" style={{ animationDelay: '-10s' }} />
    </div>
  );
};