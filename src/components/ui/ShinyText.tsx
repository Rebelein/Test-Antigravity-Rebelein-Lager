import React from 'react';

export const ShinyText = ({ text, className = '' }: { text: string, className?: string }) => {
  return (
    <span
      className={`inline-block text-transparent bg-clip-text bg-[linear-gradient(110deg,#939393,45%,#1e2631,55%,#939393)] dark:bg-[linear-gradient(110deg,#e2e8f0,45%,#1e293b,55%,#e2e8f0)] bg-[length:200%_100%] animate-shine ${className}`}
    >
      {text}
    </span>
  );
};