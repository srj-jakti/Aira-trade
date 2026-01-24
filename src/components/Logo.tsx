import React from 'react';
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ className, iconOnly = false, size = 'md' }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-6 w-6', text: 'text-lg' },
    md: { icon: 'h-8 w-8', text: 'text-xl' },
    lg: { icon: 'h-12 w-12', text: 'text-3xl' },
    xl: { icon: 'h-20 w-20', text: 'text-5xl' },
  };

  return (
    <div className={cn("flex items-center gap-2.5 select-none group", className)}>
      <div className={cn("relative flex items-center justify-center transition-transform group-hover:scale-105 duration-300", sizes[size].icon)}>
        {/* Modern Abstract "A" + Bolt + Trend SVG */}
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
        >
          <defs>
            <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          {/* Background Shape */}
          <rect x="5" y="5" width="90" height="90" rx="24" fill="currentColor" className="text-black/20" />
          
          {/* Stylized 'A' + Lightning Bolt */}
          <path 
            d="M30 75L50 25L70 75M40 55H60" 
            stroke="url(#logo-gradient)" 
            strokeWidth="8" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="opacity-40"
          />
          
          {/* The Bolt / Trend Line */}
          <path 
            d="M25 70L45 45L55 55L75 25" 
            stroke="white" 
            strokeWidth="10" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            filter="url(#glow)"
          />
          
          {/* Pulse Dot at the end of trend */}
          <circle cx="75" cy="25" r="5" fill="white">
            <animate 
              attributeName="r" 
              values="4;7;4" 
              dur="2s" 
              repeatCount="indefinite" 
            />
            <animate 
              attributeName="opacity" 
              values="0.5;1;0.5" 
              dur="2s" 
              repeatCount="indefinite" 
            />
          </circle>
        </svg>
      </div>
      
        {!iconOnly && (
          <span className={cn(
            "font-semibold tracking-tight transition-colors duration-300",
            sizes[size].text,
            "bg-gradient-to-br from-white via-white to-white/90 bg-clip-text text-transparent"
          )}>
            AiRA<span className="text-blue-500">.</span>
          </span>
        )}
    </div>
  );
}
