"use client";

import { useEffect, useState } from "react";

type PwaDebugInfo = {
  buildVersion: string | null;
  activeScriptUrl: string | null;
  controllerUrl: string | null;
  cacheNames: string[];
  lastUpdate: string | null;
  swState: string | null;
};

export default function PwaDebugPage() {
  const [info, setInfo] = useState<PwaDebugInfo | null>(null);

  useEffect(() => {
    const loadInfo = async () => {
      if (!("serviceWorker" in navigator)) {
        setInfo({
          buildVersion: null,
          activeScriptUrl: null,
          controllerUrl: null,
          cacheNames: [],
          lastUpdate: null,
          swState: null,
        });
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const controller = navigator.serviceWorker.controller;
      const cacheNames = await caches.keys();
      const controllerUrl = controller?.scriptURL ?? null;
      const activeScriptUrl = registration?.active?.scriptURL ?? null;
      const buildVersion = controllerUrl
        ? new URL(controllerUrl).searchParams.get("build")
        : localStorage.getItem("pwa:buildVersion");

      setInfo({
        buildVersion,
        activeScriptUrl,
        controllerUrl,
        cacheNames,
        lastUpdate: localStorage.getItem("pwa:lastUpdate"),
        swState: registration?.active?.state ?? null,
      });
    };

    loadInfo();
  }, []);

  if (!info) {
    return (
      <main className="p-6 text-sm text-muted-foreground">
        Loading PWA debug data...
      </main>
    );
  }

  return (
    <main className="p-6 text-sm text-muted-foreground">
      <h1 className="text-lg font-semibold text-foreground">PWA Debug</h1>
      <div className="mt-4 space-y-2">
        <div>
          <span className="font-medium text-foreground">SW build:</span>{" "}
          {info.buildVersion ?? "Not available"}
        </div>
        <div>
          <span className="font-medium text-foreground">SW state:</span>{" "}
          {info.swState ?? "Unknown"}
        </div>
        <div>
          <span className="font-medium text-foreground">Active script:</span>{" "}
          {info.activeScriptUrl ?? "None"}
        </div>
        <div>
          <span className="font-medium text-foreground">Controller:</span>{" "}
          {info.controllerUrl ?? "None"}
        </div>
        <div>
          <span className="font-medium text-foreground">Last update:</span>{" "}
          {info.lastUpdate ?? "Unknown"}
        </div>
        <div>
          <span className="font-medium text-foreground">Cache names:</span>
          <ul className="mt-2 list-inside list-disc">
            {info.cacheNames.length === 0 ? (
              <li>No caches found</li>
            ) : (
              info.cacheNames.map((name) => <li key={name}>{name}</li>)
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
