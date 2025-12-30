"use client";

import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Zap, 
  Shield, 
  BarChart3, 
  ArrowRight,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const features = [
  {
    icon: Bot,
    title: "AI-Powered Trading",
    description: "Advanced machine learning algorithms analyze market patterns in real-time."
  },
  {
    icon: TrendingUp,
    title: "Smart Analytics",
    description: "Deep insights into Indian market trends with predictive analytics."
  },
  {
    icon: Shield,
    title: "Secure & Reliable",
    description: "Bank-grade security with encrypted connections and secure API handling."
  },
  {
    icon: BarChart3,
    title: "Real-time Monitoring",
    description: "Track your portfolio and market movements with live updates."
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[150px]" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white/70">
              <Zap className="w-4 h-4 text-blue-400" />
              AI-Powered Trading Intelligence
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="text-white">Trade Smarter with</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                AiRA Intelligence
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto">
              Fully automated AI trading and analysis platform for Indian Markets. 
              Make data-driven decisions with real-time insights.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/signup">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white border-none px-8">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/signin">
                <Button size="lg" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why Choose AiRA?
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Experience the future of trading with our cutting-edge AI technology
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/[0.08] transition-colors group"
              >
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/50">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ready to Start Trading?
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Join thousands of traders who are already using AiRA to make smarter investment decisions.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white border-none px-8">
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white">AiRA</span>
          </div>
          <p className="text-xs text-white/30">
            © 2025 AiRA Trading Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
