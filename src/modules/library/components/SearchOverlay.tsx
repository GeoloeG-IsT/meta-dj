import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchOverlayProps {
  query: string;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ query }) => {
  return (
    <AnimatePresence>
      {query && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[1500] pointer-events-none"
        >
          <div className="bg-[#121212] border-2 border-[#4DFA90] shadow-[0_0_30px_rgba(77,250,144,0.3)] px-8 py-4 rounded-sm flex items-center gap-4">
            <Search className="text-[#4DFA90]" size={24} />
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
