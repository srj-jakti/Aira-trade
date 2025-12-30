"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single();

        if (data) {
          setProfile(data);
        }
      }
      setLoading(false);
    }
    getProfile();
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUpdating(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profile?.full_name })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated successfully");
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <form onSubmit={handleUpdate} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input 
          id="email" 
          value={profile?.email || ""} 
          disabled 
          className="bg-white/5 border-white/10 text-white/40"
        />
        <p className="text-[10px] text-white/20">Email cannot be changed.</p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input 
          id="fullName" 
          value={profile?.full_name || ""} 
          onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
          placeholder="Enter your full name"
          className="bg-white/5 border-white/10"
        />
      </div>

      <Button 
        type="submit" 
        disabled={updating}
        className="w-full bg-white text-black hover:bg-white/90"
      >
        {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Update Profile
      </Button>
    </form>
  );
}
