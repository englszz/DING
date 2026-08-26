"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMessage("No se pudo conectar con Supabase. Revisa las variables de entorno.");
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setErrorMessage("Ocurrió un error al iniciar sesión.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center justify-center p-4">
      
      {/* Top Navigation */}
      <div className="fixed top-6 left-6 z-20">
        <Link
          href="/"
          className="btn btn-ghost text-sm flex items-center gap-2"
          style={{ textDecoration: "none" }}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Volver</span>
        </Link>
      </div>

      {/* Main Login Form Card — Surface #F7F9FA, Border #E5E7EB, Radius 0 */}
      <div className="relative z-10 w-full max-w-md card">
        
        {/* Brand Logo Header — Centered with >=24px separation (mb-8) */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-10 mb-6">
            <Image
              src="/assets/logo2.png"
              alt="DING logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          
          {/* Title in Sentence Case — Inter font body */}
          <h1 className="text-xl font-bold text-center tracking-tight text-[var(--color-text)]">
            Inicia sesión en tu cuenta
          </h1>
        </div>

        {/* Error message banner if any */}
        {errorMessage && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Secondary Auth Option: Google (Neutral btn-outline) */}
        <div className="mb-6">
          <button
            id="btn-google-login"
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="btn btn-outline w-full py-3 text-sm font-medium flex items-center justify-center gap-3"
          >
            <FontAwesomeIcon icon={faGoogle} className="text-base text-accent-2" />
            <span>Continuar con Google</span>
          </button>
        </div>

        {/* Divider — Section spacing 24px (mb-6) */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-[1px] bg-[var(--color-border)]" />
          <span className="text-muted text-xs font-normal">
            o con correo electrónico
          </span>
          <div className="flex-1 h-[1px] bg-[var(--color-border)]" />
        </div>

        {/* Form Fields — 16px field spacing, 8px label spacing */}
        <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className="form-label">
              Correo electrónico
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="form-input"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="login-password" className="form-label mb-0">
                Contraseña
              </label>
              {/* Teal link */}
              <Link
                href="/forgot-password"
                className="text-teal hover:underline text-xs"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          {/* SINGLE PRIMARY CTA BUTTON: Teal background #0097B2 */}
          <button
            id="btn-email-login"
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-3 mt-2 font-medium"
          >
            {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>

        {/* Register Text Link */}
        <p className="text-center text-muted text-sm mt-8 pt-6 border-t border-[var(--color-border)]">
          ¿No tienes cuenta?{" "}
          <Link
            href="/register"
            className="text-teal font-medium hover:underline ml-1"
          >
            Regístrate gratis
          </Link>
        </p>
      </div>
    </main>
  );
}
