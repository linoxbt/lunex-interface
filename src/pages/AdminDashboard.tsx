import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Key, BarChart3, Plus, Copy, Check, ShieldOff, Shield, Trash2, LogOut } from "lucide-react";
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

const AdminDashboard = () => {
  const { user, session, signOut, isAdmin } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"keys" | "analytics">("keys");
  const [days, setDays] = useState(7);

  const callAdmin = useCallback(async (action: string, method: string, body?: any, params?: Record<string, string>) => {
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
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return res.json();
  }, [session]);

  const loadKeys = useCallback(async () => {
    const data = await callAdmin("list", "GET");
    setKeys(data.keys || []);
    setLoading(false);
  }, [callAdmin]);

  const loadUsage = useCallback(async () => {
    const params: Record<string, string> = { days: String(days) };
    if (selectedKeyId) params.key_id = selectedKeyId;
    const data = await callAdmin("usage", "GET", undefined, params);
    setUsage(data);
  }, [callAdmin, selectedKeyId, days]);

  useEffect(() => { loadKeys(); }, [loadKeys]);
  useEffect(() => { if (tab === "analytics") loadUsage(); }, [tab, loadUsage]);

  const createKey = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    await callAdmin("create", "POST", { label: newLabel });
    setNewLabel("");
    await loadKeys();
    setCreating(false);
  };

  const revokeKey = async (id: string) => {
    await callAdmin("revoke", "PUT", { id });
    await loadKeys();
  };

  const reactivateKey = async (id: string) => {
    await callAdmin("reactivate", "PUT", { id });
    await loadKeys();
  };

  const deleteKey = async (id: string) => {
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dex-admin`);
    url.searchParams.set("id", id);
    await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    await loadKeys();
  };

  const copyKey = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isAdmin) {
    return (
      <div className="container max-w-md mx-auto py-16">
        <BackButton />
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Access Denied</h1>
        <p className="text-xs text-muted-foreground mb-4">Your account does not have admin privileges.</p>
        <p className="text-xs text-muted-foreground mb-4">Logged in as: {user?.email}</p>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-16 px-4">
      <BackButton />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Lunex SDK</h1>
          <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">API Key Management & Analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-px bg-border mb-6">
        {([
          { id: "keys" as const, label: "API Keys", icon: Key },
          { id: "analytics" as const, label: "Usage Analytics", icon: BarChart3 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold tracking-wider uppercase transition-colors ${
              tab === id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* API Keys Tab */}
      {tab === "keys" && (
        <div className="space-y-4">
          {/* Create new key */}
          <div className="border border-border bg-card p-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase mb-3">Generate New API Key</h3>
            <div className="flex gap-2">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Key label (e.g., Partner Name)"
                className="flex-1"
              />
              <Button onClick={createKey} disabled={creating || !newLabel.trim()} size="sm">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Generate
              </Button>
            </div>
          </div>

          {/* Keys list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : keys.length === 0 ? (
            <div className="border border-border bg-card p-8 text-center">
              <Key className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-xs text-muted-foreground tracking-wider uppercase">No API keys yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className={`border bg-card p-4 ${key.is_active ? "border-border" : "border-destructive/30 opacity-60"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {key.is_active ? (
                        <Shield className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <ShieldOff className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className="text-sm font-semibold">{key.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 tracking-wider uppercase font-semibold ${
                        key.is_active ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
                      }`}>
                        {key.is_active ? "Active" : "Revoked"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => copyKey(key.id, key.key_value)} className="h-7 px-2">
                        {copiedId === key.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      {key.is_active ? (
                        <Button variant="ghost" size="sm" onClick={() => revokeKey(key.id)} className="h-7 px-2 text-destructive hover:text-destructive">
                          <ShieldOff className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => reactivateKey(key.id)} className="h-7 px-2 text-green-500 hover:text-green-500">
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteKey(key.id)} className="h-7 px-2 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 flex-1 overflow-hidden text-ellipsis">
                      {key.key_value}
                    </code>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 tracking-wider">
                    Created {new Date(key.created_at).toLocaleDateString()}
                    {key.revoked_at && ` · Revoked ${new Date(key.revoked_at).toLocaleDateString()}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="border border-border bg-card p-4 flex flex-wrap gap-3 items-center">
            <div>
              <label className="text-[10px] text-muted-foreground tracking-wider uppercase block mb-1">Time Range</label>
              <div className="flex gap-px bg-border">
                {[1, 7, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] text-muted-foreground tracking-wider uppercase block mb-1">Filter by Key</label>
              <select
                value={selectedKeyId || ""}
                onChange={(e) => setSelectedKeyId(e.target.value || null)}
                className="w-full text-xs bg-background border border-border px-2 py-1.5"
              >
                <option value="">All Keys</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
            </div>
            <Button size="sm" variant="outline" onClick={loadUsage} className="mt-4">
              Refresh
            </Button>
          </div>

          {!usage ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Summary cards */}
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
                  <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Endpoints Used</p>
                  <p className="text-2xl font-bold font-mono">{Object.keys(usage.by_endpoint).length}</p>
                </div>
              </div>

              {/* By endpoint */}
              <div className="border border-border bg-card p-4">
                <h3 className="text-xs font-semibold tracking-wider uppercase mb-3">Requests by Endpoint</h3>
                {Object.keys(usage.by_endpoint).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data for this period</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(usage.by_endpoint)
                      .sort(([, a], [, b]) => b - a)
                      .map(([endpoint, count]) => {
                        const pct = usage.total_requests > 0 ? (count / usage.total_requests) * 100 : 0;
                        return (
                          <div key={endpoint}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-mono">{endpoint}</span>
                              <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full bg-muted/30 h-1.5">
                              <div className="bg-primary h-1.5" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* By status */}
              <div className="border border-border bg-card p-4">
                <h3 className="text-xs font-semibold tracking-wider uppercase mb-3">Response Status Codes</h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(usage.by_status)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([status, count]) => (
                      <div key={status} className="text-center">
                        <span className={`text-lg font-bold font-mono ${
                          status.startsWith("2") ? "text-green-500" :
                          status.startsWith("4") ? "text-yellow-500" :
                          "text-destructive"
                        }`}>{count}</span>
                        <p className="text-[10px] text-muted-foreground tracking-wider">{status}</p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Recent requests */}
              <div className="border border-border bg-card p-4">
                <h3 className="text-xs font-semibold tracking-wider uppercase mb-3">Recent Requests</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Time</th>
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Endpoint</th>
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Method</th>
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(usage.recent || []).slice(0, 20).map((r: any, i: number) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 font-mono text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="py-1.5 font-mono">{r.endpoint}</td>
                          <td className="py-1.5">{r.method}</td>
                          <td className={`py-1.5 font-mono ${
                            r.status_code < 300 ? "text-green-500" : r.status_code < 500 ? "text-yellow-500" : "text-destructive"
                          }`}>
                            {r.status_code}
                            {r.rate_limited && " (RL)"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(usage.recent || []).length === 0 && (
                    <p className="text-center text-muted-foreground py-4 text-xs">No requests in this period</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
