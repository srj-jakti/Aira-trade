import Link from "next/link";
import { MoveLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <h1 className="text-9xl font-bold text-white/10 mb-[-1rem]">404</h1>
      <div className="text-center z-10">
        <h2 className="text-3xl font-semibold mb-4 text-white">Lost in the Markets?</h2>
        <p className="text-white/60 mb-8 max-w-md mx-auto">
          The page you are looking for doesn&apos;t exist or has been moved to another coordinate in the trading universe.
        </p>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium transition-all hover:bg-white/90 active:scale-95"
        >
          <MoveLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 blur-3xl rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 blur-3xl rounded-full" />
      </div>
    </div>
  );
}
