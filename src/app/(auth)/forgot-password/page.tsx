"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Mail, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

    const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
  
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
  
      if (error) {
        toast.error(error.message);
        setError(error.message);
        setLoading(false);
      } else {
        toast.success("Reset link sent successfully");
        setSuccess(true);
        setLoading(false);
      }
    };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-2xl space-y-6 text-center backdrop-blur-sm">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Check your email</h1>
          <p className="text-white/50">
            We've sent a password reset link to <span className="text-white">{email}</span>.
            Please check your inbox to continue.
          </p>
          <Link href="/signin">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11">
              Back to Sign In
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
          <h1 className="text-3xl font-bold text-white">Reset Password</h1>
          <p className="text-white/50 text-sm">Enter your email and we'll send you a link to reset your password</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl space-y-6 backdrop-blur-sm">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              Send Reset Link
            </Button>
          </form>

          <Link
            href="/signin"
            className="flex items-center justify-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
