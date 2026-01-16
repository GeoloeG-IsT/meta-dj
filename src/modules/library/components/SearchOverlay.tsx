import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchOverlayProps {
  query: string;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ query }) => {
  return (
    <AnimatePresence>
      {query && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[1500] pointer-events-none"
        >
          <div className="bg-[#121212] border-2 border-[#4DFA90] shadow-[0_0_30px_rgba(77,250,144,0.3)] px-8 py-4 rounded-sm flex items-center gap-4">
            <span className="text-[#4DFA90] text-xl">🔍</span>
            <span className="text-[#4DFA90] text-3xl font-mono tracking-[0.2em]">
              {query}
              <span className="animate-pulse">_</span>
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
