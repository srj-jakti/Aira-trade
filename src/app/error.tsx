"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="bg-red-500/10 p-4 rounded-full mb-6">
        <AlertCircle className="w-12 h-12 text-red-500" />
      </div>
      <div className="text-center z-10 max-w-md">
        <h2 className="text-3xl font-semibold mb-4 text-white">Market Crash!</h2>
        <p className="text-white/60 mb-8">
          Something went wrong while processing the data. Don&apos;t worry, your trades are safe.
          We&apos;ve logged the incident and our algorithms are investigating.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium transition-all hover:bg-white/90 active:scale-95"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-full font-medium transition-all hover:bg-white/10 active:scale-95"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
      
      <div className="mt-12 text-white/20 text-xs font-mono">
        Error ID: {error.digest || "unknown_incident"}
      </div>
    </div>
  );
}
