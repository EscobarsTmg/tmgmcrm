import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/crm.functions";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, LogOut, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const fetchMe = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex">
      <motion.aside
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-64 glass-strong border-r border-border/40 hidden md:flex flex-col p-5 gap-2"
      >
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="w-9 h-9 rounded-lg gold-glow flex items-center justify-center bg-gradient-to-br from-primary to-primary/60">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-gold tracking-wide">FOREX CRM</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Call Center</div>
          </div>
        </div>

        <NavLink to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />}>Dashboard</NavLink>
        <NavLink to="/customers" icon={<Users className="w-4 h-4" />}>Müşteriler</NavLink>

        <div className="mt-auto glass rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Giriş yapan</div>
          <div className="font-medium text-sm truncate">{me?.profile?.full_name ?? me?.profile?.email ?? "..."}</div>
          <div className="text-[10px] uppercase tracking-wider text-gold mt-1">
            {me?.isAdmin ? "Admin" : "Agent"}
          </div>
          <button
            onClick={signOut}
            className="mt-3 w-full flex items-center justify-center gap-2 text-xs rounded-lg py-2 bg-destructive/20 hover:bg-destructive/30 transition-colors"
          >
            <LogOut className="w-3 h-3" /> Çıkış
          </button>
        </div>
      </motion.aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all"
      activeProps={{ className: "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-primary-foreground bg-gradient-to-r from-primary/80 to-primary/60 gold-glow font-medium" }}
    >
      {icon}
      {children}
    </Link>
  );
}
