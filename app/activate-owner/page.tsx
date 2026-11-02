"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ActivateOwnerPage() {
  const [status, setStatus] = useState("Vérification de votre identité…");

  useEffect(() => {
    let active = true;
    async function linkOwner() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          window.location.replace("/login");
          return;
        }
        setStatus("Vérification de l’adresse propriétaire enregistrée…");
        const response = await fetch("/api/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bootstrap_primary_owner" }),
        });
        const rawBody = await response.text();
        let result: { error?: string; ok?: boolean } = {};
        try {
          result = rawBody ? JSON.parse(rawBody) as { error?: string; ok?: boolean } : {};
        } catch {
          throw new Error("Le serveur a renvoyé une réponse inattendue. Vérifiez la connexion puis réessayez.");
        }
        if (!response.ok) throw new Error(result.error ?? `Activation refusée (HTTP ${response.status}).`);
        if (!result.ok) throw new Error("Le serveur n’a pas confirmé l’activation du compte propriétaire.");
        window.location.replace("/");
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Activation impossible.");
      }
    }
    void linkOwner();
    return () => { active = false; };
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f7fb", padding: 24, fontFamily: "Arial,sans-serif", color: "#182235" }}>
      <section style={{ maxWidth: 460, width: "100%", background: "#fff", border: "1px solid #e8edf4", borderRadius: 16, padding: 30 }}>
        <p style={{ color: "#6178b5", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>WDESK CONTROL CENTER</p>
        <h1 style={{ fontSize: 23 }}>Activation du propriétaire</h1>
        <p role="status" style={{ color: "#778399", fontSize: 13, lineHeight: 1.7 }}>{status}</p>
        <p style={{ color: "#929cac", fontSize: 11, lineHeight: 1.6 }}>Seule l’adresse propriétaire déjà enregistrée et vérifiée peut effectuer cette liaison. Aucun autre compte ne peut s’attribuer le rôle principal.</p>
      </section>
    </main>
  );
}
