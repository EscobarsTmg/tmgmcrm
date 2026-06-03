import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  listCustomers, getAgents, getMe, bulkUpdateStatus, bulkAssignAgent,
  bulkDelete, bulkUploadCustomers, addCallNote, dialCustomer,
} from "@/lib/crm.functions";
import { toast } from "sonner";
import { Search, Upload, Trash2, UserPlus, Tag, Phone, FileText, X, ChevronLeft, ChevronRight } from "lucide-react";
import Papa from "papaparse";

export const Route = createFileRoute("/_authenticated/customers/")({
  component: CustomersPage,
});

const STATUSES = ["new", "interested", "uninterested", "potential", "callback", "converted"] as const;
const STATUS_TR: Record<string, string> = {
  new: "Yeni", interested: "İlgili", uninterested: "İlgisiz",
  potential: "Potansiyel", callback: "Tekrar Ara", converted: "Dönüştü",
};
const STATUS_COLOR: Record<string, string> = {
  new: "bg-slate-500/20 text-slate-300",
  interested: "bg-emerald-500/20 text-emerald-300",
  uninterested: "bg-red-500/20 text-red-300",
  potential: "bg-blue-500/20 text-blue-300",
  callback: "bg-amber-500/20 text-amber-300",
  converted: "bg-primary/30 text-gold",
};

function CustomersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCustomers);
  const agentsFn = useServerFn(getAgents);
  const meFn = useServerFn(getMe);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [agent, setAgent] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteFor, setNoteFor] = useState<any | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: agents } = useQuery({ queryKey: ["agents"], queryFn: () => agentsFn() });
  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, status, agent, page],
    queryFn: () => list({ data: { search, status, agent, page, pageSize } }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isAdmin = me?.isAdmin;

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r: any) => r.id)));
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    setSelected(new Set());
  };

  const bulkStatus = useMutation({
    mutationFn: useServerFn(bulkUpdateStatus),
    onSuccess: (r) => { toast.success(`${r.count} müşteri güncellendi`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const bulkAgent = useMutation({
    mutationFn: useServerFn(bulkAssignAgent),
    onSuccess: (r) => { toast.success(`${r.count} müşteri atandı`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const bulkDel = useMutation({
    mutationFn: useServerFn(bulkDelete),
    onSuccess: (r) => { toast.success(`${r.count} müşteri silindi`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const upload = useMutation({
    mutationFn: useServerFn(bulkUploadCustomers),
    onSuccess: (r) => { toast.success(`${r.inserted} müşteri eklendi`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => upload.mutate({ data: { rows: res.data as any } }),
    });
    e.target.value = "";
  };

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Müşteriler</h1>
          <p className="text-xs text-muted-foreground">{total} kayıt</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()} className="btn-glass">
              <Upload className="w-4 h-4" /> CSV Yükle
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass-strong rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Ad, telefon, email ara..."
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="select-glass">
          <option value="all">Tüm durumlar</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_TR[s]}</option>)}
        </select>
        <select value={agent} onChange={(e) => { setAgent(e.target.value); setPage(1); }} className="select-glass">
          <option value="all">Tüm agentlar</option>
          <option value="unassigned">Atanmamış</option>
          {agents?.map((a: any) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
        </select>
      </div>

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-strong rounded-xl p-3 flex flex-wrap items-center gap-2 gold-glow"
          >
            <span className="text-sm font-medium text-gold mr-2">{selected.size} seçili</span>
            <select
              className="select-glass"
              onChange={(e) => { if (e.target.value) { bulkStatus.mutate({ data: { ids: [...selected], status: e.target.value as any } }); e.target.value = ""; } }}
              defaultValue=""
            >
              <option value="" disabled>Durum güncelle...</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_TR[s]}</option>)}
            </select>
            {isAdmin && (
              <select
                className="select-glass"
                onChange={(e) => { if (e.target.value) { bulkAgent.mutate({ data: { ids: [...selected], agent_id: e.target.value === "none" ? null : e.target.value } }); e.target.value = ""; } }}
                defaultValue=""
              >
                <option value="" disabled>Agent ata...</option>
                <option value="none">Atamayı kaldır</option>
                {agents?.map((a: any) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
              </select>
            )}
            {isAdmin && (
              <button
                onClick={() => { if (confirm(`${selected.size} müşteri silinsin mi?`)) bulkDel.mutate({ data: { ids: [...selected] } }); }}
                className="btn-glass !text-red-300 hover:!bg-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> Sil
              </button>
            )}
            <button onClick={() => setSelected(new Set())} className="btn-glass">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="glass-strong rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="p-3 w-10">
                  <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
                </th>
                <th className="p-3">Ad</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Email</th>
                <th className="p-3 text-right">Bakiye</th>
                <th className="p-3">Durum</th>
                <th className="p-3">Agent</th>
                <th className="p-3">Son Arama</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Yükleniyor...</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">Müşteri yok. {isAdmin && "CSV yükleyerek başlayın."}</td></tr>
              )}
              {rows.map((r: any) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="border-b border-border/20 hover:bg-primary/5 transition-colors"
                >
                  <td className="p-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                  <td className="p-3 font-medium">
                    <Link to="/customers/$id" params={{ id: r.id }} className="hover:text-gold">{r.full_name}</Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.phone || "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.email || "—"}</td>
                  <td className="p-3 text-right font-mono text-gold">${Number(r.balance).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[r.status]}`}>{STATUS_TR[r.status]}</span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{r.agent_name || "Atanmamış"}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {r.last_call_at ? new Date(r.last_call_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => setNoteFor(r)} className="p-2 rounded hover:bg-primary/20 transition-colors" title="Not Ekle">
                        <FileText className="w-4 h-4 text-gold" />
                      </button>
                      {r.phone && (
                        <button
                          onClick={async () => {
                            const fn = useServerFn(dialCustomer);
                            // simple call
                            const res = await fetch("");
                          }}
                          className="p-2 rounded hover:bg-primary/20 transition-colors" title="Ara"
                        >
                          <a href={`sip:${r.phone}`}><Phone className="w-4 h-4 text-gold" /></a>
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-border/40 text-sm">
          <div className="text-xs text-muted-foreground">
            Sayfa {page} / {totalPages}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-glass !p-2 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-glass !p-2 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <NoteModal customer={noteFor} onClose={() => setNoteFor(null)} onSaved={invalidate} />

      <style>{`
        .btn-glass { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.85rem; border-radius: 0.5rem; font-size: 0.85rem; background: linear-gradient(135deg, oklch(1 0 0 / 0.04), oklch(1 0 0 / 0.01)); border: 1px solid oklch(0.82 0.14 85 / 0.2); backdrop-filter: blur(12px); transition: all 0.2s; }
        .btn-glass:hover { background: oklch(0.82 0.14 85 / 0.15); }
        .select-glass { padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; background: oklch(0.22 0.02 260); border: 1px solid oklch(0.82 0.14 85 / 0.2); color: inherit; outline: none; }
      `}</style>
    </div>
  );
}

function NoteModal({ customer, onClose, onSaved }: any) {
  const addNote = useServerFn(addCallNote);
  const [outcome, setOutcome] = useState("interested");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!customer) return null;

  const save = async () => {
    setLoading(true);
    try {
      await addNote({ data: { customer_id: customer.id, outcome: outcome as any, note } });
      toast.success("Not kaydedildi");
      setNote(""); setOutcome("interested");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong rounded-2xl p-6 max-w-md w-full gold-glow"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg">{customer.full_name}</h3>
              <p className="text-xs text-muted-foreground">{customer.phone}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>

          <label className="block mb-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Çağrı Sonucu</span>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-full mt-1 glass rounded-lg px-3 py-2.5 outline-none">
              <option value="interested">İlgili</option>
              <option value="uninterested">İlgisiz</option>
              <option value="potential">Potansiyel</option>
              <option value="callback">Tekrar Ara</option>
              <option value="will_return">Dönüş Yapacak</option>
            </select>
          </label>

          <label className="block mb-4">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Not</span>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)} rows={4}
              className="w-full mt-1 glass rounded-lg px-3 py-2.5 outline-none resize-none text-sm"
              placeholder="Çağrı detayları..."
            />
          </label>

          <button
            onClick={save} disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/70 text-primary-foreground font-semibold gold-glow disabled:opacity-50"
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
