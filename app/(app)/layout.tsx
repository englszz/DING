import Image from "next/image";
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
      <footer className="py-10 text-center border-t border-[var(--color-border)] mt-12 bg-[var(--color-surface)]">
        <div className="flex items-center justify-center mb-3">
          <div className="relative w-56 h-20">
            <Image
              src="/assets/íconoazultransparent.png"
              alt="DING"
              fill
              sizes="224px"
              className="object-contain"
            />
          </div>
        </div>
        <p className="text-muted text-xs font-medium">
          Proyecto Personal Engels · DING 2026
        </p>
      </footer>
    </div>
  );
}
