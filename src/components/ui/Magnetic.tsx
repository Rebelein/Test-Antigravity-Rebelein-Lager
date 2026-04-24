import React, { useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export const Magnetic = ({ children }: { children: React.ReactElement }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [, setIsHovered] = useState(false);
  const x = useSpring(0, { stiffness: 150, damping: 15, mass: 0.1 });
  const y = useSpring(0, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    x.set(middleX * 0.3);
    y.set(middleY * 0.3);
  };

  const reset = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{ x, y, display: 'inline-block' }}
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      onMouseEnter={() => setIsHovered(true)}
    >
      {children}
    </motion.div>
  );
};