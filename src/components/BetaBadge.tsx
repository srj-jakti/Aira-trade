"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function BetaBadge({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "bg-primary/10 backdrop-blur-md border border-primary/20 text-primary px-2 py-0.5 rounded-full text-[8px] font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(var(--primary),0.1)]",
        className
      )}
    >
      Beta
    </motion.div>
  );
}
