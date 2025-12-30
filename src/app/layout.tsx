import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "AiRA | AI Trading App",
  description: "Fully automated AI trading and analysis platform.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AiRA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen overflow-x-hidden`}
      >
        <Navigation />
        <main className="pt-0 md:pt-16 pb-20 md:pb-0 min-h-screen">
          {children}
        </main>
        <VisualEditsMessenger />
      </body>
    </html>
  );
}
