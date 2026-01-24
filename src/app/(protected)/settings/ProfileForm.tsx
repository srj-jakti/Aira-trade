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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();

          setProfile({
            full_name: data?.full_name || "",
            email: user.email || ""
          });
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
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
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/20" />
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
            className="bg-muted/50 border-border text-muted-foreground"
          />
          <p className="text-[10px] text-muted-foreground/60">Email cannot be changed.</p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input 
            id="fullName" 
            value={profile?.full_name || ""} 
            onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
            placeholder="Enter your full name"
            className="bg-background border-border"
          />
        </div>
  
        <Button 
          type="submit" 
          disabled={updating}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Update Profile
        </Button>
      </form>
    );
}
