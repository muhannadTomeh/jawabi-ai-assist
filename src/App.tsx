import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import AuthPage from "@/pages/Auth";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import DashboardPage from "@/pages/Dashboard";
import KnowledgeBasePage from "@/pages/KnowledgeBase";
import ChannelsPage from "@/pages/Channels";
import AnalyticsPage from "@/pages/Analytics";
import TestChatPage from "@/pages/TestChat";
import SettingsPage from "@/pages/Settings";
import AdminPage from "@/pages/Admin";
import NotificationsPage from "@/pages/Notifications";
import CustomersPage from "@/pages/Customers";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth route */}
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Public landing */}
            <Route path="/" element={<Landing />} />

            {/* Onboarding (auth required, no sidebar) */}
            <Route path="/onboarding" element={<Onboarding />} />
            
            {/* Dashboard routes with layout */}
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/knowledge" element={<KnowledgeBasePage />} />
              <Route path="/dashboard/channels" element={<ChannelsPage />} />
              <Route path="/dashboard/customers" element={<CustomersPage />} />
              <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
              <Route path="/dashboard/test" element={<TestChatPage />} />
              <Route path="/dashboard/notifications" element={<NotificationsPage />} />
              <Route path="/dashboard/settings" element={<SettingsPage />} />
              <Route path="/dashboard/admin" element={<AdminPage />} />
            </Route>
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;