import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

// A connection failure while loading a route should not leave a blank screen.
// Reload is explicit: never discard an in-progress form through an automatic retry.
export class ScreenErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        role="alert"
        className="flex min-h-screen items-center justify-center bg-background p-6"
      >
        <section className="max-w-md rounded-2xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">
            Não foi possível abrir esta tela
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Confira sua conexão e tente recarregar. Se você estava preenchendo
            um formulário, as alterações não salvas podem precisar ser
            preenchidas novamente.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Recarregar página
          </Button>
          <a
            href="/"
            className="ml-4 inline-block text-sm text-emerald-300 underline"
          >
            Voltar ao painel
          </a>
        </section>
      </main>
    );
  }
}
