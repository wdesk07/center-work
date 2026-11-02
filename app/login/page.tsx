"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMessage("Lien de connexion envoyé. Ouvre le message reçu sur cette adresse pour continuer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connexion impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return (
    <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#f5f7fb", padding:24, fontFamily:"Arial,sans-serif", color:"#182235" }}>
      <section style={{ width:"100%", maxWidth:420, background:"#fff", border:"1px solid #e8edf4", borderRadius:16, padding:30, boxShadow:"0 12px 40px #1822350d" }}>
        <p style={{ color:"#6178b5", fontSize:11, letterSpacing:2, fontWeight:700 }}>WDESK CONTROL CENTER</p>
        <h1 style={{ fontSize:25, margin:"8px 0" }}>Connexion propriétaire</h1>
        <p style={{ color:"#778399", fontSize:13, lineHeight:1.6 }}>Accès par lien sécurisé envoyé par e-mail. Aucun mot de passe n’est demandé ici.</p>
        {!configured ? (
          <div role="alert" style={{ marginTop:22, padding:14, borderRadius:9, background:"#fff5e5", color:"#8b641e", fontSize:13, lineHeight:1.6 }}>
            Configuration en attente : les variables publiques Supabase doivent être ajoutées au projet Vercel avant de pouvoir se connecter.
          </div>
        ) : (
          <form onSubmit={submit} style={{ display:"grid", gap:12, marginTop:22 }}>
            <label htmlFor="email" style={{ fontSize:12, fontWeight:700 }}>Adresse e-mail du propriétaire</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="wdesk87@gmail.com" style={{ border:"1px solid #dce2ec", borderRadius:8, padding:"12px 13px", fontSize:14 }} />
            <button disabled={busy} type="submit" style={{ border:0, borderRadius:8, padding:13, background:"#4569c4", color:"#fff", fontWeight:700, cursor:busy?"wait":"pointer" }}>{busy?"Envoi…":"Recevoir mon lien sécurisé"}</button>
          </form>
        )}
        {message && <p role="status" style={{ marginTop:16, fontSize:12, lineHeight:1.5, color:"#526da9" }}>{message}</p>}
        <p style={{ marginTop:24, color:"#929cac", fontSize:10 }}>Accès réservé aux identités enregistrées et vérifiées par WDESK.</p>
      </section>
    </main>
  );
}
