import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export const MotionNumber = ({ value }: { value: number }) => {
  const spring = useSpring(value, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (current) => Math.round(current));
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
};