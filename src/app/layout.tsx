import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AiRA | AI Market Analysis Platform",
    template: "%s | AiRA",
  },
  description: "AI-powered market analysis and automation software platform for Indian Markets.",
  metadataBase: new URL("https://aira.trade"),
  keywords: ["trading", "AI", "market analysis", "nifty", "banknifty", "automation"],
  authors: [{ name: "AiRA Team" }],
  creator: "AiRA",
  publisher: "AiRA",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aira.trade",
    siteName: "AiRA",
    title: "AiRA | AI Market Analysis Platform",
    description: "AI-powered market analysis and automation software platform for Indian Markets.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AiRA Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AiRA | AI Market Analysis Platform",
    description: "AI-powered market analysis and automation software platform for Indian Markets.",
    images: ["/og-image.png"],
    creator: "@aira_trade",
  },
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/icon-192x192.png" }
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AiRA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import Script from "next/script";
import { useEffect } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen overflow-x-hidden pb-[safe-area-inset-bottom]`}
        >
        <Script
          id="orchids-browser-logs"
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts/orchids-browser-logs.js"
          strategy="afterInteractive"
          data-orchids-project-id="4c5c238c-6da6-4257-86ab-86cbb8b4222d"
        />
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
            >
              {/* <ServiceWorkerRegister /> */}
              {children}
              <Toaster />
              <VisualEditsMessenger />
            </ThemeProvider>

        </body>
    </html>
  );
}
