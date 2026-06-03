import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/crm.functions";
import { motion } from "framer-motion";
import { Users, PhoneCall, TrendingUp, Wallet } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const COLORS = ["oklch(0.82 0.14 85)", "oklch(0.7 0.15 200)", "oklch(0.65 0.2 350)", "oklch(0.7 0.18 145)", "oklch(0.7 0.18 30)", "oklch(0.6 0.15 280)"];

const STATUS_TR: Record<string, string> = {
  new: "Yeni", interested: "İlgili", uninterested: "İlgisiz",
  potential: "Potansiyel", callback: "Tekrar Ara", converted: "Dönüştü",
};

function Dashboard() {
  const fetchDash = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDash() });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Çağrı merkezi anlık görünümü</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Toplam Müşteri" value={data?.totalCustomers ?? "..."} delay={0} />
        <StatCard icon={PhoneCall} label="Bugünkü Aramalar" value={data?.todayCalls ?? "..."} delay={0.1} />
        <StatCard icon={TrendingUp} label="Dönüşüm Oranı" value={data ? `%${data.conversionRate}` : "..."} delay={0.2} />
        <StatCard icon={Wallet} label="Toplam Yatırım" value={data ? `$${data.totalBalance.toLocaleString()}` : "..."} delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-strong rounded-2xl p-6"
        >
          <h3 className="font-semibold mb-4">Müşteri Durum Dağılımı</h3>
          {data && data.statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.statusDistribution.map((d) => ({ ...d, name: STATUS_TR[d.name] ?? d.name }))}
                  dataKey="value" nameKey="name" outerRadius={100} innerRadius={50}
                  paddingAngle={2}
                >
                  {data.statusDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.22 0.02 260)", border: "1px solid oklch(0.82 0.14 85 / 0.3)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty loading={isLoading} />}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-strong rounded-2xl p-6"
        >
          <h3 className="font-semibold mb-4">Agent Performansı (Bugün)</h3>
          {data && data.agentPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.agentPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 260 / 0.5)" />
                <XAxis dataKey="name" stroke="oklch(0.7 0.02 90)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 90)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.02 260)", border: "1px solid oklch(0.82 0.14 85 / 0.3)", borderRadius: 8 }} />
                <Bar dataKey="value" fill="oklch(0.82 0.14 85)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty loading={isLoading} />}
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
      whileHover={{ y: -4 }}
      className="glass-strong rounded-2xl p-5 hover:gold-glow transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="w-4 h-4 text-gold" />
      </div>
      <div className="text-2xl md:text-3xl font-bold text-gold">{value}</div>
    </motion.div>
  );
}

function Empty({ loading }: { loading: boolean }) {
  return (
    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
      {loading ? "Yükleniyor..." : "Henüz veri yok"}
    </div>
  );
}
