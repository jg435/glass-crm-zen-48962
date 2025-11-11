import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BackgroundImageProvider, useBackgroundImage } from "@/hooks/useBackgroundImage";
import Index from "./pages/Index";
import LeadDetails from "./pages/LeadDetails";
import MeetingSimulation from "./pages/MeetingSimulation";
import LiveMeetingDemo from "./pages/LiveMeetingDemo";
import GoogleAuthCallback from "./pages/GoogleAuthCallback";
import ExpandedDashboard from "./pages/ExpandedDashboard";
import ExpandedContacts from "./pages/ExpandedContacts";
import ExpandedDeals from "./pages/ExpandedDeals";
import NotFound from "./pages/NotFound";

const BackgroundLayer = () => {
  const { backgroundImage } = useBackgroundImage();
  
  if (!backgroundImage) return null;
  
  return (
    <>
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="fixed inset-0 bg-background/5 z-[1] pointer-events-none" />
    </>
  );
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BackgroundImageProvider>
        <BackgroundLayer />
        <div className="relative z-10 min-h-screen">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/lead/:id" element={<LeadDetails />} />
              <Route path="/simulate" element={<MeetingSimulation />} />
              <Route path="/live-meeting" element={<LiveMeetingDemo />} />
              <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
              <Route path="/dashboard" element={<ExpandedDashboard />} />
              <Route path="/contacts" element={<ExpandedContacts />} />
              <Route path="/deals" element={<ExpandedDeals />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </div>
      </BackgroundImageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
