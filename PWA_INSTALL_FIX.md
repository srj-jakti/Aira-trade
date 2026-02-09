# PWA Install Prompt Fix - 2026-02-09

## Issues Identified

1. **Timer Cleanup Bug**: Timer was created inside event handler but cleanup function was returned from handler instead of useEffect
2. **Session Storage Check**: Check happened after component render, causing unnecessary renders
3. **Missing Console Logs**: No debugging information to track prompt behavior
4. **Missing Assets**: favicon.ico, og-image.png, and apple-touch-icon.png were missing
5. **Incomplete Manifest**: Missing orientation, categories, and proper icon purposes
6. **Browser Install Button Not Showing**: Missing explicit manifest link and PWA meta tags in HTML head

## Changes Made

### 1. Fixed PWAInstallPrompt.tsx
- Moved timer to useEffect scope with proper cleanup
- Added isDismissed state to prevent unnecessary renders
- Added console.log statements for debugging
- Reduced prompt delay from 5-10s to 3-5s
- Fixed timer cleanup in useEffect return

### 2. Added Missing Assets
- Created favicon.ico from icon-192x192.png
- Created og-image.png from icon-512x512.png
- Created apple-touch-icon.png from icon-192x192.png

### 3. Updated manifest.json
- Added `orientation: "any"` (was portrait-primary, which can prevent install)
- Added `categories: ["finance", "business", "productivity"]`
- Added `prefer_related_applications: false` (required for browser install button)
- Split icons into separate entries for "any" and "maskable" purposes
- Added `start_url: "/?source=pwa"` to track PWA installs
- Removed screenshots section (missing assets)

### 4. Enhanced layout.tsx for Browser Install Button
- Added explicit `<link rel="manifest" href="/manifest.json" />` in head
- Added `mobile-web-app-capable` meta tag
- Added `apple-mobile-web-app-capable` meta tag
- Added `apple-mobile-web-app-status-bar-style` meta tag
- Added `apple-mobile-web-app-title` meta tag

## Testing

Build completed successfully with no errors:
```
✓ Compiled successfully in 10.8s
✓ Checking validity of types
✓ Collecting page data
✓ Generating static pages (74/74)
```

## Deployment

Changes pushed to GitHub (github-integ/main):
- Commit 1: 664c9ba - "fix: PWA install prompt not showing"
- Commit 2: 5aee260 - "feat: enable browser install button in URL bar"

## How to Verify

### Browser Install Button (Address Bar)
1. Open https://aira.trade in Chrome/Edge (desktop or Android)
2. Look for install icon (⊕ or download icon) in the address bar
3. Click it to install the PWA

### Custom Install Prompt
1. Open the site in Chrome/Edge on desktop or mobile
2. Open DevTools Console
3. Look for PWA logs:
   - `[PWA] beforeinstallprompt event fired`
   - `[PWA] Showing install prompt`
4. Custom install prompt should appear after 3 seconds
5. On iOS, manual prompt appears after 5 seconds

### PWA Installability Criteria Met
✓ Valid manifest.json with required fields
✓ Service worker registered
✓ HTTPS enabled (via Vercel)
✓ Icons in multiple sizes (192x192, 512x512)
✓ start_url defined
✓ display: standalone
✓ Explicit manifest link in HTML

## Next Steps

- Monitor console logs in production to verify prompt is showing
- Check Vercel deployment for successful build
- Test on multiple devices:
  - Chrome/Edge on Android (browser install button + custom prompt)
  - Safari on iOS (custom prompt with instructions)
  - Chrome/Edge on desktop (browser install button + custom prompt)
- Consider adding analytics to track install conversions
- Test PWA functionality after installation (offline mode, push notifications if added later)

