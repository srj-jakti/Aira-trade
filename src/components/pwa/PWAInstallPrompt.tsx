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
  const [isDismissed, setIsDismissed] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  useEffect(() => {
    const debug = (msg: string) => {
      console.log(`[PWA Install] ${msg}`);
      setDebugInfo(prev => [...prev, msg]);
    };

    debug("Component mounted");

    // Check if already dismissed (use localStorage for persistence across sessions)
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    const dismissedTime = localStorage.getItem("pwa-prompt-dismissed-time");
    
    // Reset dismissal after 7 days
    if (dismissed && dismissedTime) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed > 7) {
        debug("Dismissal expired, resetting");
        localStorage.removeItem("pwa-prompt-dismissed");
        localStorage.removeItem("pwa-prompt-dismissed-time");
      } else {
        debug(`Dismissed ${daysSinceDismissed.toFixed(1)} days ago`);
        setIsDismissed(true);
        return;
      }
    }

    // Check if already in standalone mode
    const standalone = window.matchMedia("(display-mode: standalone)").matches || 
                      (window.navigator as any).standalone === true;
    
    if (standalone) {
      debug("Already in standalone mode");
      setIsStandalone(true);
      return;
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
    debug(`Platform: ${ios ? 'iOS' : 'Android/Desktop'}`);

    // Check PWA requirements
    debug(`HTTPS: ${window.location.protocol === 'https:'}`);
    debug(`Service Worker: ${'serviceWorker' in navigator}`);
    debug(`Manifest: ${document.querySelector('link[rel="manifest"]') ? 'Found' : 'Missing'}`);

    let promptTimer: NodeJS.Timeout | null = null;

    const handleBeforeInstallPrompt = (e: any) => {
      debug("beforeinstallprompt event fired!");
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after a short delay
      promptTimer = setTimeout(() => {
        debug("Showing install prompt");
        setShowPrompt(true);
      }, 2000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS or if event doesn't fire, show manual prompt after delay
    if (ios || !deferredPrompt) {
      debug(`Setting timer for manual prompt (iOS: ${ios})`);
      promptTimer = setTimeout(() => {
        debug("Showing manual prompt");
        setShowPrompt(true);
      }, 3000);
    }

    // Debug: Check if event fires at all
    setTimeout(() => {
      if (!deferredPrompt && !ios) {
        debug("WARNING: beforeinstallprompt not fired after 5s");
        debug("Possible reasons: Already installed, not HTTPS, or browser doesn't support");
        // Show manual prompt anyway for testing
        setShowPrompt(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (promptTimer) {
        clearTimeout(promptTimer);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log("[PWA] No deferred prompt available");
      return;
    }
    console.log("[PWA] User clicked install");
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log("[PWA] User choice:", outcome);
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowPrompt(false);
        localStorage.setItem("pwa-prompt-dismissed", "true");
        localStorage.setItem("pwa-prompt-dismissed-time", Date.now().toString());
      }
    } catch (error) {
      console.error("[PWA] Install prompt error:", error);
    }
  };

  const handleDismiss = () => {
    console.log("[PWA] User dismissed prompt");
    setShowPrompt(false);
    setIsDismissed(true);
    // Don't show again for 7 days
    localStorage.setItem("pwa-prompt-dismissed", "true");
    localStorage.setItem("pwa-prompt-dismissed-time", Date.now().toString());
  };

  if (isStandalone || isDismissed) {
    return null;
  }

  // Debug panel (only in development)
  const showDebug = process.env.NODE_ENV === 'development' && debugInfo.length > 0;

  return (
    <>
      {showDebug && (
        <div className="fixed top-4 right-4 z-[1002] bg-black/90 text-white p-4 rounded-lg text-xs max-w-xs max-h-96 overflow-auto">
          <h4 className="font-bold mb-2">PWA Debug Info:</h4>
          {debugInfo.map((info, i) => (
            <div key={i} className="mb-1">{info}</div>
          ))}
        </div>
      )}
      
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
    </>
  );
}
