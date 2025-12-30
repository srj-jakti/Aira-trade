import { Navigation } from "@/components/Navigation";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navigation />
      <main className="pt-0 md:pt-16 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
    </>
  );
}
