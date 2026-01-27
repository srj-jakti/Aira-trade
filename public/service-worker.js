/* eslint-disable no-restricted-globals */
const buildVersion = new URL(self.location.href).searchParams.get("build") || "dev";
const cachePrefix = `aira-pwa-${buildVersion}`;
const htmlCache = `${cachePrefix}-html`;
const assetCache = `${cachePrefix}-assets`;
const apiCache = `${cachePrefix}-api`;
const debugPrefix = `[PWA ${buildVersion}]`;

const log = (...args) => {
  // eslint-disable-next-line no-console
  console.info(debugPrefix, ...args);
};

self.addEventListener("install", (event) => {
  log("Installing service worker");
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      log("Activating service worker");
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (error) {
          log("Navigation preload enable failed", error);
        }
      }
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(cachePrefix))
          .map((key) => {
            log("Deleting old cache", key);
            return caches.delete(key);
          })
      );
      await self.clients.claim();
      log("Service worker active");
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    log("Skipping waiting on request");
    self.skipWaiting();
  }
});

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.pathname.startsWith("/auth/") || url.searchParams.has("code")) {
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    log("Fetching latest HTML", url.pathname);
    event.respondWith(networkFirst(request, htmlCache));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, apiCache));
    return;
  }

  if (["script", "style", "font", "image"].includes(request.destination)) {
    event.respondWith(cacheFirst(request, assetCache));
    return;
  }

  event.respondWith(networkFirst(request, assetCache));
});
