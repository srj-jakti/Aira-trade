"use client";

import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Shield, 
  BarChart3, 
  ArrowRight,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Logo } from "@/components/Logo";

const features = [
  {
    icon: Bot,
    title: "AI-Powered Analysis",
    description: "Advanced machine learning algorithms analyze market patterns in real-time."
  },
  {
    icon: TrendingUp,
    title: "Smart Analytics",
    description: "Deep insights into Indian market trends with analytical tools."
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
    <div className="min-h-screen bg-background text-foreground">
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
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border rounded-full text-sm text-muted-foreground">
                <Logo iconOnly size="sm" className="h-4 w-4" />
                AI-Powered Market Analysis Platform
              </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="text-foreground">Analyze Smarter with</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                AiRA Intelligence
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              AI-powered market analysis and automation platform for Indian Markets. 
              Make data-driven decisions with real-time analytical insights.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/pricing">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white border-none px-8">
                  View Pricing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/signin">
                <Button size="lg" variant="outline" className="bg-muted/50 border-border hover:bg-muted text-foreground px-8">
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
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose AiRA?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Experience the future of market analysis with our cutting-edge AI technology
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
                className="p-6 bg-muted/30 border border-border rounded-2xl hover:bg-muted/50 transition-colors group"
              >
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Ready to Start Analyzing?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Join thousands of users who are already using AiRA to make data-driven market decisions.
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

        <footer className="py-8 px-4 border-t border-border">
          <div className="max-w-6xl mx-auto flex flex-col items-center gap-4">
            <Logo size="md" />
            <div className="flex items-center justify-center gap-6 mb-2">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/legal/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms & Conditions
            </Link>
            <Link href="/legal/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/legal/risk-disclosure" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Risk Disclosure
            </Link>
          </div>
          <p className="text-[10px] text-muted-foreground text-center max-w-3xl leading-relaxed">
            AiRA is a software platform providing analytical and automation tools only. It does not provide investment advice, trading recommendations, or financial services. All decisions are made by the user. Past analytical outputs do not guarantee future results.
          </p>
          <p className="text-xs text-muted-foreground/60">
            © 2025 AiRA. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
