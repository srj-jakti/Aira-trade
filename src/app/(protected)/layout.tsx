import { Navigation } from "@/components/Navigation";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
          <Navigation />
            <main className="pt-12 md:pt-20 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4 min-h-screen">
              {children}
            </main>
    </>
  );
}
