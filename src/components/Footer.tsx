import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, AuthProvider } from "@/hooks/useAuth";

const FooterInner = () => {
  const { isAdmin } = useAuth();

  return (
    <footer className="border-t border-border bg-background py-6">
      <div className="container flex items-center justify-center gap-4 text-xs text-muted-foreground tracking-wider uppercase">
        <a href="https://twitter.com/linoxbt" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
          Built by Lino <ExternalLink className="h-3 w-3" />
        </a>
        {isAdmin && (
          <Link to="/lunexsdk" className="hover:text-foreground transition-colors">
            SDK Admin
          </Link>
        )}
      </div>
    </footer>
  );
};

const Footer = () => (
  <AuthProvider>
    <FooterInner />
  </AuthProvider>
);

export default Footer;
