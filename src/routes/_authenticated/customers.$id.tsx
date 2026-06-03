import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCustomer } from "@/lib/crm.functions";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Mail, Wallet, User, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  component: CustomerDetail,
});

const STATUS_TR: Record<string, string> = {
  new: "Yeni", interested: "İlgili", uninterested: "İlgisiz",
  potential: "Potansiyel", callback: "Tekrar Ara", converted: "Dönüştü",
};
const OUTCOME_TR: Record<string, string> = {
  interested: "İlgili", uninterested: "İlgisiz", potential: "Potansiyel",
  callback: "Tekrar Ara", will_return: "Dönüş Yapacak",
};

function CustomerDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCustomer);
  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fn({ data: { id } }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Yükleniyor...</div>;
  if (!data) return <div className="p-8">Bulunamadı</div>;

  const c = data.customer;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Müşteri listesine dön
      </Link>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold">{c.full_name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{STATUS_TR[c.status]}</p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Bakiye</div>
            <div className="text-2xl font-bold text-gold">${Number(c.balance).toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
          <InfoRow icon={Phone} label="Telefon" value={c.phone || "—"} link={c.phone ? `sip:${c.phone}` : undefined} />
          <InfoRow icon={Mail} label="E-posta" value={c.email || "—"} link={c.email ? `mailto:${c.email}` : undefined} />
          <InfoRow icon={User} label="Agent" value={c.agent_name || "Atanmamış"} />
          <InfoRow icon={Calendar} label="Son Arama" value={c.last_call_at ? new Date(c.last_call_at).toLocaleString("tr-TR") : "—"} />
        </div>
      </motion.div>

      <div className="glass-strong rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Çağrı Geçmişi ({data.notes.length})</h2>
        {data.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz çağrı kaydı yok.</p>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />
            {data.notes.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="relative mb-5"
              >
                <div className="absolute -left-[19px] top-1.5 w-3 h-3 rounded-full bg-primary gold-glow" />
                <div className="glass rounded-xl p-4">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-gold">{OUTCOME_TR[n.outcome]}</span>
                    <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">{n.agent_name || "Agent"}</div>
                  {n.note && <p className="text-sm whitespace-pre-wrap">{n.note}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, link }: any) {
  const body = (
    <div className="glass rounded-lg p-3 flex items-center gap-3">
      <Icon className="w-4 h-4 text-gold flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{value}</div>
      </div>
    </div>
  );
  return link ? <a href={link}>{body}</a> : body;
}
