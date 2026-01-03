"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Zap, Shield, Crown, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const plans = [
  {
    id: "basic",
    name: "BASIC",
    subtitle: "Platform Access",
    price: 999,
    period: "month",
    description: "Access to AiRA's AI-powered software tools for research, analysis, and strategy design.",
    sebiLabel: "For research, analysis, and strategy development only.",
    icon: Zap,
    color: "green",
    features: [
      { text: "Full access to Strategy Creation Module", included: true },
      { text: "Create, edit, and test strategies", included: true },
      { text: "Save private strategies", included: true },
      { text: "Full access to Strategy Library", included: true },
      { text: "AI Analysis Page with interactive charts", included: true },
      { text: "Indicator-based AI analysis", included: true },
      { text: "Full Market Scanner access", included: true },
      { text: "User-selected timeframes and instruments", included: true },
      { text: "AI-based automated execution", included: false },
      { text: "Broker account connection", included: false },
      { text: "Invite-only strategy publishing", included: false },
      { text: "Background automation", included: false },
    ],
    popular: false,
    visible: true,
  },
  {
    id: "pro",
    name: "PRO",
    subtitle: "User-Controlled Automation",
    price: 1499,
    period: "month",
    description: "All BASIC features plus user-initiated automated execution, fully controlled by you.",
    sebiLabel: "Execution automation based on user-defined logic. No advisory or discretionary actions.",
    icon: Shield,
    color: "blue",
    features: [
      { text: "Everything in BASIC", included: true },
      { text: "AI Automation Engine (User-Controlled)", included: true },
      { text: "Executes strictly based on your strategies", included: true },
      { text: "Manual Broker Login (Daily)", included: true },
      { text: "No credential storage for auto-login", included: true },
      { text: "Strategy-based execution only", included: true },
      { text: "Real-time execution monitoring", included: true },
      { text: "Automation runs only after user login", included: true },
      { text: "Invite-only strategy publishing", included: false },
      { text: "Auto broker login", included: false },
      { text: "Continuous background automation", included: false },
    ],
    popular: true,
    visible: true,
  },
  {
    id: "elite",
    name: "ELITE",
    subtitle: "Advanced Automation & Strategy Sharing",
    price: 2499,
    period: "month",
    description: "Advanced platform access for power users who want automation + private strategy distribution.",
    sebiLabel: "Advanced execution automation and private strategy distribution tools. User retains full control.",
    icon: Crown,
    color: "purple",
    features: [
      { text: "Everything in BASIC + PRO", included: true },
      { text: "Invite-Only Strategy Publishing", included: true },
      { text: "Create and share private strategies", included: true },
      { text: "Manage invite access yourself", included: true },
      { text: "Automatic Broker Login (Optional)", included: true },
      { text: "Manual daily login also supported", included: true },
      { text: "Continuous automation (as configured)", included: true },
      { text: "Advanced automation settings & controls", included: true },
      { text: "Priority support", included: true },
      { text: "Early access to new features", included: true },
    ],
    popular: false,
    visible: true,
  },
  {
    id: "admin",
    name: "ADMIN",
    subtitle: "Full Platform Access",
    price: 0,
    period: "month",
    description: "Full administrative access to all platform features including admin panel.",
    sebiLabel: "Internal admin access only.",
    icon: Crown,
    color: "red",
    features: [
      { text: "Everything in ELITE", included: true },
      { text: "Admin Panel Access", included: true },
      { text: "User Management", included: true },
      { text: "System Configuration", included: true },
      { text: "All API Configurations", included: true },
      { text: "Strategy Approval", included: true },
      { text: "Full System Control", included: true },
    ],
    popular: false,
    visible: false,
  },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const getPrice = (basePrice: number) => {
    if (billingPeriod === "yearly") {
      return Math.round(basePrice * 10);
    }
    return basePrice;
  };

  const handleSubscribe = (planId: string) => {
    console.log("Subscribe to plan:", planId);
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Zap className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">AiRA</span>
          </Link>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-8">
            Access powerful AI-powered analysis and automation tools. All plans include full platform features based on your needs.
          </p>

          <div className="inline-flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-full mb-8">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all",
                billingPeriod === "monthly"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all",
                billingPeriod === "yearly"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              )}
            >
              Yearly
              <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                2 months free
              </Badge>
            </button>
          </div>
        </div>

<div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-12">
            {plans.filter(p => p.visible !== false).map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={cn(
                "relative rounded-2xl border p-6 lg:p-8 flex flex-col",
                plan.popular
                  ? "bg-blue-500/10 border-blue-500/30 scale-105"
                  : "bg-white/5 border-white/10"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white border-none px-4">
                    Most Popular
                  </Badge>
                </div>
              )}

              <div className="mb-6">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                  plan.color === "green" && "bg-green-500/20",
                  plan.color === "blue" && "bg-blue-500/20",
                  plan.color === "purple" && "bg-purple-500/20"
                )}>
                  <plan.icon className={cn(
                    "w-6 h-6",
                    plan.color === "green" && "text-green-400",
                    plan.color === "blue" && "text-blue-400",
                    plan.color === "purple" && "text-purple-400"
                  )} />
                </div>
                
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-sm text-white/50">{plan.subtitle}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    ₹{getPrice(plan.price).toLocaleString("en-IN")}
                  </span>
                  <span className="text-white/50">
                    /{billingPeriod === "yearly" ? "year" : "month"}
                  </span>
                </div>
                {billingPeriod === "yearly" && (
                  <p className="text-sm text-green-400 mt-1">
                    Save ₹{(plan.price * 2).toLocaleString("en-IN")} per year
                  </p>
                )}
              </div>

              <p className="text-sm text-white/60 mb-6">
                {plan.description}
              </p>

              <div className="flex-1 space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-5 h-5 text-white/20 shrink-0 mt-0.5" />
                    )}
                    <span className={cn(
                      "text-sm",
                      feature.included ? "text-white/80" : "text-white/30"
                    )}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-white/5 rounded-lg mb-6">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-white/50 italic">
                    {plan.sebiLabel}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => handleSubscribe(plan.id)}
                className={cn(
                  "w-full h-12 font-medium",
                  plan.popular
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                )}
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-500/20 rounded-lg shrink-0">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-400 mb-2">Important Disclosure</h3>
                <p className="text-sm text-amber-300/80 leading-relaxed">
                  AiRA is a software platform providing analytical and automation tools. It does not provide investment advice, portfolio management, or trade recommendations. All trading decisions and configurations are made solely by the user. By subscribing, you agree to our{" "}
                  <Link href="/legal/terms" className="underline hover:text-amber-200">Terms & Conditions</Link>,{" "}
                  <Link href="/legal/privacy" className="underline hover:text-amber-200">Privacy Policy</Link>, and{" "}
                  <Link href="/legal/risk-disclosure" className="underline hover:text-amber-200">Risk Disclosure</Link>.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto grid gap-4 text-left">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="font-semibold text-white mb-2">Is AiRA an investment advisor?</h3>
              <p className="text-sm text-white/60">
                No. AiRA is a technology platform / software tool only. We do not provide investment advice, 
                manage funds, or place trades on behalf of users. All actions are user-configured and user-authorized.
              </p>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="font-semibold text-white mb-2">What happens after I subscribe?</h3>
              <p className="text-sm text-white/60">
                You get immediate access to all features included in your plan. You can start creating strategies, 
                using the AI analysis tools, and (for PRO/ELITE) connecting your broker for user-controlled automation.
              </p>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="font-semibold text-white mb-2">Can I cancel my subscription?</h3>
              <p className="text-sm text-white/60">
                Yes. You may cancel your subscription at least 2 days before the next billing date. 
                Cancellation stops future billing but does not trigger a refund for the current period.
              </p>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="font-semibold text-white mb-2">Are there any guaranteed returns?</h3>
              <p className="text-sm text-white/60">
                No. Trading involves risk. Past performance of any strategy does not guarantee future results. 
                AiRA does not guarantee profitability or any specific outcomes.
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <Link href="/legal/terms" className="text-sm text-white/40 hover:text-white/60 transition-colors">
              Terms & Conditions
            </Link>
            <Link href="/legal/privacy" className="text-sm text-white/40 hover:text-white/60 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/legal/risk-disclosure" className="text-sm text-white/40 hover:text-white/60 transition-colors">
              Risk Disclosure
            </Link>
          </div>
          <p className="text-xs text-white/30 max-w-2xl mx-auto">
            AiRA is a software platform providing analytical and automation tools only. It does not provide investment advice, trading recommendations, or financial services of any kind.
          </p>
          <p className="text-xs text-white/20 mt-4">© 2025 AiRA. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
