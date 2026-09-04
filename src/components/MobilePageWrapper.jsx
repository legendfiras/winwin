import React from 'react';
import { motion } from 'framer-motion';
import MobileBottomTab from '@/components/MobileBottomTab';

const pageVariants = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.25,
};

export default function MobilePageWrapper({ children, showTabBar = true }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen"
    >
      {children}
      {showTabBar && <MobileBottomTab />}
    </motion.div>
  );
}