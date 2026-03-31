import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Key, BarChart3, Shield, ShieldOff, Copy, Check, LogOut } from "lucide-react";
import BackButton from "@/components/BackButton";

interface ApiKey {
  id: string;
  key_value: string;
  label: string;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
}

interface UsageStats {
  total_requests: number;
  rate_limited: number;
  by_endpoint: Record<string, number>;
  by_status: Record<string, number>;
  recent: any[];
}

const DeveloperDashboard = () => {
  const { user, session, signOut } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"keys" | "analytics">("keys");
  const [days, setDays] = useState(7);

  const callAdmin = useCallback(async (action: string, method: string, params?: Record<string, string>) => {
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dex-admin`);
    url.searchParams.set("action", action);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    return res.json();
  }, [session]);

  const loadKeys = useCallback(async () => {
    const data = await callAdmin("my-keys", "GET");
    setKeys(data.keys || []);
    setLoading(false);
  }, [callAdmin]);

  const loadUsage = useCallback(async () => {
    const data = await callAdmin("my-usage", "GET", { days: String(days) });
    setUsage(data);
  }, [callAdmin, days]);

  useEffect(() => { loadKeys(); }, [loadKeys]);
  useEffect(() => { if (tab === "analytics") loadUsage(); }, [tab, loadUsage]);

  const copyKey = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="container max-w-4xl mx-auto py-16 px-4">
      <BackButton />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Developer Portal</h1>
          <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">Your API Keys & Usage</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="flex gap-px bg-border mb-6">
        {([
          { id: "keys" as const, label: "My API Keys", icon: Key },
          { id: "analytics" as const, label: "My Usage", icon: BarChart3 },
        ]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold tracking-wider uppercase transition-colors ${tab === id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "keys" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : keys.length === 0 ? (
            <div className="border border-border bg-card p-8 text-center">
              <Key className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-xs text-muted-foreground tracking-wider uppercase mb-2">No API keys assigned to you yet</p>
              <p className="text-xs text-muted-foreground">Contact an admin to get an API key generated for your account.</p>
            </div>
          ) : (
            keys.map((key) => (
              <div key={key.id} className={`border bg-card p-4 ${key.is_active ? "border-border" : "border-destructive/30 opacity-60"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {key.is_active ? <Shield className="h-3.5 w-3.5 text-green-500" /> : <ShieldOff className="h-3.5 w-3.5 text-destructive" />}
                    <span className="text-sm font-semibold">{key.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 tracking-wider uppercase font-semibold ${key.is_active ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
                      {key.is_active ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyKey(key.id, key.key_value)} className="h-7 px-2">
                    {copiedId === key.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <code className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 block overflow-hidden text-ellipsis">{key.key_value}</code>
                <p className="text-[10px] text-muted-foreground mt-2 tracking-wider">Created {new Date(key.created_at).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="border border-border bg-card p-4 flex gap-3 items-center">
            <div>
              <label className="text-[10px] text-muted-foreground tracking-wider uppercase block mb-1">Time Range</label>
              <div className="flex gap-px bg-border">
                {[1, 7, 30].map((d) => (
                  <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{d}d</button>
                ))}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={loadUsage} className="mt-4">Refresh</Button>
          </div>

          {!usage ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                <div className="p-4 bg-card">
                  <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Total Requests</p>
                  <p className="text-2xl font-bold font-mono">{usage.total_requests}</p>
                </div>
                <div className="p-4 bg-card">
                  <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Rate Limited</p>
                  <p className="text-2xl font-bold font-mono text-destructive">{usage.rate_limited}</p>
                </div>
                <div className="p-4 bg-card">
                  <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Success Rate</p>
                  <p className="text-2xl font-bold font-mono text-green-500">
                    {usage.total_requests > 0 ? ((1 - (usage.by_status["500"] || 0) / usage.total_requests) * 100).toFixed(1) : "100"}%
                  </p>
                </div>
                <div className="p-4 bg-card">
                  <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Endpoints</p>
                  <p className="text-2xl font-bold font-mono">{Object.keys(usage.by_endpoint).length}</p>
                </div>
              </div>

              <div className="border border-border bg-card p-4">
                <h3 className="text-xs font-semibold tracking-wider uppercase mb-3">Requests by Endpoint</h3>
                {Object.keys(usage.by_endpoint).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data for this period</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(usage.by_endpoint).sort(([, a], [, b]) => b - a).map(([endpoint, count]) => {
                      const pct = usage.total_requests > 0 ? (count / usage.total_requests) * 100 : 0;
                      return (
                        <div key={endpoint}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-mono">{endpoint}</span>
                            <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full bg-muted/30 h-1.5"><div className="bg-primary h-1.5" style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DeveloperDashboard;
