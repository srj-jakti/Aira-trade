import { Navigation } from "@/components/Navigation";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
        <Navigation />
          <main className="pt-0 md:pt-16 pb-[calc(4.5rem+env(safe-area-inset-bottom,0.75rem))] md:pb-8 min-h-screen">
            {children}
          </main>
    </>
  );
}
