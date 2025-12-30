"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Zap, BrainCircuit, Radar, Settings, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Strategy", href: "/strategy", icon: Zap },
  { name: "Analysis", href: "/analysis", icon: BrainCircuit },
  { name: "Scanner", href: "/scanner", icon: Radar },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Top Navigation */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl items-center justify-between px-6 h-16">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tighter">AiRA</span>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors relative",
                pathname === item.href ? "text-white" : "text-white/50 hover:text-white"
              )}
            >
              {pathname === item.href && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-white/10 rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-green-500 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
            SYSTEM: ONLINE
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 border border-white/20" />
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur-xl px-4 py-3 flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors relative",
                isActive ? "text-blue-500" : "text-white/40"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.name}</span>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-dot"
                  className="absolute -top-1 w-1 h-1 bg-blue-500 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}