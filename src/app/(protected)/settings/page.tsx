"use client";

import { useState } from "react";
import { 
  User, 
  Key, 
  LogOut,
  ChevronRight,
  Loader2,
  Lock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const settingsGroups = [
    {
      title: "Account & Security",
      items: [
        { 
          icon: User, 
          label: "Profile Information", 
          desc: "Update your personal details and avatar.",
          component: <ProfileForm />
        },
        { 
          icon: Lock, 
          label: "Change Password", 
          desc: "Update your account password.",
          component: <PasswordForm />
        },
        { 
          icon: Key, 
          label: "API Keys", 
          desc: "Manage your exchange connection keys.",
          component: <div className="p-4 text-center text-white/40 italic">API Keys management coming soon.</div>
        },
      ]
    }
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-white/50 text-sm">Manage your account and platform preferences.</p>
      </div>

      <div className="space-y-8">
        {settingsGroups.map((group) => (
          <div key={group.title} className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/40 ml-1">{group.title}</h2>
            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <CardContent className="p-0 divide-y divide-white/5">
                {group.items.map((item) => (
                  <Dialog key={item.label}>
                    <DialogTrigger asChild>
                      <div className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-white/60 group-hover:text-white transition-colors">
                            <item.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-white">{item.label}</p>
                            <p className="text-xs text-white/40">{item.desc}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/20" />
                      </div>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0a0a0a] border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle>{item.label}</DialogTitle>
                        <DialogDescription className="text-white/40">
                          {item.desc}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        {item.component}
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}

        <div className="space-y-4 pt-4">
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-red-500">Sign Out</p>
                <p className="text-xs text-red-500/60">Logout from this device and clear session.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                onClick={handleLogout}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                Logout
              </Button>
            </CardContent>
          </Card>
          
          <div className="text-center">
            <p className="text-[10px] text-white/20 font-mono uppercase tracking-[0.2em]">AiRA Platform v1.4.2</p>
          </div>
        </div>
      </div>
    </div>
  );
}
