"use client";

import { Component, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-8 text-center">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="text-red-500 text-3xl mb-3"
          />
          <p className="font-bold text-[var(--color-text)] mb-2">
            Algo salió mal
          </p>
          <p className="text-muted text-sm mb-4">
            Ocurrió un error inesperado en esta sección.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="btn btn-primary text-xs"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
