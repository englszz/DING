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
  faChartLine,
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";
import { FeaturedAlbums } from "@/components/FeaturedAlbums";
import { Footer } from "@/components/layout/Footer";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: pf } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    const statsHref = pf?.username
      ? `/profile/${pf.username}/statistics`
      : "/search";
    return (
      <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        <nav className="nav">
          <div className="page-container landing-nav-inner w-full flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-8 w-20 sm:h-10 sm:w-32 flex-shrink-0">
                <Image src="/assets/logo2.png" alt="DING logo" fill sizes="128px" className="object-contain" priority />
              </div>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4 font-medium">
              <ThemeToggle />
              <Link href="/dashboard" className="btn btn-primary text-xs sm:text-sm px-2 sm:px-4">
                Mi diario
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>
          </div>
        </nav>

        <section
          className="relative flex flex-col items-center justify-center px-6 pb-12 sm:pb-14"
          style={{ paddingTop: "104px" }}
        >
          <div className="relative z-10 flex flex-col items-center text-center max-w-4xl">
            <div className="mb-3 sm:mb-4 flex flex-col items-center">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4">
                <Image src="/assets/icon-blue.png" alt="DING Star Icon" fill sizes="112px" className="object-contain" priority />
              </div>
            </div>

            <h1
              className="font-display text-teal mb-4 sm:mb-6"
              style={{ fontSize: "clamp(1.8rem, 5vw, 3.5rem)", lineHeight: 1.1 }}
            >
              Tu diario musical te espera
            </h1>

            <p className="text-muted max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed px-4 sm:px-6">
              Continúa registrando tus escuchas, calificando álbumes y <br className="hidden sm:inline" />
              construyendo tu historial musical.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6" style={{ marginTop: "36px" }}>
              <Link href="/dashboard" className="btn btn-primary text-sm sm:text-base py-3 px-6 sm:py-3.5 sm:px-8 font-medium">
                <span>Ir a mi diario</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
              <Link href="/search" className="btn btn-outline text-sm sm:text-base py-3 px-6 sm:py-3.5 sm:px-8 font-medium">
                <span>Buscar álbumes</span>
              </Link>
              <Link href={statsHref} className="btn btn-outline text-sm sm:text-base py-3 px-6 sm:py-3.5 sm:px-8 font-medium">
                <span>Ver estadísticas</span>
                <FontAwesomeIcon icon={faChartLine} />
              </Link>
            </div>
          </div>
        </section>

        <FeaturedAlbums signedIn />

        {/* Features */}
        <section className="py-12 sm:py-16 px-6">
          <div className="page-container">
            <h2 className="section-title">Características Principales</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <FeatureCard icon={faStar} title="Califica Álbumes" desc="Puntúa cada álbum del 0.0 al 10.0. Califica canciones individualmente si lo deseas." />
              <FeatureCard icon={faBookOpen} title="Diario de Escuchas" desc="Guarda cada reescucha en tu diario. Regístralas múltiples veces como en Letterboxd." />
              <FeatureCard icon={faMagnifyingGlass} title="Metadatos Abiertos" desc="Búsqueda directa en MusicBrainz y portadas en alta calidad de Cover Art Archive." />
            </div>
          </div>
        </section>

        <Footer />
    </main>
  );
}

  // Public landing
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <nav className="nav">
        <div className="page-container landing-nav-inner w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-8 w-20 sm:h-10 sm:w-32 flex-shrink-0">
              <Image src="/assets/logo2.png" alt="DING logo" fill sizes="128px" className="object-contain" priority />
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 font-medium">
            <ThemeToggle />
            <Link href="/login" className="btn btn-ghost text-xs sm:text-sm px-2 sm:px-4"><span className="sm:hidden">Entrar</span><span className="hidden sm:inline">Iniciar sesión</span></Link>
            <Link href="/register" className="btn btn-primary text-xs sm:text-sm px-2 sm:px-4">Crear cuenta</Link>
          </div>
        </div>
      </nav>

        <section
          className="relative flex flex-col items-center justify-center px-6 pb-12 sm:pb-14"
          style={{ paddingTop: "104px" }}
        >
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl">
          <div className="mb-3 sm:mb-4 flex flex-col items-center">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4">
              <Image src="/assets/icon-blue.png" alt="DING Star Icon" fill sizes="112px" className="object-contain" priority />
            </div>
          </div>

          <h1
            className="font-display text-teal mb-4 sm:mb-6"
            style={{ fontSize: "clamp(1.8rem, 5vw, 3.5rem)", lineHeight: 1.1 }}
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

      <FeaturedAlbums signedIn={false} />

      {/* Features */}
      <section className="py-12 sm:py-16 px-6">
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
      <section className="py-12 sm:py-16 px-6">
        <div className="page-container">
          <h2 className="section-title">Cómo Funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <StepCard icon={faUserPlus} title="Crea tu cuenta" desc="Regístrate con Google en segundos. Elige tu nombre de usuario y personaliza tu perfil." />
            <StepCard icon={faSearch} title="Busca y registra" desc="Encuentra cualquier álbum en MusicBrainz. Registra cada escucha en tu diario personal." />
            <StepCard icon={faPenToSquare} title="Califica y comparte" desc="Puntúa álbumes y canciones. Tu diario es tuyo — compártelo con quien quieras." />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: IconDefinition; title: string; desc: string }) {
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

function StepCard({ icon, title, desc }: { icon: IconDefinition; title: string; desc: string }) {
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
