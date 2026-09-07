import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col"
      style={{ paddingTop: "125px" }}
    >
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* ── FOOTER ── */}
      <Footer />
    </div>
  );
}
