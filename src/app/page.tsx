"use client";

import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Shield, 
  BarChart3, 
  ArrowRight,
  Bot,
  Zap,
  Activity,
  Radar,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Bot,
    title: "AI Analysis",
    description: "Multi-parameter neural networks identify market patterns with precision."
  },
  {
    icon: Radar,
    title: "Live Scanner",
    description: "Continuously monitors thousands of data points for strategic opportunities."
  },
  {
    icon: Shield,
    title: "Risk Guard",
    description: "Bank-grade encryption and user-defined guardrails for safe automation."
  },
  {
    icon: Activity,
    title: "User-Automation",
    description: "Automate your own proven logic with our high-speed execution engine."
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-black tracking-tighter text-xl">AiRA</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/signin">
              <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-white text-black hover:bg-white/90 text-[10px] font-black uppercase tracking-widest h-9 px-5 rounded-full">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1e40af30,transparent_50%)]" />
        
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-400">
              <Zap className="h-3 w-3 fill-current" />
              v1.0.0 Stable Deployment
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9]">
              <span className="text-white">TRADE WITH</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600">
                AI INTELLIGENCE
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto font-medium leading-relaxed">
              The professional-grade platform for Indian Market analysis and user-defined automation. Experience speed, precision, and complete control.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Link href="/signup">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white border-none px-10 h-14 rounded-full font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-500/20">
                  Open Free Account
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white px-10 h-14 rounded-full font-black uppercase tracking-widest text-xs">
                  View Pricing
                </Button>
              </Link>
            </div>

            {/* Dashboard Preview */}
            <div className="mt-20 relative px-4 md:px-0">
              <div className="absolute inset-0 bg-blue-500/20 blur-[120px] -z-10" />
              <div className="bg-zinc-900/50 border border-white/10 rounded-2xl md:rounded-3xl p-2 shadow-2xl backdrop-blur-3xl overflow-hidden aspect-[16/9] md:aspect-[21/9]">
                <div className="w-full h-full rounded-xl md:rounded-2xl bg-black border border-white/5 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 opacity-20">
                    <Logo size="lg" />
                    <span className="text-xs font-black tracking-widest uppercase">System Terminal Preview</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-black tracking-tight text-white mb-3 uppercase">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed font-medium">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left space-y-2">
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-white uppercase italic">Built for Precision Trading</h2>
            <p className="text-blue-100/70 font-bold uppercase tracking-widest text-[10px]">Compliance · Security · Speed</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              "End-to-End Encryption",
              "SEBI Compliant Logic",
              "Zero Latency Data",
              "24/7 System Monitoring"
            ].map((text) => (
              <div key={text} className="flex items-center gap-2 text-white font-black uppercase text-[10px] tracking-widest px-4 py-2 bg-white/10 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-blue-200" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2 space-y-6">
              <Link href="/" className="flex items-center gap-2">
                <Logo size="sm" />
                <span className="font-black tracking-tighter text-2xl">AiRA</span>
              </Link>
              <p className="text-sm text-white/30 max-w-sm leading-relaxed font-medium">
                The ultimate AI-powered environment for market data analysis, pattern identification, and strategy automation in the Indian markets.
              </p>
            </div>
            <div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-white/40 mb-6">Platform</h4>
              <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-white/60">
                <li><Link href="/pricing" className="hover:text-blue-400">Pricing</Link></li>
                <li><Link href="/signin" className="hover:text-blue-400">Terminal</Link></li>
                <li><Link href="/signup" className="hover:text-blue-400">Create Account</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-white/40 mb-6">Legal</h4>
              <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-white/60">
                <li><Link href="/legal/terms" className="hover:text-blue-400">Terms</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-blue-400">Privacy</Link></li>
                <li><Link href="/legal/risk-disclosure" className="hover:text-blue-400">Risk Disclosure</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 text-center space-y-6">
            <p className="text-[10px] text-white/20 max-w-4xl mx-auto leading-relaxed uppercase font-medium tracking-tight">
              AiRA is a software platform providing analytical and automation tools only. We do not provide investment advice, trading recommendations, or financial services. All trading decisions are made by the user. Past performance does not guarantee future results. User retains 100% control of all broker interactions.
            </p>
            <p className="text-[10px] text-white/10 font-black uppercase tracking-[0.3em]">
              © 2026 AiRA INTELLIGENCE · ALL RIGHTS RESERVED
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
