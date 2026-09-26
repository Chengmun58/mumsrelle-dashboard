import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import PasswordGate from "./components/PasswordGate";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CustomerReports from "./pages/CustomerReports";
import CsoDailyUpdates from "./pages/CsoDailyUpdates";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/keyword-trends">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/sales-reports">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/customer-reports">
        <DashboardLayout>
          <CustomerReports />
        </DashboardLayout>
      </Route>
      <Route path="/cso-daily">
        <DashboardLayout>
          <CsoDailyUpdates />
        </DashboardLayout>
      </Route>
      <Route path="/marketing">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/employee-performance">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/commission">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/stock">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/master-data">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PasswordGate>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </PasswordGate>
    </ErrorBoundary>
  );
}
