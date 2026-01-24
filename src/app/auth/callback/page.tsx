"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Processing...");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (accessToken && type === "recovery") {
        setStatus("Setting up your session...");
        
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (error) {
          console.error("Session error:", error);
          setStatus("Error setting session. Redirecting to sign in...");
          setTimeout(() => router.push("/signin?error=session-error"), 2000);
          return;
        }

        setStatus("Redirecting to password reset...");
        router.push("/reset-password");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push("/dashboard");
      } else {
        router.push("/signin");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/reset-password");
      } else if (event === "SIGNED_IN" && session) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get("type");
        
        if (type === "recovery") {
          router.push("/reset-password");
        } else {
          router.push("/dashboard");
        }
      }
    });

    handleAuthCallback();

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
        <p className="text-white/70">{status}</p>
      </div>
    </div>
  );
}
