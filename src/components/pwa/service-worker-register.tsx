"use client";

import { useEffect, useRef } from "react";

const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";

export function ServiceWorkerRegister() {
  const refreshRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          `/service-worker.js?build=${buildVersion}`,
          { scope: "/" }
        );

        console.info("[PWA] SW registered", {
          buildVersion,
          scope: registration.scope,
        });
        localStorage.setItem("pwa:buildVersion", buildVersion);
        localStorage.setItem("pwa:lastUpdate", new Date().toISOString());

        registration.update();

        if (registration.waiting) {
          console.info("[PWA] Waiting SW found, activating");
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          console.info("[PWA] Update found");
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.info("[PWA] New version detected, activating");
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshRef.current) return;
          refreshRef.current = true;
          localStorage.setItem("pwa:lastUpdate", new Date().toISOString());
          console.info("[PWA] Controller changed, reloading");
          window.location.reload();
        });
      } catch (error) {
        console.error("[PWA] SW registration failed", error);
      }
    };

    register();
  }, []);

  return null;
}
