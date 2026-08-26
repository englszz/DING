"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignup = async () => {
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

  const handleEmailSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
      } else {
        setErrorMessage("Revisa tu correo para confirmar tu cuenta.");
        setIsLoading(false);
        // Do not redirect automatically, wait for email confirmation if require email confirmation is on
      }
    } catch (err: any) {
      setErrorMessage("Ocurrió un error al crear la cuenta.");
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
          <span>Volver al inicio</span>
        </Link>
      </div>

      {/* Main Register Form Card */}
      <div className="relative z-10 w-full max-w-md card mt-10">
        
        {/* Brand Logo Header */}
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
          
          <h1 className="text-xl font-bold text-center tracking-tight text-[var(--color-text)]">
            Únete a DING hoy mismo
          </h1>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Secondary Auth Option: Google */}
        <div className="mb-6">
          <button
            id="btn-google-signup"
            type="button"
            onClick={handleGoogleSignup}
            disabled={isLoading}
            className="btn btn-outline w-full py-3 text-sm font-medium flex items-center justify-center gap-3"
          >
            <FontAwesomeIcon icon={faGoogle} className="text-base text-accent-2" />
            <span>Registrarse con Google</span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-[1px] bg-[var(--color-border)]" />
          <span className="text-muted text-xs font-normal">
            o con correo electrónico
          </span>
          <div className="flex-1 h-[1px] bg-[var(--color-border)]" />
        </div>

        {/* Form Fields */}
        <form onSubmit={handleEmailSignup} className="flex flex-col gap-4">
          <div>
            <label htmlFor="reg-email" className="form-label">
              Correo electrónico
            </label>
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="form-input"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="form-label">
              Contraseña
            </label>
            <input
              id="reg-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="form-input"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label htmlFor="reg-confirm" className="form-label">
              Confirmar contraseña
            </label>
            <input
              id="reg-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          {/* PRIMARY CTA BUTTON: Teal background #0097B2 */}
          <button
            id="btn-email-signup"
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-3 mt-2 font-medium"
          >
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="text-muted text-xs text-center mt-4">
          Al registrarte, aceptas nuestros Términos de Servicio y Política de Privacidad.
        </p>

        {/* Login Text Link */}
        <p className="text-center text-muted text-sm mt-8 pt-6 border-t border-[var(--color-border)]">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="text-teal font-medium hover:underline ml-1"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
