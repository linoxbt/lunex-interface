import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Key, BarChart3, Plus, Copy, Check, ShieldOff, Shield,
  Trash2, LogOut, Users, UserPlus, X, BookOpen, Inbox, CheckCircle2, XCircle,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import SDKDeveloperGuide, { AVAILABLE_SERVICES } from "@/components/SDKDeveloperGuide";

interface ApiKey {
  id: string;
  key_value: string;
  label: string;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
  created_by?: string;
  allowed_services?: string[];
}

interface UsageStats {
  total_requests: number;
  rate_limited: number;
  by_endpoint: Record<string, number>;
  by_status: Record<string, number>;
  recent: any[];
}

interface ProtocolOverview {
  registered_users: number;
  user_counts: {
    daily: number;
    weekly: number;
    monthly: number;
    total: number;
  };
  volume: {
    daily: number;
    weekly: number;
    monthly: number;
    total: number;
  };
  wallet_addresses: Array<{
    address: string;
    interactions: number;
    last_seen: string | null;
    source: string;
  }>;
}

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  roles: string[];
}

interface KeyRequest {
  id: string;
  requested_by: string;
  label: string;
  requested_services: string[];
  status: string;
  admin_note: string | null;
  created_at: string;
  requester_email?: string;
  requester_name?: string;
}

const ROLE_INFO: Record<string, { label: string; color: string; description: string }> = {
  admin: {
    label: "Admin",
    color: "bg-red-500/10 text-red-500",
    description: "Full access. Manages all API keys, usage analytics, user roles, and key requests. Can approve or deny API key requests from developers.",
  },
  developer: {
    label: "Developer",
    color: "bg-blue-500/10 text-blue-500",
    description: "SDK integrator. Can request API keys with specific service scopes, view their own keys and usage analytics. Cannot manage other users.",
  },
  user: {
    label: "User",
    color: "bg-muted text-muted-foreground",
    description: "Basic account. Can log in and view profile. No API key or analytics access. Default role for new sign-ups before being granted higher access.",
  },
};

const AdminDashboard = () => {
  const { user, session, signOut, isAdmin } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [overview, setOverview] = useState<ProtocolOverview | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newServices, setNewServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"keys" | "analytics" | "users" | "requests" | "docs">("keys");
  const [days, setDays] = useState(7);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleAssigning, setRoleAssigning] = useState<string | null>(null);
  const [requests, setRequests] = useState<KeyRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

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

  const loadOverview = useCallback(async () => {
    const data = await callAdmin("protocol-overview", "GET");
    setOverview(data);
  }, [callAdmin]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const data = await callAdmin("users", "GET");
    setUsers(data.users || []);
    setUsersLoading(false);
  }, [callAdmin]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    const data = await callAdmin("list-requests", "GET");
    setRequests(data.requests || []);
    setRequestsLoading(false);
  }, [callAdmin]);

  useEffect(() => { loadKeys(); }, [loadKeys]);
  useEffect(() => { if (tab === "analytics") { loadUsage(); loadOverview(); } }, [tab, loadUsage, loadOverview]);
  useEffect(() => { if (tab === "users") loadUsers(); }, [tab, loadUsers]);
  useEffect(() => { if (tab === "requests") loadRequests(); }, [tab, loadRequests]);

  const toggleService = (id: string) => {
    setNewServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const createKey = async () => {
    if (!newLabel.trim() || newServices.length === 0) return;
    setCreating(true);
    await callAdmin("create", "POST", { label: newLabel, allowed_services: newServices });
    setNewLabel("");
    setNewServices([]);
    await loadKeys();
    setCreating(false);
  };

  const revokeKey = async (id: string) => { await callAdmin("revoke", "PUT", { id }); await loadKeys(); };
  const reactivateKey = async (id: string) => { await callAdmin("reactivate", "PUT", { id }); await loadKeys(); };
  const deleteKey = async (id: string) => { await callAdmin("delete-key", "DELETE", undefined, { id }); await loadKeys(); };

  const copyKey = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const assignRole = async (userId: string, role: string) => {
    setRoleAssigning(userId + role);
    await callAdmin("assign-role", "POST", { user_id: userId, role });
    await loadUsers();
    setRoleAssigning(null);
  };

  const removeRole = async (userId: string, role: string) => {
    setRoleAssigning(userId + role);
    await callAdmin("remove-role", "DELETE", undefined, { user_id: userId, role });
    await loadUsers();
    setRoleAssigning(null);
  };

  const handleRequest = async (requestId: string, action: "approve" | "deny", note?: string) => {
    await callAdmin("handle-request", "POST", { request_id: requestId, action, admin_note: note });
    await loadRequests();
    if (action === "approve") await loadKeys();
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const fmtUsd = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!isAdmin) {
    return (
      <div className="container max-w-md mx-auto py-16">
        <BackButton />
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">Access Denied</h1>
        <p className="text-xs text-muted-foreground mb-4">Your account does not have admin privileges.</p>
        <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-16 px-4">
      <BackButton />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Lunex SDK</h1>
          <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">Admin Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-px bg-border mb-6 flex-wrap">
        {([
          { id: "keys" as const, label: "API Keys", icon: Key, badge: 0 },
          { id: "requests" as const, label: "Requests", icon: Inbox, badge: pendingCount },
          { id: "analytics" as const, label: "Analytics", icon: BarChart3, badge: 0 },
          { id: "users" as const, label: "Users", icon: Users, badge: 0 },
          { id: "docs" as const, label: "Dev Guide", icon: BookOpen, badge: 0 },
        ]).map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] sm:text-xs font-semibold tracking-wider uppercase transition-colors relative ${
              tab === id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* API Keys Tab */}
      {tab === "keys" && (
        <div className="space-y-4">
          <div className="border border-border bg-card p-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase mb-3">Generate New API Key</h3>
            <div className="space-y-3">
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Key label (e.g., Partner Name)" />
              <div>
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mb-2">Select Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_SERVICES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleService(s.id)}
                      className={`px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase border transition-colors ${
                        newServices.includes(s.id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={createKey} disabled={creating || !newLabel.trim() || newServices.length === 0} size="sm">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Generate
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      {key.is_active ? <Shield className="h-3.5 w-3.5 text-green-500" /> : <ShieldOff className="h-3.5 w-3.5 text-destructive" />}
                      <span className="text-sm font-semibold">{key.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 tracking-wider uppercase font-semibold ${key.is_active ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
                        {key.is_active ? "Active" : "Revoked"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => copyKey(key.id, key.key_value)} className="h-7 px-2">
                        {copiedId === key.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      {key.is_active ? (
                        <Button variant="ghost" size="sm" onClick={() => revokeKey(key.id)} className="h-7 px-2 text-destructive hover:text-destructive"><ShieldOff className="h-3.5 w-3.5" /></Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => reactivateKey(key.id)} className="h-7 px-2 text-green-500 hover:text-green-500"><Shield className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteKey(key.id)} className="h-7 px-2 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <code className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 block overflow-hidden text-ellipsis">{key.key_value}</code>
                  {key.allowed_services && key.allowed_services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {key.allowed_services.map(s => (
                        <span key={s} className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary font-semibold tracking-wider uppercase">{s}</span>
                      ))}
                    </div>
                  )}
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

      {/* Requests Tab */}
      {tab === "requests" && (
        <div className="space-y-4">
          <div className="border border-border bg-card p-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase mb-1">API Key Requests</h3>
            <p className="text-[10px] text-muted-foreground">Developers submit requests for API keys. Review and approve or deny below.</p>
          </div>

          {requestsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <div className="border border-border bg-card p-8 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-xs text-muted-foreground tracking-wider uppercase">No API key requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className={`border bg-card p-4 ${req.status === "pending" ? "border-primary/30" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{req.label}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{req.requester_email || req.requested_by}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 tracking-wider uppercase font-semibold ${
                      req.status === "pending" ? "bg-yellow-500/10 text-yellow-500" :
                      req.status === "approved" ? "bg-green-500/10 text-green-500" :
                      "bg-destructive/10 text-destructive"
                    }`}>{req.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {req.requested_services.map(s => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary font-semibold tracking-wider uppercase">{s}</span>
                    ))}
                  </div>
                  {req.admin_note && <p className="text-[10px] text-muted-foreground italic mb-2">Note: {req.admin_note}</p>}
                  <p className="text-[10px] text-muted-foreground tracking-wider mb-3">Requested {new Date(req.created_at).toLocaleDateString()}</p>
                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-[10px]" onClick={() => handleRequest(req.id, "approve")}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] text-destructive" onClick={() => handleRequest(req.id, "deny")}>
                        <XCircle className="h-3 w-3 mr-1" /> Deny
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {overview && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                {[
                  { label: "Active Wallets · 1D", value: overview.user_counts.daily },
                  { label: "Active Wallets · 7D", value: overview.user_counts.weekly },
                  { label: "Active Wallets · 30D", value: overview.user_counts.monthly },
                  { label: "Registered Users", value: overview.registered_users },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 bg-card">
                    <p className="text-[10px] text-muted-foreground tracking-wider uppercase">{label}</p>
                    <p className="text-2xl font-bold font-mono">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                {[
                  { label: "Volume · 1D", value: `$${fmtUsd(overview.volume.daily)}` },
                  { label: "Volume · 7D", value: `$${fmtUsd(overview.volume.weekly)}` },
                  { label: "Volume · 30D", value: `$${fmtUsd(overview.volume.monthly)}` },
                  { label: "Total Volume", value: `$${fmtUsd(overview.volume.total)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 bg-card">
                    <p className="text-[10px] text-muted-foreground tracking-wider uppercase">{label}</p>
                    <p className="text-2xl font-bold font-mono">{value}</p>
                  </div>
                ))}
              </div>

              <div className="border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-xs font-semibold tracking-wider uppercase">Protocol Wallet Activity</h3>
                    <p className="text-[10px] text-muted-foreground">Wallets seen from stored app activity and onchain Lunex contract interactions.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadOverview}>Refresh</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Wallet</th>
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Source</th>
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Interactions</th>
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.wallet_addresses.map((wallet) => (
                        <tr key={wallet.address} className="border-b border-border/50">
                          <td className="py-2 font-mono break-all">{wallet.address}</td>
                          <td className="py-2 uppercase text-muted-foreground">{wallet.source}</td>
                          <td className="py-2 font-mono">{wallet.interactions}</td>
                          <td className="py-2 font-mono text-muted-foreground">{wallet.last_seen ? new Date(wallet.last_seen).toLocaleString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {overview.wallet_addresses.length === 0 && <p className="text-center text-muted-foreground py-4 text-xs">No wallet activity found yet</p>}
                </div>
              </div>
            </>
          )}

          <div className="border border-border bg-card p-4 flex flex-wrap gap-3 items-center">
            <div>
              <label className="text-[10px] text-muted-foreground tracking-wider uppercase block mb-1">Time Range</label>
              <div className="flex gap-px bg-border">
                {[1, 7, 30].map((d) => (
                  <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{d}d</button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] text-muted-foreground tracking-wider uppercase block mb-1">Filter by Key</label>
              <select value={selectedKeyId || ""} onChange={(e) => setSelectedKeyId(e.target.value || null)} className="w-full text-xs bg-background border border-border px-2 py-1.5">
                <option value="">All Keys</option>
                {keys.map((k) => (<option key={k.id} value={k.id}>{k.label}</option>))}
              </select>
            </div>
            <Button size="sm" variant="outline" onClick={loadUsage} className="mt-4">Refresh</Button>
          </div>
          {!usage ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                {[
                  { label: "Total Requests", value: usage.total_requests, color: "" },
                  { label: "Rate Limited", value: usage.rate_limited, color: "text-destructive" },
                  { label: "Success Rate", value: `${usage.total_requests > 0 ? ((1 - (usage.by_status["500"] || 0) / usage.total_requests) * 100).toFixed(1) : "100"}%`, color: "text-green-500" },
                  { label: "Endpoints Used", value: Object.keys(usage.by_endpoint).length, color: "" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-4 bg-card">
                    <p className="text-[10px] text-muted-foreground tracking-wider uppercase">{label}</p>
                    <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                  </div>
                ))}
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
              <div className="border border-border bg-card p-4">
                <h3 className="text-xs font-semibold tracking-wider uppercase mb-3">Recent Requests</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Time</th>
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Endpoint</th>
                        <th className="text-left py-2 text-muted-foreground tracking-wider uppercase font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(usage.recent || []).slice(0, 20).map((r: any, i: number) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 font-mono text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="py-1.5 font-mono">{r.endpoint}</td>
                          <td className={`py-1.5 font-mono ${r.status_code < 300 ? "text-green-500" : r.status_code < 500 ? "text-yellow-500" : "text-destructive"}`}>
                            {r.status_code}{r.rate_limited && " (RL)"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(usage.recent || []).length === 0 && <p className="text-center text-muted-foreground py-4 text-xs">No requests in this period</p>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="border border-border bg-card p-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase mb-3">Role Definitions</h3>
            <div className="space-y-3">
              {Object.entries(ROLE_INFO).map(([key, info]) => (
                <div key={key} className="flex items-start gap-3">
                  <span className={`text-[10px] px-2 py-0.5 tracking-wider uppercase font-semibold shrink-0 mt-0.5 ${info.color}`}>{info.label}</span>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </div>
              ))}
            </div>
          </div>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : users.length === 0 ? (
            <div className="border border-border bg-card p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-xs text-muted-foreground tracking-wider uppercase">No registered users</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{u.display_name || "No name"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{u.email}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground tracking-wider">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {u.roles.length === 0 && <span className="text-[10px] text-muted-foreground italic">No roles assigned</span>}
                    {u.roles.map((role) => {
                      const info = ROLE_INFO[role] || { label: role, color: "bg-muted text-muted-foreground" };
                      const isCurrentUser = u.id === user?.id && role === "admin";
                      return (
                        <span key={role} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 tracking-wider uppercase font-semibold ${info.color}`}>
                          {info.label}
                          {!isCurrentUser && (
                            <button onClick={() => removeRole(u.id, role)} disabled={roleAssigning === u.id + role} className="hover:opacity-70">
                              {roleAssigning === u.id + role ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ROLE_INFO).filter(([key]) => !u.roles.includes(key)).map(([key, info]) => (
                      <Button key={key} variant="outline" size="sm" className="h-6 text-[10px] tracking-wider uppercase px-2" onClick={() => assignRole(u.id, key)} disabled={roleAssigning === u.id + key}>
                        {roleAssigning === u.id + key ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
                        + {info.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Developer Guide Tab */}
      {tab === "docs" && <SDKDeveloperGuide />}
    </div>
  );
};

export default AdminDashboard;
