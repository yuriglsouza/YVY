import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense } from "react";
import { ScreenErrorBoundary } from "@/components/screen-error-boundary";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage"; // Import Login Page
import { TooltipProvider } from "@/components/ui/tooltip"; // Restored
import { Loader2 } from "lucide-react";

import { useUser } from "@/hooks/use-user";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const FarmList = lazy(() => import("@/pages/FarmList"));
const FarmDetails = lazy(() => import("@/pages/FarmDetails"));
const ClientList = lazy(() => import("@/pages/ClientList"));
const Settings = lazy(() => import("@/pages/Settings"));
const Plans = lazy(() => import("@/pages/Plans"));

function ScreenLoading() {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center gap-3 bg-background text-slate-300"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      Carregando tela...
    </div>
  );
}

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { data: user, isLoading, error } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If error (401) or no user, redirect to login
  if (error || !user) {
    // Redirect logic: simple window location for now as wouter doesn't have a direct imperative redirect easily accessible here without hook
    // Or render LoginPage directly
    return <LoginPage />;
  }

  return <Component />;
}

function Router() {
  const [location] = useLocation();
  return (
    <ScreenErrorBoundary key={location}>
      <Suspense fallback={<ScreenLoading />}>
        <Switch>
          <Route path="/login" component={LoginPage} />
          {/* Protect all other routes */}
          <Route
            path="/"
            component={() => <ProtectedRoute component={Dashboard} />}
          />
          <Route
            path="/farms"
            component={() => <ProtectedRoute component={FarmList} />}
          />
          <Route
            path="/clients"
            component={() => <ProtectedRoute component={ClientList} />}
          />
          <Route
            path="/farms/:id"
            component={() => <ProtectedRoute component={FarmDetails} />}
          />
          <Route
            path="/settings"
            component={() => <ProtectedRoute component={Settings} />}
          />
          <Route
            path="/plans"
            component={() => <ProtectedRoute component={Plans} />}
          />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </ScreenErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Global Watermark - Low Z-index to sit behind cards but on top of body bg */}
        <div className="fixed inset-0 z-[0] pointer-events-none flex items-center justify-center opacity-[0.15] select-none">
          <img
            src="/logo.png"
            alt=""
            className="w-[80vw] max-w-[800px] h-auto grayscale"
          />
        </div>
        <div className="relative z-0">
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
