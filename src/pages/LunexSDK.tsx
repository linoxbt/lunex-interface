import { useAuth, AuthProvider } from "@/hooks/useAuth";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import DeveloperDashboard from "@/pages/DeveloperDashboard";
import { Loader2 } from "lucide-react";

const LunexSDKInner = () => {
  const { user, isAdmin, isDeveloper, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="container max-w-md mx-auto py-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AdminLogin />;
  if (isAdmin) return <AdminDashboard />;
  if (isDeveloper) return <DeveloperDashboard />;

  // User with no special role
  return (
    <div className="container max-w-md mx-auto py-16 text-center">
      <h1 className="text-2xl font-bold uppercase tracking-tight mb-2">Welcome</h1>
      <p className="text-xs text-muted-foreground mb-2">Logged in as {user.email}</p>
      <p className="text-xs text-muted-foreground mb-6">Your account doesn't have SDK access yet. Contact an admin to get the <strong>Developer</strong> role assigned.</p>
      <button onClick={() => { const { signOut } = useAuth(); signOut(); }} className="text-xs text-primary underline">Sign Out</button>
    </div>
  );
};

const LunexSDK = () => (
  <AuthProvider>
    <LunexSDKInner />
  </AuthProvider>
);

export default LunexSDK;
