import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { wagmiConfig } from "@/config/wagmi";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatBot from "@/components/ChatBot";
import PageTransition from "@/components/PageTransition";
import Landing from "@/pages/Landing";
import Swap from "@/pages/Swap";
import PoolOverview from "@/pages/PoolOverview";
import AddLiquidity from "@/pages/AddLiquidity";
import RemoveLiquidity from "@/pages/RemoveLiquidity";
import YieldOverview from "@/pages/YieldOverview";
import VaultDetail from "@/pages/VaultDetail";
import Dashboard from "@/pages/Dashboard";
import ProtocolStats from "@/pages/ProtocolStats";
import Bridge from "@/pages/Bridge";
import Docs from "@/pages/Docs";
import LunexSDK from "@/pages/LunexSDK";
import NotFound from "@/pages/NotFound";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/swap" element={<PageTransition><Swap /></PageTransition>} />
        <Route path="/pool" element={<PageTransition><PoolOverview /></PageTransition>} />
        <Route path="/pool/add" element={<PageTransition><AddLiquidity /></PageTransition>} />
        <Route path="/pool/remove" element={<PageTransition><RemoveLiquidity /></PageTransition>} />
        <Route path="/yield" element={<PageTransition><YieldOverview /></PageTransition>} />
        <Route path="/yield/:token" element={<PageTransition><VaultDetail /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/stats" element={<PageTransition><ProtocolStats /></PageTransition>} />
        <Route path="/protocol" element={<PageTransition><ProtocolStats /></PageTransition>} />
        <Route path="/bridge" element={<PageTransition><Bridge /></PageTransition>} />
        <Route path="/docs" element={<PageTransition><Docs /></PageTransition>} />
        <Route path="/lunexsdk" element={<PageTransition><LunexSDK /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider
        theme={darkTheme({
          accentColor: "hsl(187 100% 45%)",
          accentColorForeground: "hsl(220 50% 6%)",
          borderRadius: "medium",
          fontStack: "system",
        })}
      >
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <AnimatedRoutes />
              </main>
              <Footer />
              <ChatBot />
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
