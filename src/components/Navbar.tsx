import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import lunexLogo from "@/assets/lunex-logo.png";

const navLinks = [
  { to: "/swap", label: "SWAP" },
  { to: "/pool", label: "POOL" },
  { to: "/yield", label: "YIELD" },
  { to: "/bridge", label: "BRIDGE" },
  { to: "/stats", label: "STATS" },
  { to: "/dashboard", label: "DASHBOARD" },
  { to: "/docs", label: "DOCS" },
];

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-1">
            <img src={lunexLogo} alt="LUNEX" className="h-7 w-auto" />
            <span className="text-base font-bold text-foreground tracking-widest uppercase">LUNEX</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 text-xs font-semibold tracking-wider transition-colors ${
                  location.pathname.startsWith(link.to) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <div {...(!mounted && { "aria-hidden": true, style: { opacity: 0, pointerEvents: "none" as const, userSelect: "none" as const } })}>
                  {!connected ? (
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold tracking-wider uppercase h-8 px-4" onClick={openConnectModal}>Connect</Button>
                  ) : chain.unsupported ? (
                    <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold h-8 px-4" onClick={openChainModal}>Wrong Network</Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={openChainModal} className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">{chain.name}</button>
                      <Button size="sm" className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-mono h-8 px-3" onClick={openAccountModal}>{account.displayName}</Button>
                    </div>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
          <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2 text-xs font-semibold tracking-wider ${
                location.pathname.startsWith(link.to) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
