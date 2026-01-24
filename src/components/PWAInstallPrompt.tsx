"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("SW registered: ", registration);
          })
          .catch((registrationError) => {
            console.log("SW registration failed: ", registrationError);
          });
      });
    }

    // Check if already in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandaloneMode) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Show manual prompt for iOS if not standalone
    if (ios && !isStandaloneMode) {
      const lastShown = localStorage.getItem('pwa-ios-prompt-last-shown');
      const now = Date.now();
      // Show every 7 days
      if (!lastShown || now - parseInt(lastShown) > 7 * 24 * 60 * 60 * 1000) {
        setIsVisible(true);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      toast.info("To install: Tap the share button and then 'Add to Home Screen'", {
        duration: 5000,
      });
      localStorage.setItem('pwa-ios-prompt-last-shown', Date.now().toString());
      setIsVisible(false);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsVisible(false);
      toast.success("AiRA is being installed!");
    }
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden border border-primary/20">
            <img src="/logo.svg" alt="AiRA Logo" className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Install AiRA App</h3>
            <p className="text-xs text-muted-foreground">Access AiRA directly from your home screen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleInstallClick} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Install
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setIsVisible(false)} className="h-8 w-8 text-muted-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
