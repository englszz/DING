import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar,
  faBookOpen,
  faMagnifyingGlass,
  faArrowRight,
  faUserPlus,
  faSearch,
  faPenToSquare,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        <nav className="nav">
          <div className="page-container w-full flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-8 w-24 sm:h-10 sm:w-32 flex-shrink-0">
                <Image src="/assets/logo2.png" alt="DING logo" fill sizes="128px" className="object-contain" priority />
              </div>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4 font-medium">
              <Link href="/dashboard" className="btn btn-primary text-xs sm:text-sm px-2 sm:px-4">
                Mi diario
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>
          </div>
        </nav>

        <section
          className="relative flex flex-col items-center justify-center min-h-[85vh] px-5 sm:px-6 pb-24"
          style={{ paddingTop: "120px" }}
        >
          <div className="relative z-10 flex flex-col items-center text-center max-w-4xl">
            <div className="mb-6 sm:mb-8 flex flex-col items-center">
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 mx-auto mb-4">
                <Image src="/assets/icon-blue.png" alt="DING Star Icon" fill sizes="112px" className="object-contain" priority />
              </div>
            </div>

            <h1
              className="font-display text-teal mb-4 sm:mb-6"
              style={{ fontSize: "clamp(1.8rem, 6.5vw, 5rem)", lineHeight: 1.1 }}
            >
              Tu diario musical te espEra
            </h1>

            <p className="text-muted max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed px-4 sm:px-6">
              Continúa registrando tus escuchas, calificando álbumes <br className="hidden sm:inline" />
              <span className="sm:hidden">y </span>construyendo tu historial musical.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6" style={{ marginTop: "36px" }}>
              <Link href="/dashboard" className="btn btn-primary text-sm sm:text-base py-3 px-6 sm:py-3.5 sm:px-8 font-medium">
                <span>Ir a mi diario</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
              <Link href="/search" className="btn btn-outline text-sm sm:text-base py-3 px-6 sm:py-3.5 sm:px-8 font-medium">
                <span>Buscar álbumes</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 px-6">
          <div className="page-container">
            <h2 className="section-title">Características Principales</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <FeatureCard icon={faStar} title="Califica Álbumes" desc="Puntúa cada álbum del 0.0 al 10.0. Califica canciones individualmente si lo deseas." />
              <FeatureCard icon={faBookOpen} title="Diario de Escuchas" desc="Guarda cada reescucha en tu diario. Regístralas múltiples veces como en Letterboxd." />
              <FeatureCard icon={faMagnifyingGlass} title="Metadatos Abiertos" desc="Búsqueda directa en MusicBrainz y portadas en alta calidad de Cover Art Archive." />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 sm:py-32 px-6">
          <div className="page-container">
            <h2 className="section-title">Cómo Funciona</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <StepCard icon={faUserPlus} number="1" title="Crea tu cuenta" desc="Regístrate con Google en segundos. Elige tu nombre de usuario y personaliza tu perfil." />
              <StepCard icon={faSearch} number="2" title="Busca y registra" desc="Encuentra cualquier álbum en MusicBrainz. Registra cada escucha en tu diario personal." />
              <StepCard icon={faPenToSquare} number="3" title="Califica y comparte" desc="Puntúa álbumes y canciones. Tu diario es tuyo — compártelo con quien quieras." />
            </div>
          </div>
        </section>

        <footer className="py-10 px-6 text-center border-t border-[var(--color-border)] mt-12 bg-[var(--color-surface)]">
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-56 h-20">
              <Image src="/assets/íconoazultransparent.png" alt="DING" fill sizes="224px" className="object-contain" />
            </div>
          </div>
          <p className="text-muted text-xs font-medium">
          Proyecto Personal · Engels Smith Damirón · DING
        </p>
      </footer>
    </main>
  );
}

  // Public landing
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <nav className="nav">
        <div className="page-container w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-8 w-24 sm:h-10 sm:w-32 flex-shrink-0">
              <Image src="/assets/logo2.png" alt="DING logo" fill sizes="128px" className="object-contain" priority />
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 font-medium">
            <Link href="/login" className="btn btn-ghost text-xs sm:text-sm px-2 sm:px-4">Iniciar sesión</Link>
            <Link href="/register" className="btn btn-primary text-xs sm:text-sm px-2 sm:px-4">Crear cuenta</Link>
          </div>
        </div>
      </nav>

      <section
        className="relative flex flex-col items-center justify-center min-h-[85vh] px-5 sm:px-6 pb-24"
        style={{ paddingTop: "120px" }}
      >
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl">
          <div className="mb-6 sm:mb-8 flex flex-col items-center">
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 mx-auto mb-4">
              <Image src="/assets/icon-blue.png" alt="DING Star Icon" fill sizes="112px" className="object-contain" priority />
            </div>
          </div>

          <h1
            className="font-display text-teal mb-4 sm:mb-6"
            style={{ fontSize: "clamp(1.8rem, 6.5vw, 5rem)", lineHeight: 1.1 }}
          >
            Registra, Califica & Descubre música
          </h1>

          <p className="text-muted max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed px-4 sm:px-6">
            Registra tu historial de escuchas. Puntúa álbumes y canciones track por track. Construye tu propio diario musical <br className="hidden sm:inline" />
            <span className="sm:hidden">y </span>compártelo con tus amigos.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6" style={{ marginTop: "36px" }}>
            <Link href="/register" className="btn btn-primary text-sm sm:text-base py-3 px-6 sm:py-3.5 sm:px-8 font-medium">
              <span>Empezar ahora</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
            <Link href="/login" className="btn btn-outline text-sm sm:text-base py-3 px-6 sm:py-3.5 sm:px-8 font-medium">
              <span>Ya tengo cuenta</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="page-container">
          <h2 className="section-title">Características Principales</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <FeatureCard icon={faStar} title="Califica Álbumes" desc="Puntúa cada álbum del 0.0 al 10.0 con tu propio criterio. Califica canciones individualmente si lo deseas." />
            <FeatureCard icon={faBookOpen} title="Diario de Escuchas" desc="Guarda cada reescucha en tu diario. Permite registrarlos múltiples veces como en Letterboxd." />
            <FeatureCard icon={faMagnifyingGlass} title="Metadatos Abiertos" desc="Búsqueda directa en la base de datos de MusicBrainz y portadas en alta calidad de Cover Art Archive." />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 sm:py-32 px-6">
        <div className="page-container">
          <h2 className="section-title">Cómo Funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <StepCard icon={faUserPlus} number="1" title="Crea tu cuenta" desc="Regístrate con Google en segundos. Elige tu nombre de usuario y personaliza tu perfil." />
            <StepCard icon={faSearch} number="2" title="Busca y registra" desc="Encuentra cualquier álbum en MusicBrainz. Registra cada escucha en tu diario personal." />
            <StepCard icon={faPenToSquare} number="3" title="Califica y comparte" desc="Puntúa álbumes y canciones. Tu diario es tuyo — compártelo con quien quieras." />
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 text-center border-t border-[var(--color-border)] mt-12 bg-[var(--color-surface)]">
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-56 h-20">
            <Image src="/assets/íconoazultransparent.png" alt="DING" fill sizes="224px" className="object-contain" />
          </div>
        </div>
        <p className="text-muted text-xs font-medium">
          Proyecto Personal · Engels Smith Damirón · DING
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="card text-center">
      <div className="flex justify-center mb-3">
        <FontAwesomeIcon icon={icon} width={25} height={25} style={{ color: "var(--color-teal)" }} />
      </div>
      <h3 className="font-bold text-[var(--color-text)] text-lg mb-2">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({ icon, number, title, desc }: { icon: any; number: string; title: string; desc: string }) {
  return (
    <div className="card text-center">
      <div className="flex justify-center mb-3">
        <FontAwesomeIcon icon={icon} width={25} height={25} style={{ color: "var(--color-teal)" }} />
      </div>
      <h3 className="font-bold text-[var(--color-text)] text-lg mb-2">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
