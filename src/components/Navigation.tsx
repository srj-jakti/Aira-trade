"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BrainCircuit, Radar, Settings, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

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
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/40 backdrop-blur-xl items-center justify-between px-4 md:px-8 h-14">
        <Link href="/dashboard" className="hover:opacity-80 transition-opacity flex items-center gap-2">
          <Logo size="sm" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight text-foreground">AIRA</span>
            <BetaBadge />
          </div>
        </Link>

        <nav className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-full border border-border">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 relative",
                pathname === item.href ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {pathname === item.href && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] border-t border-border bg-background/95 backdrop-blur-2xl px-1 pb-[calc(env(safe-area-inset-bottom,0px)+4px)] pt-1.5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-border/50">
          <div className="flex items-center gap-1.5">
            <Logo size="sm" />
            <span className="text-[10px] font-bold text-foreground">AIRA</span>
            <BetaBadge className="text-[6px] px-1 py-0" />
          </div>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-90 rounded-xl flex-1 relative min-w-0 py-1",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-1 rounded-lg transition-all duration-300",
                  isActive && "bg-primary/10 scale-105"
                )}>
                  <Icon className="size-4" />
                </div>
                <span className={cn(
                  "text-[8px] font-bold tracking-tight transition-all truncate w-full text-center",
                  isActive ? "opacity-100" : "opacity-60"
                )}>
                  {item.name}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute -bottom-0.5 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
