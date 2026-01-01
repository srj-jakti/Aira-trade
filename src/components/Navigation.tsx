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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] border-t border-white/10 bg-black/80 backdrop-blur-2xl px-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-3 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all duration-300 active:scale-90 rounded-2xl flex-1 relative min-w-0",
                isActive ? "text-primary" : "text-white/40 hover:text-white"
              )}
            >
              <div className={cn(
                "p-1 rounded-xl transition-all duration-300",
                isActive && "bg-primary/10 scale-110 shadow-[0_0_20px_rgba(var(--primary),0.2)]"
              )}>
                <Icon className="size-5 sm:size-[22px]" />
              </div>
              <span className={cn(
                "text-[9px] sm:text-[10px] font-bold tracking-tight transition-all",
                isActive ? "opacity-100" : "opacity-60"
              )}>
                {item.name}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),1)]"
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
