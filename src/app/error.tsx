"use client";

import { useEffect } from "react";
import Link from "next/link";
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="bg-red-500/10 p-4 rounded-full mb-6">
        <AlertCircle className="w-12 h-12 text-red-500" />
      </div>
      <div className="text-center z-10 max-w-md">
        <h2 className="text-3xl font-semibold mb-4 text-foreground">Market Crash!</h2>
        <p className="text-muted-foreground mb-8">
          Something went wrong while processing the data. Don&apos;t worry, your trades are safe.
          We&apos;ve logged the incident and our algorithms are investigating.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium transition-all hover:bg-primary/90 active:scale-95"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-muted border border-border text-foreground rounded-full font-medium transition-all hover:bg-muted/80 active:scale-95"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
      
      <div className="mt-12 text-muted-foreground/30 text-xs font-mono">
        Error ID: {error.digest || "unknown_incident"}
      </div>
    </div>
  );
}
