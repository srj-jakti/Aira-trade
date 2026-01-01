"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BrainCircuit,
  Radar,
  Settings,
  Target,
  ChevronRight,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Strategy", href: "/strategy", icon: Target },
  { name: "Analysis", href: "/analysis", icon: BrainCircuit },
  { name: "Scanner", href: "/scanner", icon: Radar },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-black/50 backdrop-blur-xl">
      <SidebarHeader className="h-16 flex items-center px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-black tracking-tighter text-xl group-data-[collapsible=icon]:hidden">AiRA</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                      className={cn(
                        "transition-all duration-200",
                        isActive 
                          ? "bg-white/10 text-white font-medium" 
                          : "text-white/40 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className={cn("w-5 h-5", isActive ? "text-blue-400" : "")} />
                        <span>{item.name}</span>
                        {isActive && <ChevronRight className="ml-auto w-4 h-4 text-blue-400 group-data-[collapsible=icon]:hidden" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-white/5 group-data-[collapsible=icon]:hidden">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Trading Terminal</p>
          <p className="text-xs text-white/40">v1.0.0 Stable</p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
