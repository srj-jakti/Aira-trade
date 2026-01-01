import { Navigation } from "@/components/Navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-black">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 bg-black">
          <Navigation />
          <main className="flex-1 pb-24 md:pb-6 overflow-y-auto overflow-x-hidden scroll-smooth">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
