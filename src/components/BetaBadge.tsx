"use client";

import { motion } from "framer-motion";

export function BetaBadge() {
  return (
    <div className="fixed top-0 right-0 z-[9999] pointer-events-none p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary/10 backdrop-blur-md border border-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(var(--primary),0.1)]"
      >
        Beta
      </motion.div>
    </div>
  );
}
