import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/dashboard` }
        });
        if (error) throw error;
        toast.success("Hesap oluşturuldu! Giriş yapılıyor...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md glass-strong rounded-2xl p-8 gold-glow"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center gold-glow mb-3">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-gold">Forex CRM</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Call Center Yönetimi</p>
        </div>

        <div className="flex glass rounded-lg p-1 mb-6">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 text-sm py-2 rounded-md transition-all ${
                mode === m ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {m === "login" ? "Giriş" : "Kayıt"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <Field label="Ad Soyad" icon={<Shield className="w-4 h-4" />}>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-transparent outline-none text-sm"
                placeholder="Adınız"
              />
            </Field>
          )}
          <Field label="E-posta" icon={<Mail className="w-4 h-4" />}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-transparent outline-none text-sm"
              placeholder="ornek@firma.com"
            />
          </Field>
          <Field label="Şifre" icon={<Lock className="w-4 h-4" />}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-transparent outline-none text-sm"
              placeholder="••••••••"
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-primary to-primary/70 text-primary-foreground font-semibold text-sm gold-glow hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          İlk kayıt olan kullanıcı otomatik <span className="text-gold">Admin</span> olur.
        </p>
        <div className="text-center mt-3">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Ana sayfa</Link>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, icon, children }: any) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1 glass rounded-lg px-3 py-2.5 flex items-center gap-2 focus-within:gold-glow transition-all">
        <span className="text-primary/70">{icon}</span>
        {children}
      </div>
    </label>
  );
}
