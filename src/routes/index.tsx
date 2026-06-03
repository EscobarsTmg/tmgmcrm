import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, TrendingUp, Users, PhoneCall } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.navigate({ to: "/dashboard" });
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-2xl"
      >
        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 text-xs uppercase tracking-widest text-gold">
          <Shield className="w-3 h-3" /> Premium Forex CRM
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-4">
          Çağrı merkeziniz için <span className="text-gold">lüks</span> CRM
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          60+ kişilik ekipler için tasarlandı. Müşteri yönetimi, çağrı takibi, anlık raporlar ve daha fazlası.
        </p>
        <a
          href="/auth"
          className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/70 text-primary-foreground font-semibold gold-glow hover:scale-105 transition-transform"
        >
          Giriş Yap →
        </a>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16">
          {[
            { icon: Users, label: "Müşteri Yönetimi", desc: "Toplu yükleme, atama, filtreleme" },
            { icon: PhoneCall, label: "Çağrı Takibi", desc: "Her arama için detaylı not" },
            { icon: TrendingUp, label: "Anlık Raporlar", desc: "Dönüşüm ve performans" },
          ].map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="glass rounded-xl p-5 text-left hover:gold-glow transition-all"
            >
              <f.icon className="w-6 h-6 text-gold mb-2" />
              <div className="font-semibold">{f.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
