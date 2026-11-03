"use client";

import { useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, CircleAlert, Loader2, LockKeyhole, Send, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import styles from "./operator.module.css";

type Check = { component?: string; check_name?: string; count?: number; status?: string; explanation?: string };
type Incident = { title?: string; summary?: string; status?: string; severity?: string; last_seen_at?: string };
type Project = { project_name?: string; platform?: string; environment?: string; connection_status?: string };
type Result = { owner?: { email?: string }; projects?: Project[]; diagnostics?: { checked_at?: string; overall?: string; checks?: Check[]; limitations?: string[] }; incidents?: Incident[]; audit_total?: number; recent_audit?: Array<{ action?: string; outcome?: string; occurred_at?: string; actor_email?: string; target_type?: string; target_ref?: string; environment?: string }> };

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
    const openIncidents = incidents.filter(i => (i.status ?? "").toLowerCase() === "open");
    const resolvedIncidents = incidents.filter(i => (i.status ?? "").toLowerCase() === "resolved");
    lines.push(`Incidents ouverts : ${openIncidents.length}. Incidents résolus retournés : ${resolvedIncidents.length}.`);
    for (const i of openIncidents) lines.push(`${i.title ?? "Incident"} — ${i.severity ?? "gravité non précisée"} — ${i.summary ?? "Aucun détail fourni"}.`);
    for (const c of data.diagnostics?.checks ?? []) if ((c.count ?? 0) > 0) lines.push(`${c.component ?? "Contrôle"} / ${c.check_name ?? "vérification"} : ${c.count} élément(s). ${c.explanation ?? ""}`);
    if (!openIncidents.length && !(data.diagnostics?.checks ?? []).some(c => (c.count ?? 0) > 0)) lines.push("Aucun incident ouvert ni élément en file d'attente n'est signalé dans les données reçues.");
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
    for (const e of events) lines.push(`${e.action ?? "Action"} — auteur : ${e.actor_email ?? "non communiqué"} — cible : ${e.target_type ?? "non précisée"} ${e.target_ref ?? ""} — ${e.outcome ?? "résultat inconnu"} — ${e.environment ?? "environnement non précisé"} — ${e.occurred_at ? new Date(e.occurred_at).toLocaleString("fr-FR") : "date non fournie"}.`);
    return { title: "Journal d'audit", lines, limitation: "Seuls les événements renvoyés par l'API du centre sont affichés." };
  }
  return { title: "Demande non encore prise en charge", lines: ["Je n'ai pas encore de moteur IA connecté pour comprendre toutes les demandes libres.", "Pour l'instant, je peux exécuter quelques consultations réelles en lecture seule : bilan des projets, incidents, présences et journal d'audit."], limitation: "Aucune donnée métier d’Aéro Service n’a été modifiée. Les contrôles internes WDESK ont pu être actualisés." };
}

export default function OperatorPage() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<{title:string;lines:string[];limitation?:string} | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  async function submit(value = query) {
    const clean = value.trim();
    if (!clean || busy) return;
    setQuery(clean); setLastQuery(clean); setBusy(true); setError(""); setAnswer(null); setCheckedAt(null);
    try {
      const response = await fetch("/api/control", { cache: "no-store" });
      const raw = await response.text();
      let data: Result = {};
      try { data = raw ? JSON.parse(raw) as Result : {}; } catch { throw new Error("La réponse du centre est illisible."); }
      if (!response.ok) throw new Error(response.status === 401 ? "Ta session propriétaire a expiré. Reconnecte-toi." : "Le centre n'a pas pu lire ses données.");
      setAnswer(summarize(clean, data));
      setCheckedAt(data.diagnostics?.checked_at ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Consultation impossible."); }
    finally { setBusy(false); }
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <Link href="/" className={styles.backLink}><ArrowLeft size={17}/> Retour au centre</Link>
      <div className={styles.ownerBadge}><ShieldCheck size={14}/> Session propriétaire</div>
    </header>
    <section className={styles.container}>
      <div className={styles.intro}>
        <div className={styles.botIcon}><Bot size={25}/></div>
        <div><p className={styles.eyebrow}>WDESK · OPÉRATEUR</p><h1 className={styles.heading}>Que veux-tu que je vérifie ?</h1><p className={styles.description}>Écris normalement. Le mode initial consulte les données réelles du centre et actualise ses contrôles internes. Il ne modifie pas les données métier d’Aéro Service. Les corrections et commandes techniques ne sont pas encore activées.</p></div>
      </div>
      <div className={styles.panel}>
        <label htmlFor="operator-query" className={styles.fieldLabel}>Ta demande</label>
        <textarea id="operator-query" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void submit();}}} placeholder="Ex. : Fais-moi un bilan de tous mes projets…" className={styles.textarea} />
        <div className={styles.composerFooter}><p className={styles.hint}>Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</p><button onClick={()=>void submit()} disabled={!query.trim()||busy} className={styles.primaryButton}>{busy?<Loader2 className={styles.spinner} size={16}/>:<Send size={15}/>} Consulter</button></div>
      </div>
      <div className={styles.spaced}><p className={styles.sectionLabel}>EXEMPLES DE DEMANDES</p><div className={styles.suggestionGrid}>{suggestions.map(s=><button key={s} onClick={()=>{setQuery(s);void submit(s);}} disabled={busy} className={styles.suggestion}>{s}</button>)}</div></div>
      {busy&&<div className={styles.loading}><Loader2 className={styles.spinner} size={17}/> Lecture des données réelles du centre…</div>}
      {error&&<div role="alert" className={styles.error}><CircleAlert size={18} className={styles.shrink}/>{error}</div>}
      {answer&&<article className={styles.resultCard}><div className={styles.inlineFlex}><Bot size={18}/><span className={styles.resultEyebrow}>DONNÉES RETOURNÉES PAR LE CENTRE</span></div><h2 className={styles.resultTitle}>{answer.title}</h2>{checkedAt&&<p className={styles.queryText}>Contrôles actualisés le {new Date(checkedAt).toLocaleString("fr-FR")}</p>}<p className={styles.queryText}>Demande : {lastQuery}</p><ul className={styles.resultList}>{answer.lines.map((line,i)=><li key={i} className={styles.resultItem}><span className={styles.bullet}/>{line}</li>)}</ul>{answer.limitation&&<div className={styles.limitation}><b className={styles.darkText}>Limite de cette vérification :</b> {answer.limitation}</div>}<div className={styles.readOnly}><LockKeyhole size={13}/> Consultation · données métier inchangées · contrôles WDESK actualisés</div></article>}
      <div className={styles.nextStep}><Wrench size={17} className={styles.toolIcon}/><p className={styles.nextStepText}><b className={styles.nextStepStrong}>Prochaine évolution :</b> connecter le moteur IA, puis ajouter les outils d'analyse approfondie et de correction avec validation propriétaire. Les demandes d'écriture resteront bloquées tant que l'autorisation et les vérifications de sécurité ne sont pas réunies.</p></div>
    </section>
  </main>;
}
