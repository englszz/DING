"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-container py-16 flex-1 w-full flex items-center justify-center">
      <div className="card p-10 text-center max-w-md w-full">
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          className="text-red-500 text-4xl mb-4"
        />
        <h2 className="font-display text-teal text-2xl mb-2">
          Algo salió mal
        </h2>
        <p className="text-muted text-sm mb-6">
          Ocurrió un error inesperado. Intenta recargar la página.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn btn-primary text-xs"
          >
            Reintentar
          </button>
          <a href="/dashboard" className="btn btn-outline text-xs">
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
