"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useState(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Invalid or expired reset link. Please request a new one.");
      }
      setCheckingSession(false);
    };
    checkSession();
  });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push("/signin");
      }, 3000);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-2xl space-y-6 text-center backdrop-blur-sm">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Password Updated</h1>
          <p className="text-white/50">
            Your password has been successfully reset. Redirecting you to sign in...
          </p>
          <Link href="/signin">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Zap className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">AiRA</span>
          </Link>
          <h1 className="text-3xl font-bold text-white">New Password</h1>
          <p className="text-white/50 text-sm">Enter your new password below</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl space-y-6 backdrop-blur-sm">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white pl-10 h-11 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/70">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white pl-10 h-11 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
