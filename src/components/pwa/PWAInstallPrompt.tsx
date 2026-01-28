"use client";

import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      return;
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a delay
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS, show prompt manually since beforeinstallprompt isn't supported
    if (ios) {
      const timer = setTimeout(() => setShowPrompt(true), 10000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (isStandalone) {
    return null;
  }

  // Ensure we don't render anything if the user has dismissed the prompt (checked in useEffect) or if we are on server
  if (typeof window !== "undefined" && sessionStorage.getItem("pwa-prompt-dismissed") === "true") {
    return null;
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-24 left-4 right-4 z-[1001] md:left-auto md:right-8 md:bottom-8 md:w-96"
        >
          <div className="bg-card border border-border/50 rounded-2xl shadow-2xl p-4 backdrop-blur-xl bg-card/95">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </button>

            <div className="flex gap-4">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Download className="size-6 text-primary" />
              </div>
              <div className="flex-1 pr-6">
                <h3 className="text-sm font-bold text-foreground">Install AiRA App</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {isIOS
                    ? "Tap the share button and then 'Add to Home Screen' to install AiRA on your device."
                    : "Add AiRA to your home screen for a better trading experience and real-time updates."}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {!isIOS ? (
                <Button
                  onClick={handleInstallClick}
                  className="w-full rounded-xl font-bold text-xs h-9 bg-primary hover:bg-primary/90"
                >
                  Install Now
                </Button>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 bg-muted/50 rounded-xl h-9 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4">
                  <Share className="size-3" /> Step: Share {">"} Add to Home Screen
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
