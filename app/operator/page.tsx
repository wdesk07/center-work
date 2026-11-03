"use client";

import { useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, CircleAlert, Loader2, LockKeyhole, Send, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";

type Check = { component?: string; check_name?: string; count?: number; status?: string; explanation?: string };
type Incident = { title?: string; summary?: string; status?: string; severity?: string; last_seen_at?: string };
type Project = { project_name?: string; platform?: string; environment?: string; connection_status?: string };
type Result = { owner?: { email?: string }; projects?: Project[]; diagnostics?: { checked_at?: string; overall?: string; checks?: Check[]; limitations?: string[] }; incidents?: Incident[]; audit_total?: number; recent_audit?: Array<{ action?: string; outcome?: string; occurred_at?: string }> };

const suggestions = [
  "Fais-moi un bilan de tous mes projets",
  "Quelles sont les erreurs et les incidents ouverts ?",
  "Vérifie l'état des présences et des pointages en attente",
  "Montre-moi les dernières opérations administratives",
];

function summarize(query: string, data: Result): { title: string; lines: string[]; limitation?: string } {
  const q = query.toLocaleLowerCase("fr");
  const lines: string[] = [];
  if (/bilan|projet|infrastructure|état général/.test(q)) {
    lines.push(`Projets inscrits au registre : ${data.projects?.length ?? 0}.`);
    for (const p of data.projects ?? []) lines.push(`${p.project_name ?? "Projet"} — ${p.platform ?? "plateforme"} — ${p.environment ?? "environnement"} — connexion : ${p.connection_status ?? "non précisée"}.`);
    lines.push(`Incidents actuellement retournés : ${data.incidents?.length ?? 0}.`);
    return { title: "Bilan du registre WDESK", lines, limitation: "Ce bilan porte sur les éléments enregistrés dans le centre. Il ne constitue pas encore un inventaire exhaustif de tous les comptes et services fournisseurs." };
  }
  if (/erreur|incident|panne|problème|anomalie/.test(q)) {
    const incidents = data.incidents ?? [];
    lines.push(`Incidents retournés par le centre : ${incidents.length}.`);
    for (const i of incidents) lines.push(`${i.title ?? "Incident"} — ${i.status ?? "état inconnu"} — ${i.summary ?? "Aucun détail fourni"}.`);
    for (const c of data.diagnostics?.checks ?? []) if ((c.count ?? 0) > 0) lines.push(`${c.component ?? "Contrôle"} / ${c.check_name ?? "vérification"} : ${c.count} élément(s). ${c.explanation ?? ""}`);
    if (!incidents.length && !(data.diagnostics?.checks ?? []).some(c => (c.count ?? 0) > 0)) lines.push("Aucun incident ou élément en file d'attente n'est signalé dans les données reçues.");
    return { title: "État des incidents et diagnostics", lines, limitation: "Les journaux Vercel, erreurs navigateur et alertes de tous les fournisseurs ne sont pas encore intégrés." };
  }
  if (/présence|pointage|qr|borne|retard|absence|synchron/.test(q)) {
    const checks = (data.diagnostics?.checks ?? []).filter(c => /attendance|qr|pointage|presence/i.test(`${c.component} ${c.check_name}`));
    lines.push(checks.length ? "Contrôles liés aux présences retournés :" : "Le diagnostic global est disponible, mais aucun contrôle de présence distinct n'a été retourné.");
    for (const c of checks) lines.push(`${c.check_name ?? "Contrôle"} : ${c.count ?? 0} élément(s). ${c.explanation ?? ""}`);
    lines.push(`État global du diagnostic : ${data.diagnostics?.overall ?? "non communiqué"}.`);
    return { title: "Contrôle des présences", lines, limitation: "La surveillance continue des appareils et la vérification individuelle de chaque compte ne sont pas encore disponibles." };
  }
  if (/audit|historique|opération|action|qui a/.test(q)) {
    const events = data.recent_audit ?? [];
    lines.push(`Nombre total d'événements d'audit : ${data.audit_total ?? 0}.`);
    for (const e of events) lines.push(`${e.action ?? "Action"} — ${e.outcome ?? "résultat inconnu"} — ${e.occurred_at ? new Date(e.occurred_at).toLocaleString("fr-FR") : "date non fournie"}.`);
    return { title: "Journal d'audit", lines, limitation: "Seuls les événements renvoyés par l'API du centre sont affichés." };
  }
  return { title: "Demande non encore prise en charge", lines: ["Je n'ai pas encore de moteur IA connecté pour comprendre toutes les demandes libres.", "Pour l'instant, je peux exécuter quelques consultations réelles en lecture seule : bilan des projets, incidents, présences et journal d'audit."], limitation: "Aucune modification n'a été effectuée." };
}

export default function OperatorPage() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<{title:string;lines:string[];limitation?:string} | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  async function submit(value = query) {
    const clean = value.trim();
    if (!clean || busy) return;
    setQuery(clean); setLastQuery(clean); setBusy(true); setError(""); setAnswer(null);
    try {
      const response = await fetch("/api/control", { cache: "no-store" });
      const raw = await response.text();
      let data: Result = {};
      try { data = raw ? JSON.parse(raw) as Result : {}; } catch { throw new Error("La réponse du centre est illisible."); }
      if (!response.ok) throw new Error(response.status === 401 ? "Ta session propriétaire a expiré. Reconnecte-toi." : "Le centre n'a pas pu lire ses données.");
      setAnswer(summarize(clean, data));
    } catch (e) { setError(e instanceof Error ? e.message : "Consultation impossible."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f4f6fa] text-[#172338]">
    <header className="flex items-center justify-between border-b border-[#e5eaf1] bg-white px-5 py-4 md:px-10">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[#52627b]"><ArrowLeft size={17}/> Retour au centre</Link>
      <div className="flex items-center gap-2 rounded-full bg-[#eaf7f1] px-3 py-1.5 text-xs font-semibold text-[#18815e]"><ShieldCheck size={14}/> Session propriétaire</div>
    </header>
    <section className="mx-auto max-w-4xl px-5 py-10 md:py-16">
      <div className="mb-8 flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#20385f] text-white"><Bot size={25}/></div>
        <div><p className="text-xs font-bold tracking-[.18em] text-[#6880b5]">WDESK · OPÉRATEUR</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">Que veux-tu que je vérifie ?</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#758197]">Écris normalement. Le mode initial peut déjà consulter les données réelles du centre en lecture seule. Les corrections et commandes techniques ne sont pas encore activées.</p></div>
      </div>
      <div className="rounded-2xl border border-[#e4e9f0] bg-white p-4 shadow-sm md:p-6">
        <label htmlFor="operator-query" className="mb-2 block text-xs font-semibold text-[#52627b]">Ta demande</label>
        <textarea id="operator-query" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void submit();}}} placeholder="Ex. : Fais-moi un bilan de tous mes projets…" className="min-h-28 w-full resize-y rounded-xl border border-[#dfe5ee] bg-[#fbfcfe] p-4 text-sm outline-none transition focus:border-[#7792d8] focus:ring-2 focus:ring-[#7792d8]/15" />
        <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] text-[#8a95a6]">Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</p><button onClick={()=>void submit()} disabled={!query.trim()||busy} className="inline-flex items-center gap-2 rounded-xl bg-[#3157a4] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy?<Loader2 className="animate-spin" size={16}/>:<Send size={15}/>} Consulter</button></div>
      </div>
      <div className="mt-5"><p className="mb-3 text-xs font-bold tracking-wide text-[#7d899d]">EXEMPLES DE DEMANDES</p><div className="grid gap-2 sm:grid-cols-2">{suggestions.map(s=><button key={s} onClick={()=>{setQuery(s);void submit(s);}} disabled={busy} className="rounded-xl border border-[#e3e8f0] bg-white px-4 py-3 text-left text-xs leading-5 text-[#52627b] transition hover:border-[#aebfe7] hover:bg-[#fbfcff] disabled:opacity-50">{s}</button>)}</div></div>
      {busy&&<div className="mt-6 flex items-center gap-3 rounded-xl border border-[#dfe7f5] bg-white p-4 text-sm text-[#637594]"><Loader2 className="animate-spin" size={17}/> Lecture des données réelles du centre…</div>}
      {error&&<div role="alert" className="mt-6 flex gap-3 rounded-xl border border-[#f1dfc6] bg-[#fffaf1] p-4 text-sm text-[#936522]"><CircleAlert size={18} className="shrink-0"/>{error}</div>}
      {answer&&<article className="mt-6 rounded-2xl border border-[#dfe6f0] bg-white p-5 shadow-sm md:p-6"><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-[#16825d]"/><span className="text-[10px] font-bold tracking-[.16em] text-[#7184a8]">RÉSULTAT DE CONSULTATION</span></div><h2 className="mt-3 text-lg font-bold">{answer.title}</h2><p className="mt-1 text-xs text-[#8994a5]">Demande : {lastQuery}</p><ul className="mt-4 space-y-3">{answer.lines.map((line,i)=><li key={i} className="flex gap-2 text-sm leading-6 text-[#4d5c72]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6e87c2]"/>{line}</li>)}</ul>{answer.limitation&&<div className="mt-5 rounded-xl bg-[#f5f7fb] p-3 text-xs leading-5 text-[#718096]"><b className="text-[#53627a]">Limite de cette vérification :</b> {answer.limitation}</div>}<div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-[#16825d]"><LockKeyhole size={13}/> Lecture seule · aucune donnée modifiée</div></article>}
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-dashed border-[#d7dee9] p-4"><Wrench size={17} className="mt-0.5 shrink-0 text-[#8291a8]"/><p className="text-xs leading-5 text-[#7c899d]"><b className="text-[#59677d]">Prochaine évolution :</b> connecter le moteur IA, puis ajouter les outils d'analyse approfondie et de correction avec validation propriétaire. Les demandes d'écriture resteront bloquées tant que l'autorisation et les vérifications de sécurité ne sont pas réunies.</p></div>
    </section>
  </main>;
}
