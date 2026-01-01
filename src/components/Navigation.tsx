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
    <>
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl items-center justify-between px-8 h-16">
        <Link href="/dashboard" className="hover:opacity-80 transition-opacity flex items-center gap-2">
          <Logo size="md" />
          <div className="flex flex-col -gap-1">
            <span className="text-sm font-bold tracking-tight text-white">AIRA</span>
            <span className="text-[10px] font-medium text-white/40 tracking-[0.2em] uppercase">Trade</span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 relative",
                pathname === item.href ? "text-white" : "text-white/40 hover:text-white"
              )}
            >
              {pathname === item.href && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-primary/20 border border-primary/20 rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 min-w-[120px] justify-end">
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-black/60 backdrop-blur-2xl px-1 pb-[env(safe-area-inset-bottom,0.75rem)] pt-2 flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-1 transition-all duration-200 active:scale-95 active:bg-white/5 rounded-2xl flex-1 relative",
                isActive ? "text-primary" : "text-white/40 hover:text-white"
              )}
            >
              <Icon className={cn("size-[22px] transition-transform", isActive && "scale-110")} />
              <span className="text-[10px] font-semibold tracking-tight">{item.name}</span>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute bottom-1 w-1 h-1 bg-primary rounded-full"
                  transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
