import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------
async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "admin");
}

async function audit(supabase: any, actorId: string, action: string, entity: string, entityId: string | null, details: any) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    details,
  });
}

// ---------- queries ----------
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    return {
      userId,
      profile,
      roles: (roles ?? []).map((r: any) => r.role),
      isAdmin: (roles ?? []).some((r: any) => r.role === "admin"),
    };
  });

export const getAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
    const ids = (roleRows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return [];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    return (profiles ?? []).map((p: any) => ({
      ...p,
      role: roleRows!.find((r: any) => r.user_id === p.id)?.role ?? "agent",
    }));
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data: customers } = await supabase.from("customers").select("id, status, balance, assigned_agent, last_call_at");
    const list = customers ?? [];
    const today = new Date(); today.setHours(0,0,0,0);
    const todayCalls = list.filter((c: any) => c.last_call_at && new Date(c.last_call_at) >= today).length;
    const converted = list.filter((c: any) => c.status === "converted").length;
    const totalBalance = list.reduce((s: number, c: any) => s + Number(c.balance || 0), 0);

    const statusDist: Record<string, number> = {};
    list.forEach((c: any) => { statusDist[c.status] = (statusDist[c.status] ?? 0) + 1; });

    // agent perf: count calls per agent today
    const { data: notes } = await supabase.from("call_notes").select("agent_id, created_at").gte("created_at", today.toISOString());
    const agentCalls: Record<string, number> = {};
    (notes ?? []).forEach((n: any) => { if (n.agent_id) agentCalls[n.agent_id] = (agentCalls[n.agent_id] ?? 0) + 1; });

    const agentIds = Object.keys(agentCalls);
    let agentNames: Record<string, string> = {};
    if (agentIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", agentIds);
      (profs ?? []).forEach((p: any) => { agentNames[p.id] = p.full_name || p.email || "Agent"; });
    }

    return {
      totalCustomers: list.length,
      todayCalls,
      conversionRate: list.length ? Math.round((converted / list.length) * 1000) / 10 : 0,
      totalBalance,
      statusDistribution: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
      agentPerformance: Object.entries(agentCalls).map(([id, value]) => ({ name: agentNames[id] ?? "Agent", value })),
    };
  });

const ListInput = z.object({
  search: z.string().optional().default(""),
  status: z.string().optional().default("all"),
  agent: z.string().optional().default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
});

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    let q = supabase.from("customers").select("*", { count: "exact" });
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
    }
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.agent !== "all") {
      if (data.agent === "unassigned") q = q.is("assigned_agent", null);
      else q = q.eq("assigned_agent", data.agent);
    }
    const from = (data.page - 1) * data.pageSize;
    q = q.order("created_at", { ascending: false }).range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // attach agent names
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.assigned_agent).filter(Boolean)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      (profs ?? []).forEach((p: any) => { names[p.id] = p.full_name || p.email || "Agent"; });
    }
    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, agent_name: r.assigned_agent ? names[r.assigned_agent] : null })),
      total: count ?? 0,
    };
  });

export const getCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: customer, error } = await supabase.from("customers").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Müşteri bulunamadı");
    const { data: notes } = await supabase.from("call_notes").select("*").eq("customer_id", data.id).order("created_at", { ascending: false });
    const agentIds = Array.from(new Set([
      customer.assigned_agent,
      ...((notes ?? []).map((n: any) => n.agent_id).filter(Boolean)),
    ].filter(Boolean)));
    let names: Record<string, string> = {};
    if (agentIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", agentIds);
      (profs ?? []).forEach((p: any) => { names[p.id] = p.full_name || p.email || "Agent"; });
    }
    return {
      customer: { ...customer, agent_name: customer.assigned_agent ? names[customer.assigned_agent] : null },
      notes: (notes ?? []).map((n: any) => ({ ...n, agent_name: n.agent_id ? names[n.agent_id] : null })),
    };
  });

// ---------- mutations ----------
const outcomeToStatus: Record<string, string> = {
  interested: "interested",
  uninterested: "uninterested",
  potential: "potential",
  callback: "callback",
  will_return: "callback",
};

export const addCallNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      customer_id: z.string().uuid(),
      outcome: z.enum(["interested", "uninterested", "potential", "callback", "will_return"]),
      note: z.string().max(2000).optional().default(""),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from("call_notes").insert({
      customer_id: data.customer_id,
      agent_id: userId,
      outcome: data.outcome,
      note: data.note,
    });
    if (error) throw new Error(error.message);
    const newStatus = outcomeToStatus[data.outcome];
    const { error: upErr } = await supabase
      .from("customers")
      .update({ status: newStatus, last_call_at: new Date().toISOString() })
      .eq("id", data.customer_id);
    if (upErr) throw new Error(upErr.message);
    await audit(supabase, userId, "call_note_added", "customer", data.customer_id, { outcome: data.outcome });
    return { ok: true };
  });

export const bulkUpdateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      status: z.enum(["new", "interested", "uninterested", "potential", "callback", "converted"]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from("customers").update({ status: data.status }).in("id", data.ids);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "bulk_update_status", "customer", null, { ids: data.ids, status: data.status });
    return { ok: true, count: data.ids.length };
  });

export const bulkAssignAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      agent_id: z.string().uuid().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await isAdmin(supabase, userId))) throw new Error("Sadece adminler agent atayabilir");
    const { error } = await supabase.from("customers").update({ assigned_agent: data.agent_id }).in("id", data.ids);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "bulk_assign_agent", "customer", null, { ids: data.ids, agent_id: data.agent_id });
    return { ok: true, count: data.ids.length };
  });

export const bulkDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await isAdmin(supabase, userId))) throw new Error("Sadece adminler silebilir");
    const { error } = await supabase.from("customers").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "bulk_delete", "customer", null, { ids: data.ids });
    return { ok: true, count: data.ids.length };
  });

const CustomerRow = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  balance: z.coerce.number().optional().default(0),
});

export const bulkUploadCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ rows: z.array(z.record(z.string(), z.any())).min(1).max(5000) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await isAdmin(supabase, userId))) throw new Error("Sadece adminler yükleyebilir");
    const cleaned: any[] = [];
    const errors: string[] = [];
    data.rows.forEach((r, i) => {
      const parsed = CustomerRow.safeParse({
        full_name: r.full_name ?? r.name ?? r.ad ?? r["ad soyad"],
        phone: r.phone ?? r.telefon ?? null,
        email: r.email ?? null,
        balance: r.balance ?? r.bakiye ?? 0,
      });
      if (parsed.success) cleaned.push(parsed.data);
      else errors.push(`Satır ${i + 1}: geçersiz`);
    });
    if (cleaned.length === 0) throw new Error("Geçerli satır yok");
    // Insert in chunks
    const chunkSize = 500;
    for (let i = 0; i < cleaned.length; i += chunkSize) {
      const slice = cleaned.slice(i, i + chunkSize);
      const { error } = await supabase.from("customers").insert(slice);
      if (error) throw new Error(error.message);
    }
    await audit(supabase, userId, "bulk_upload", "customer", null, { count: cleaned.length });
    return { ok: true, inserted: cleaned.length, errors };
  });

// Micro-SIP placeholder
export const dialCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ customer_id: z.string().uuid(), phone: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await audit(supabase, userId, "dial_initiated", "customer", data.customer_id, { phone: data.phone });
    // Placeholder for Micro-SIP integration
    return { ok: true, message: "Micro-SIP entegrasyonu için placeholder", sip_uri: `sip:${data.phone}` };
  });
