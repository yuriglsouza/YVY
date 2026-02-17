import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import FarmList from "@/pages/FarmList";
import ClientList from "@/pages/ClientList";
import Dashboard from "@/pages/Dashboard"; // Import Dashboard
import FarmDetails from "@/pages/FarmDetails";
import Settings from "@/pages/Settings"; // Import Settings
import LoginPage from "@/pages/LoginPage"; // Import Login Page
import { TooltipProvider } from "@/components/ui/tooltip"; // Restored
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Auth Context / Hook
function useUser() {
  return useQuery({
    queryKey: ["/api/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
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
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      {/* Protect all other routes */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/farms" component={() => <ProtectedRoute component={FarmList} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={ClientList} />} />
      <Route path="/farms/:id" component={() => <ProtectedRoute component={FarmDetails} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Global Watermark */}
        <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none">
          <img src="/logo.png" alt="" className="w-[80vw] max-w-[800px] h-auto grayscale" />
        </div>
        <div className="relative z-10">
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
