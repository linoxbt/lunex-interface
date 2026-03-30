import { useAuth, AuthProvider } from "@/hooks/useAuth";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import { Loader2 } from "lucide-react";

const LunexSDKInner = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="container max-w-md mx-auto py-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return user ? <AdminDashboard /> : <AdminLogin />;
};

const LunexSDK = () => (
  <AuthProvider>
    <LunexSDKInner />
  </AuthProvider>
);

export default LunexSDK;
