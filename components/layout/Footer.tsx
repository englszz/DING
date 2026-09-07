import Image from "next/image";

export function Footer() {
  return (
      <footer className="px-6 py-12 sm:py-14 text-center border-t border-[var(--color-border)] mt-12 sm:mt-16 bg-[var(--color-surface)]">
        <div className="flex items-center justify-center mb-5">
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
        <p className="text-muted text-xs font-medium leading-relaxed flex flex-wrap justify-center gap-x-2 gap-y-2">
          <span>Proyecto Personal</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="basis-full sm:basis-auto">Engels Smith Damirón · DING</span>
        </p>
      </footer>
  );
}
