"use client";

import { motion } from "framer-motion";
import { 
  User, 
  Key, 
  Bell, 
  Smartphone, 
  LogOut,
  Settings as SettingsIcon,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const settingsGroups = [
  {
    title: "Account & Security",
    items: [
      { icon: User, label: "Profile Information", desc: "Update your personal details and avatar." },
      { icon: Key, label: "API Keys", desc: "Manage your exchange connection keys." },
    ]
  },
  {
    title: "App Settings",
    items: [
      { icon: Bell, label: "Notifications", desc: "Configure trade alerts and AI signals.", toggle: true },
      { icon: Smartphone, label: "PWA Options", desc: "Manage offline access and home screen settings." },
    ]
  }
];

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-white/50 text-sm">Manage your account and platform preferences.</p>
      </div>

      <div className="space-y-8">
        {settingsGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/40 ml-1">{group.title}</h2>
            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <CardContent className="p-0 divide-y divide-white/5">
                {group.items.map((item, i) => (
                  <div 
                    key={item.label}
                    className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-white/60 group-hover:text-white transition-colors">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-white/40">{item.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.action && (
                        <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 uppercase tracking-tight">
                          {item.action}
                        </span>
                      )}
                      {item.toggle ? (
                        <Switch defaultChecked />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-white/20" />
                      )}
                    </div>
                  </div>
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
              <Button variant="outline" size="sm" className="border-red-500/20 text-red-500 hover:bg-red-500/10">
                <LogOut className="w-4 h-4 mr-2" />
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