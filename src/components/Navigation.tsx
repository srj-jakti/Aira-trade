"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BrainCircuit, Radar, Settings, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Logo } from "./Logo";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Strategy", href: "/strategy", icon: Target },
  { name: "Analysis", href: "/analysis", icon: BrainCircuit },
  { name: "Scanner", href: "/scanner", icon: Radar },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-black/60 backdrop-blur-2xl px-4 pb-safe-area-inset-bottom pt-2 flex justify-around items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all duration-300 relative py-1 flex-1",
              isActive ? "text-blue-400" : "text-white/30"
            )}
          >
            <div className={cn(
              "p-1 rounded-xl transition-all duration-300",
              isActive ? "bg-blue-400/10 scale-110" : "bg-transparent"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={cn(
              "text-[10px] font-bold tracking-tight transition-all duration-300",
              isActive ? "opacity-100 translate-y-0" : "opacity-60"
            )}>
              {item.name}
            </span>
            {isActive && (
              <motion.div
                layoutId="mobile-nav-indicator"
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-400 rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
