import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navigation from "./components/navigation";
import Vaults from "./pages/vaults";
import Dashboard from "./pages/dashboard";
import Staking from "./pages/staking";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-arca-bg">
      <Navigation />
      <Switch>
        <Route path="/" component={Vaults} />
        <Route path="/vaults" component={Vaults} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/staking" component={Staking} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}

export default App;
