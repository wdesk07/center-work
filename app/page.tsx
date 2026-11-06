"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, Blocks, Box, BriefcaseBusiness, ChevronDown,
  CircleHelp, Cloud, Code2, Database, Gauge, Github, LockKeyhole, Menu,
  Search, Settings, ShieldCheck, Users, X, RefreshCw, ExternalLink, ClipboardList
} from "lucide-react";

type ModuleKey = "overview" | "aero" | "diagnostics" | "projects" | "commands" | "supabase" | "hosting" | "github" | "access" | "audit" | "settings";
type Project = { id?: string; platform: string; project_name: string; environment: string; external_ref?: string | null; dashboard_url?: string | null; connection_status: string; notes?: string | null; updated_at?: string };
type AuditEvent = { id: number; occurred_at: string; actor_email?: string; action: string; target_type?: string; target_ref?: string; environment: string; outcome: string; details?: Record<string, unknown> };
type DiagnosticCheck = { component: string; check_name: string; count: number; status: string; explanation: string };
type Diagnostics = { checked_at: string; environment: string; source: string; overall: string; checks: DiagnosticCheck[]; daily_attendance_records_today: number; qr_requests_pending_total?: number; limitations: string[] };
type Incident = { id: string; fingerprint: string; component: string; severity: string; status: string; title: string; summary: string; first_seen_at: string; last_seen_at: string; occurrence_count: number; resolved_at?: string | null };
type Dashboard = { owner?: { email: string; display_name: string; role: string }; environment?: string; projects?: Project[]; recent_audit?: AuditEvent[]; audit_total?: number; diagnostics?: Diagnostics; incidents?: Incident[]; capabilities?: { provider_operations?: boolean; diagnostics_read?: boolean; incident_tracking?: boolean } };

const nav: { key: ModuleKey; label: string; icon: typeof Gauge; group: string }[] = [
  { key: "overview", label: "Vue générale", icon: Gauge, group: "ESPACE DE TRAVAIL" },
  { key: "aero", label: "Aéro Service · Opérations", icon: ClipboardList, group: "AÉRO SERVICE" },
  { key: "diagnostics", label: "Diagnostics & incidents", icon: Activity, group: "ESPACE DE TRAVAIL" },
  { key: "projects", label: "Projets & infrastructures", icon: Blocks, group: "PILOTAGE" },
  { key: "commands", label: "Commandes propriétaires", icon: LockKeyhole, group: "PILOTAGE" },
  { key: "supabase", label: "Supabase", icon: Database, group: "PILOTAGE" },
  { key: "hosting", label: "Hébergement Vercel", icon: Cloud, group: "PILOTAGE" },
  { key: "github", label: "Code & dépôts", icon: Github, group: "PILOTAGE" },
  { key: "access", label: "Utilisateurs & accès", icon: Users, group: "SÉCURITÉ" },
  { key: "audit", label: "Journal d’audit", icon: ShieldCheck, group: "SÉCURITÉ" },
  { key: "settings", label: "Paramètres & connexions", icon: Settings, group: "SYSTÈME" },
];

const descriptions: Record<ModuleKey, { title: string; intro: string }> = {
  overview: { title: "Vue générale", intro: "Vue réelle du registre WDESK et des connexions actuellement vérifiées." },
  aero: { title: "Aéro Service · Opérations", intro: "Inventaire opérationnel réel du projet Aéro Service TEST : présence, borne, QR, cours et finances. Lecture seule à ce stade." },
  diagnostics: { title: "Diagnostics & incidents", intro: "Contrôles agrégés en direct sur les données TEST. Les limites de mesure sont affichées explicitement." },
  projects: { title: "Projets & infrastructures", intro: "Inventaire issu du registre sécurisé du centre. Un élément recensé n’est pas automatiquement une connexion fournisseur." },
  commands: { title: "Commandes propriétaires", intro: "Inventaire TEST et première action réversible, réservés au propriétaire vérifié." },
  supabase: { title: "Supabase", intro: "Accès à la console, inventaire des projets et état de la liaison du registre." },
  hosting: { title: "Hébergement Vercel", intro: "Accès à la console Vercel et au déploiement du centre. Les commandes API attendent une intégration sécurisée." },
  github: { title: "Code & dépôts", intro: "Accès aux dépôts WDESK et au code du centre. Les opérations d’écriture seront protégées et auditées." },
  access: { title: "Utilisateurs & accès", intro: "État de l’identité propriétaire. La gestion des autres opérateurs sera activée après mise en place des règles dédiées." },
  audit: { title: "Journal d’audit", intro: "Événements réellement enregistrés par l’API du centre." },
  settings: { title: "Paramètres & connexions", intro: "État des intégrations et des prérequis de sécurité." },
};

function Status({ children, tone = "muted" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status status-${tone}`}><i />{children}</span>;
}

function ProviderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="provider-link" href={href} target="_blank" rel="noreferrer">{children}<ExternalLink size={14}/></a>;
}

export default function Home() {
  const [active, setActive] = useState<ModuleKey>("overview");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inventory, setInventory] = useState<{
    profiles: any[]; formations: any[]; groups: any[]; students: any[]; staff: any[]; teachers: any[]; registrations: any[];
    daily_attendance: any[]; session_attendance: any[]; course_sessions: any[]; weekly_schedule: any[];
    qr_requests: any[]; kiosk_devices: any[]; offline_events: any[]; operating_days: any[];
    justifications: any[]; penalties: any[]; penalty_rules: any[]; payments: any[];
  } | null>(null);
  const [personSearch, setPersonSearch] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [assignmentTarget, setAssignmentTarget] = useState("");
  const [assignmentFormation, setAssignmentFormation] = useState("");
  const [assignmentGroup, setAssignmentGroup] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [assignmentConfirmation, setAssignmentConfirmation] = useState("");
  const [qrTarget, setQrTarget] = useState("");
  const [qrDecision, setQrDecision] = useState<"approved" | "rejected">("approved");
  const [qrReason, setQrReason] = useState("");
  const [qrConfirmation, setQrConfirmation] = useState("");
  const [kioskTarget, setKioskTarget] = useState("");
  const [kioskReason, setKioskReason] = useState("");
  const [kioskConfirmation, setKioskConfirmation] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/control", { cache: "no-store" });
      const raw = await response.text();
      let result: Dashboard & { error?: string } = {};
      try { result = raw ? JSON.parse(raw) as Dashboard & { error?: string } : {}; }
      catch { throw new Error("Réponse serveur illisible. Réessayez ou consultez les journaux."); }
      if (!response.ok) throw new Error(result.error || `Synchronisation refusée (HTTP ${response.status}).`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de synchroniser le centre.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function loadCommandInventory() {
    setInventoryLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/commands", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Lecture refusée");
      setInventory(result.inventory);
      setNotice("Inventaire du projet TEST chargé en lecture seule.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Impossible de charger l’inventaire."); }
    finally { setInventoryLoading(false); }
  }

  async function submitProfileNameChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfile || !newDisplayName.trim() || changeReason.trim().length < 8 || confirmation !== "CONFIRMER") {
      setNotice("Complète le profil, le nouveau nom, le motif et saisis CONFIRMER.");
      return;
    }
    setCommandBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profile_display_name_update", target_id: selectedProfile,
          display_name: newDisplayName.trim(), reason: changeReason.trim(),
          confirmation: "CONFIRMER", request_id: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Modification refusée");
      setNotice("Nom du profil modifié et opération inscrite au journal d’audit TEST.");
      setNewDisplayName(""); setChangeReason(""); setConfirmation("");
      await loadCommandInventory();
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la commande."); }
    finally { setCommandBusy(false); }
  }

  async function submitStudentAssignmentRepair(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentTarget || !assignmentFormation || assignmentReason.trim().length < 8 || assignmentConfirmation !== "CONFIRMER") {
      setNotice("Choisis l’apprenant et la formation, indique un motif et saisis CONFIRMER.");
      return;
    }
    setCommandBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "student_assignment_repair", target_id: assignmentTarget,
          formation_id: assignmentFormation, group_id: assignmentGroup || null,
          reason: assignmentReason.trim(), confirmation: "CONFIRMER", request_id: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Réparation refusée");
      setNotice("Association apprenant / formation / groupe réparée en TEST. Modification inscrite au journal d’audit.");
      setAssignmentReason(""); setAssignmentConfirmation("");
      await loadCommandInventory();
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la réparation."); }
    finally { setCommandBusy(false); }
  }

  async function submitQrReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!qrTarget || qrReason.trim().length < 8 || qrConfirmation !== "CONFIRMER") {
      setNotice("Choisis une demande QR, indique le motif et saisis CONFIRMER.");
      return;
    }
    setCommandBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "qr_checkin_review", target_id: qrTarget, decision: qrDecision,
          reason: qrReason.trim(), confirmation: "CONFIRMER", request_id: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Décision QR refusée");
      setNotice(qrDecision === "approved"
        ? "Demande QR approuvée par les règles Aéro Service TEST. Vérifie le résultat et toute pénalité éventuelle."
        : "Demande QR rejetée et motif enregistré dans l’historique TEST.");
      setQrTarget(""); setQrReason(""); setQrConfirmation("");
      await loadCommandInventory();
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la décision QR."); }
    finally { setCommandBusy(false); }
  }

  async function submitKioskRevoke(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kioskTarget || kioskReason.trim().length < 8 || kioskConfirmation !== "CONFIRMER") {
      setNotice("Choisis une borne active, indique le motif et saisis CONFIRMER.");
      return;
    }
    setCommandBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "kiosk_device_revoke", target_id: kioskTarget,
          reason: kioskReason.trim(), confirmation: "CONFIRMER", request_id: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Révocation refusée");
      setNotice("Borne révoquée dans Aéro Service TEST. Le terminal concerné ne peut plus utiliser son ancien jeton.");
      setKioskTarget(""); setKioskReason(""); setKioskConfirmation("");
      await loadCommandInventory();
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la révocation."); }
    finally { setCommandBusy(false); }
  }

  const projects = data?.projects ?? [];
  const audits = data?.recent_audit ?? [];
  const diagnostics = data?.diagnostics;
  const incidents = data?.incidents ?? [];
  const filteredProjects = useMemo(() => projects.filter(p => (p.project_name + p.platform + p.environment + (p.notes ?? "")).toLowerCase().includes(query.toLowerCase())), [projects, query]);
  const current = descriptions[active];
  const matchedProfiles = (inventory?.profiles ?? []).filter((p: any) => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return false;
    const linkedStudent = inventory?.students.find((x: any) => x.id === p.id);
    const linkedStaff = inventory?.staff.find((x: any) => x.id === p.id);
    const linkedTeacher = inventory?.teachers.find((x: any) => x.id === p.id);
    const registrationText = inventory?.registrations.filter((x: any) => x.person_id === p.id).map((x: any) => x.registration_number).join(" ") ?? "";
    return [p.display_name,p.first_name,p.last_name,p.email,p.public_id,linkedStudent?.student_number,linkedStaff?.staff_number,linkedTeacher?.teacher_number,registrationText].some(v => String(v ?? "").toLowerCase().includes(q));
  }).slice(0, 30);

  function choose(key: ModuleKey) {
    setActive(key); setMobileOpen(false); setNotice("");
  }

  const platformCounts = {
    supabase: projects.filter(p => p.platform === "supabase" && p.connection_status === "connected").length,
    vercel: projects.filter(p => p.platform === "vercel" && p.connection_status === "connected").length,
    github: projects.filter(p => p.platform === "github" && p.connection_status === "connected").length,
  };

  return (
    <main className="shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Box size={21} strokeWidth={2.2} /></div><div><strong>WDESK</strong><span>CONTROL CENTER</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fermer"><X size={18}/></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch"><div className="workspace-avatar">W</div><span><b>WDesk Principal</b><small>Propriétaire principal</small></span><ChevronDown size={15}/></div>
        <nav className="navigation">
          {(["ESPACE DE TRAVAIL", "AÉRO SERVICE", "PILOTAGE", "SÉCURITÉ", "SYSTÈME"] as const).map(group => <div className="nav-group" key={group}><p>{group}</p>{nav.filter(item => item.group === group).map(item => { const Icon = item.icon; return <button key={item.key} className={`nav-link ${active === item.key ? "nav-active" : ""}`} onClick={() => choose(item.key)}><Icon size={17}/><span>{item.label}</span>{item.key === "audit" && audits.length > 0 && <span className="nav-dot"/>}</button>; })}</div>)}
        </nav>
        <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17}/><span><b>{data?.owner ? "Identité vérifiée" : "Espace protégé"}</b><small>{data?.owner?.role === "primary_owner" ? "Propriétaire principal" : data?.owner ? data.owner.role : "Vérification requise"}</small></span></div><div className="profile"><div className="profile-avatar">WO</div><div><b>{data?.owner?.display_name ?? "WDESK OWNER"}</b><small>{data?.owner?.email ?? "wdesk87@gmail.com"}</small></div><button aria-label="Paramètres du compte" onClick={() => choose("settings")}><Settings size={16}/></button></div></div>
      </aside>
      {mobileOpen && <button className="scrim" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)}/>}
      <section className="main-area">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu"><Menu size={20}/></button><div className="breadcrumbs">WDESK <span>/</span> {current.title}</div><div className="top-actions"><div className="system-indicator"><i/> {error ? "Synchronisation à vérifier" : loading ? "Synchronisation…" : "API du centre joignable"}</div><button className="icon-button" aria-label="Actualiser" onClick={() => void refresh()}><RefreshCw size={17}/></button><button className="help-button" onClick={() => setNotice("Les consoles fournisseurs sont accessibles ci-dessous. Les commandes qui modifient des données restent désactivées tant que leurs jetons dédiés, autorisations et tests ne sont pas configurés.")}><CircleHelp size={17}/><span>Aide</span></button></div></header>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow">CENTRE DE COMMANDEMENT WDESK</div><h1>{current.title}</h1><p>{current.intro}</p></div><div className="owner-chip"><div className="crown">♛</div><span><b>{data?.owner?.display_name ?? "WDESK OWNER"}</b><small>{data?.owner?.email ?? "Compte propriétaire"}</small></span></div></div>
          {notice && <div className="notice"><Activity size={17}/>{notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}
          {error && <div className="notice"><Activity size={17}/>{error}<button onClick={() => void refresh()}><RefreshCw size={15}/></button></div>}

          {active === "overview" && <>
            <div className="welcome-banner"><div className="welcome-icon"><Gauge size={24}/></div><div><span>ESPACE PROPRIÉTAIRE</span><h2>Un centre unique pour vos infrastructures.</h2><p>Les statuts reflètent les données réellement retournées par l’API du centre.</p></div><div className="banner-orb orb-one"/><div className="banner-orb orb-two"/></div>
            <div className="section-title"><div><h2>Surveillance opérationnelle</h2><p>Les premiers contrôles automatiques sont actifs sur Aéro Service TEST.</p></div><button className="subtle-button" onClick={() => choose("diagnostics")}>Ouvrir les diagnostics <ArrowUpRight size={15}/></button></div>
            <div className="stats-grid">
              <article className="stat-card"><div className="stat-top"><span>Alertes à examiner</span><Activity size={18}/></div><strong>{diagnostics ? diagnostics.checks.filter(x => x.count > 0).length : "…"}</strong><small>Files d’attente ou échecs détectés en TEST</small></article>
              <article className="stat-card"><div className="stat-top"><span>Pointages aujourd’hui</span><ClipboardList size={18}/></div><strong>{diagnostics ? diagnostics.daily_attendance_records_today : "…"}</strong><small>Enregistrements journaliers · TEST</small></article>
            </div>
            <div className="section-title"><div><h2>État des infrastructures</h2><p>{loading ? "Lecture du registre…" : `${projects.length} élément(s) dans le registre sécurisé`}</p></div><button className="subtle-button" onClick={() => void refresh()}>Actualiser <RefreshCw size={15}/></button></div>
            <div className="stats-grid">
              <article className="stat-card"><div className="stat-top"><span>Projets recensés</span><Blocks size={18}/></div><strong>{loading ? "…" : String(projects.length).padStart(2, "0")}</strong><small>Registre du centre, pas un scan complet des comptes</small></article>
              <article className="stat-card"><div className="stat-top"><span>Connecteurs vérifiés</span><Activity size={18}/></div><strong>{loading ? "…" : String(platformCounts.supabase + platformCounts.vercel + platformCounts.github).padStart(2, "0")}</strong><small>Connexions fournisseur marquées connectées</small></article>
              <article className="stat-card"><div className="stat-top"><span>Propriétaire</span><LockKeyhole size={18}/></div><strong>{data?.owner ? "Vérifié" : loading ? "…" : "À vérifier"}</strong><small>{data?.owner?.email ?? "L’identité n’a pas été retournée par l’API"}</small></article>
              <article className="stat-card"><div className="stat-top"><span>Événements d’audit</span><ShieldCheck size={18}/></div><strong>{loading ? "…" : data?.audit_total ?? 0}</strong><small>Événements enregistrés dans le registre</small></article>
            </div>
            <div className="section-title"><div><h2>Accès aux fournisseurs</h2><p>Ouvrir directement les consoles pour les opérations qui ne sont pas encore intégrées.</p></div></div>
            <div className="quick-grid">
              <div><Database/><span><b>Supabase</b><small>{platformCounts.supabase ? "Connexion enregistrée" : "Console fournisseur accessible"}</small><ProviderLink href="https://supabase.com/dashboard/project/nuijzdqnhjzcnqpfqvvl">Ouvrir la console</ProviderLink></span><ArrowUpRight/></div>
              <div><Cloud/><span><b>Vercel</b><small>{platformCounts.vercel ? "Connexion enregistrée" : "Gestion via console pour l’instant"}</small><ProviderLink href="https://vercel.com/wdesk/center-work">Ouvrir le projet centre</ProviderLink></span><ArrowUpRight/></div>
              <div><Github/><span><b>GitHub</b><small>{platformCounts.github ? "Connexion enregistrée" : "Dépôt source du centre"}</small><ProviderLink href="https://github.com/wdesk07/center-work">Ouvrir le dépôt</ProviderLink></span><ArrowUpRight/></div>
              <div><BriefcaseBusiness/><span><b>Aéro Service</b><small>Production séparée du backend TEST</small><ProviderLink href="https://aero-service.vercel.app/">Ouvrir le site de production</ProviderLink></span><ArrowUpRight/></div>
            </div>
            <div className="lower-grid">
              <article className="panel"><div className="panel-heading"><div><h3>Activité récente</h3><p>Journal réellement retourné par l’API</p></div><button onClick={() => choose("audit")}>Tout voir <ArrowUpRight size={14}/></button></div>{audits.length ? <div className="audit-list">{audits.slice(0,5).map(event => <div className="audit-row" key={event.id}><div><b>{event.action}</b><small>{event.actor_email ?? "Système"} · {event.environment}</small><small>{event.details ? JSON.stringify(event.details) : "Détails non fournis par la source"}</small></div><Status tone={event.outcome === "success" ? "good" : event.outcome === "denied" || event.outcome === "failure" ? "warn" : "muted"}>{event.outcome}</Status></div>)}</div> : <div className="empty-state"><div><Activity size={21}/></div><b>Aucun événement récent retourné</b><span>Le journal s’affichera ici lorsque l’API renverra des événements.</span></div>}</article>
              <article className="panel"><div className="panel-heading"><div><h3>État de sécurité</h3><p>État connu, sans masquer les éléments manquants</p></div><ShieldCheck size={19}/></div><div className="security-list"><div><span>Identité propriétaire</span><Status tone={data?.owner ? "good" : "warn"}>{data?.owner ? "Vérifiée" : "À vérifier"}</Status></div><div><span>Registre / audit</span><Status tone={data ? "good" : "warn"}>{data ? "API accessible" : "Indisponible"}</Status></div><div><span>Opérations fournisseur depuis l’interface</span><Status tone="warn">Pas encore activées</Status></div><div><span>Backend indépendant du TEST Aéro</span><Status tone="warn">À mettre en place</Status></div></div></article>
            </div>
          </>}

          {active === "diagnostics" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Contrôles automatiques</h3><p>{diagnostics ? "Dernière lecture : " + new Date(diagnostics.checked_at).toLocaleString("fr-FR") : "Aucun résultat de diagnostic disponible."}</p></div><Status tone={diagnostics?.overall === "no_detected_queue_anomaly" ? "good" : diagnostics ? "warn" : "muted"}>{diagnostics?.overall === "no_detected_queue_anomaly" ? "Aucune anomalie de file détectée" : diagnostics ? "Vérification nécessaire" : "Non vérifié"}</Status></div>
            {incidents.length > 0 && <><div className="section-title"><div><h2>Incidents suivis</h2><p>Incidents persistants enregistrés par le moteur de diagnostic.</p></div><span className="count-pill">{incidents.filter(x => x.status === "open").length} ouverts</span></div><div className="audit-list">{incidents.map(incident => <div className="audit-row" key={incident.id}><div><b>{incident.title}</b><small>{incident.summary} · Dernière détection : {new Date(incident.last_seen_at).toLocaleString("fr-FR")} · {incident.occurrence_count} détection(s)</small></div><Status tone={incident.status === "open" ? "warn" : "good"}>{incident.status === "open" ? "Ouvert" : "Résolu"}</Status></div>)}</div></>}
            {diagnostics?.checks?.length ? <div className="audit-list">{diagnostics.checks.map((check) => <div className="audit-row" key={check.component + check.check_name}><div><b>{check.component} · {check.check_name}</b><small>{check.explanation}</small></div><Status tone={check.count > 0 ? "warn" : "good"}>{check.count} élément(s)</Status></div>)}</div> : <div className="empty-state"><b>Diagnostic non disponible</b><span>Actualisez le centre pour relancer les contrôles.</span></div>}
            <div className="section-title"><div><h2>Limites actuelles de surveillance</h2><p>Ces points ne sont pas présentés comme vérifiés tant que les sources ne sont pas connectées.</p></div></div>
            <div className="security-list">{(diagnostics?.limitations ?? ["Le GPS des appareils n’est pas mesuré en continu.", "La réception réelle des notifications sur chaque téléphone n’est pas vérifiée.", "Les journaux Vercel et les erreurs navigateur ne sont pas encore connectés."]).map((item, i) => <div key={i}><span>{item}</span><Status tone="warn">Non surveillé</Status></div>)}</div>
            <div className="notice"><Activity size={17}/>Source : {diagnostics?.source ?? "Aucune"} · Environnement : {diagnostics?.environment ?? "inconnu"}. Ces contrôles portent sur les files et enregistrements, pas sur le fonctionnement physique de chaque appareil.</div>
          </div>}

          {active === "projects" && <div className="panel project-panel"><div className="panel-heading"><div><h3>Inventaire des projets</h3><p>Données issues du registre sécurisé, sans projets fictifs ajoutés à l’écran.</p></div><span className="count-pill">{projects.length} éléments</span></div><div className="search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un projet…"/></div><div className="project-list">{filteredProjects.map(p => <article className="project-row" key={p.id ?? p.project_name}><div className="project-symbol">{p.platform === "supabase" ? <Database/> : p.platform === "vercel" ? <Cloud/> : p.platform === "github" ? <Github/> : <Code2/>}</div><div className="project-info"><b>{p.project_name}</b><span>{p.platform} · {p.notes ?? p.external_ref ?? "Aucune note"}</span></div><div className="project-meta"><small>{p.environment}</small><Status tone={p.connection_status === "connected" ? "good" : p.connection_status === "degraded" ? "warn" : "muted"}>{p.connection_status}</Status></div>{p.dashboard_url && <ProviderLink href={p.dashboard_url}>Console</ProviderLink>}</article>)}{!loading && filteredProjects.length === 0 && <div className="empty-state"><b>Aucun projet correspondant</b><span>Le registre ne contient aucun résultat pour cette recherche.</span></div>}</div></div>}

          {active === "aero" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Connecté au backend Aéro Service TEST</h3><p>Source : tables opérationnelles existantes. Aucune écriture n’est effectuée depuis cette page.</p></div><Status tone="good">Lecture réelle</Status></div>
            <div className="section-title"><div><h2>Inventaire opérationnel</h2><p>{inventory ? "Données chargées depuis Supabase TEST." : "Charge les données réelles pour afficher l’état des modules."}</p></div><button className="subtle-button" disabled={inventoryLoading} onClick={() => void loadCommandInventory()}>{inventoryLoading ? "Chargement…" : "Charger les opérations"} <RefreshCw size={15}/></button></div>
            {inventory && <>
              <div className="stats-grid">
                <article className="stat-card"><div className="stat-top"><span>Pointages journaliers</span><ClipboardList size={18}/></div><strong>{inventory.daily_attendance.length}</strong><small>Enregistrements chargés · jusqu’à 1 000</small></article>
                <article className="stat-card"><div className="stat-top"><span>Séances de cours</span><Blocks size={18}/></div><strong>{inventory.course_sessions.length}</strong><small>Historique des séances · jusqu’à 500</small></article>
                <article className="stat-card"><div className="stat-top"><span>Demandes QR en attente</span><Activity size={18}/></div><strong>{inventory.qr_requests.filter((x:any)=>["pending","submitted","requested","pending_confirmation"].includes(String(x.status).toLowerCase())).length}</strong><small>Sur {inventory.qr_requests.length} demandes chargées</small></article>
                <article className="stat-card"><div className="stat-top"><span>Bornes actives</span><LockKeyhole size={18}/></div><strong>{inventory.kiosk_devices.filter((x:any)=>!x.revoked_at).length}</strong><small>{inventory.kiosk_devices.length} appareil(s) recensé(s)</small></article>
                <article className="stat-card"><div className="stat-top"><span>Pénalités ouvertes</span><Activity size={18}/></div><strong>{inventory.penalties.filter((x:any)=>!["paid","cancelled","waived","closed"].includes(String(x.status).toLowerCase())).length}</strong><small>Sur {inventory.penalties.length} pénalités chargées</small></article>
                <article className="stat-card"><div className="stat-top"><span>Paiements à valider</span><ShieldCheck size={18}/></div><strong>{inventory.payments.filter((x:any)=>["pending","submitted","received"].includes(String(x.status).toLowerCase()) && !x.validated_at).length}</strong><small>Sur {inventory.payments.length} paiements chargés</small></article>
              </div>
              <div className="lower-grid">
                <article className="panel"><div className="panel-heading"><div><h3>Demandes QR</h3><p>Dernières demandes et motifs de rejet éventuels</p></div><span className="count-pill">{inventory.qr_requests.length}</span></div>
                  {inventory.qr_requests.slice(0,12).map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id}</b><small>{new Date(x.requested_at).toLocaleString("fr-FR")} · {x.rejection_reason ?? "Aucun motif de rejet enregistré"}</small></div><Status tone={String(x.status).toLowerCase()==="approved"?"good":String(x.status).toLowerCase()==="rejected"?"warn":"muted"}>{x.status}</Status></div>)}
                  {!inventory.qr_requests.length && <div className="empty-state">Aucune demande QR chargée.</div>}
                </article>
                <article className="panel"><div className="panel-heading"><div><h3>État des bornes</h3><p>Appareils enregistrés · aucun jeton exposé</p></div><span className="count-pill">{inventory.kiosk_devices.length}</span></div>
                  {inventory.kiosk_devices.map((x:any)=><div className="audit-row" key={x.id}><div><b>{x.name}</b><small>Activation : {x.activated_at ? new Date(x.activated_at).toLocaleString("fr-FR") : "—"} · Dernière utilisation : {x.last_used_at ? new Date(x.last_used_at).toLocaleString("fr-FR") : "—"}</small></div><Status tone={x.revoked_at?"warn":"good"}>{x.revoked_at?"Révoquée":"Active"}</Status></div>)}
                  {!inventory.kiosk_devices.length && <div className="empty-state">Aucun appareil de borne recensé.</div>}
                </article>
              </div>
              <form className="module-panel" onSubmit={submitQrReview}>
                <h3>Traiter une demande QR</h3>
                <p>L’approbation utilise la règle Aéro Service existante : elle peut créer le pointage et appliquer une pénalité de retard. Le rejet exige également un motif. Toute décision est confirmée et auditée.</p>
                <label className="command-label">Demande en attente</label>
                <select value={qrTarget} onChange={e=>setQrTarget(e.target.value)} required>
                  <option value="">Choisir une demande QR…</option>
                  {(inventory.qr_requests ?? []).filter((x:any)=>x.status==="pending_confirmation").map((x:any)=><option key={x.id} value={x.id}>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id} · {new Date(x.requested_at).toLocaleString("fr-FR")}</option>)}
                </select>
                <label className="command-label">Décision</label>
                <select value={qrDecision} onChange={e=>setQrDecision(e.target.value as "approved"|"rejected")}>
                  <option value="approved">Approuver la demande</option>
                  <option value="rejected">Rejeter la demande</option>
                </select>
                <label className="command-label">Motif obligatoire (8 caractères minimum)</label>
                <textarea value={qrReason} onChange={e=>setQrReason(e.target.value)} minLength={8} maxLength={500} required />
                <label className="command-label">Confirmation explicite : saisir CONFIRMER</label>
                <input value={qrConfirmation} onChange={e=>setQrConfirmation(e.target.value)} placeholder="CONFIRMER" required />
                <button className="primary-button" type="submit" disabled={commandBusy || !qrTarget}>{commandBusy ? "Traitement…" : "Confirmer la décision QR"} <ShieldCheck size={16}/></button>
              </form>
              <form className="module-panel" onSubmit={submitKioskRevoke}>
                <h3>Révoquer une borne</h3>
                <p>Action sensible : révoque immédiatement le jeton de la borne sélectionnée. La borne sera bloquée jusqu’à une nouvelle activation depuis Aéro Service. Motif et confirmation obligatoires.</p>
                <label className="command-label">Borne active</label>
                <select value={kioskTarget} onChange={e=>setKioskTarget(e.target.value)} required>
                  <option value="">Choisir une borne…</option>
                  {(inventory.kiosk_devices ?? []).filter((x:any)=>!x.revoked_at).map((x:any)=><option key={x.id} value={x.id}>{x.name} · {x.id}</option>)}
                </select>
                <label className="command-label">Motif obligatoire (8 caractères minimum)</label>
                <textarea value={kioskReason} onChange={e=>setKioskReason(e.target.value)} minLength={8} maxLength={500} required />
                <label className="command-label">Confirmation explicite : saisir CONFIRMER</label>
                <input value={kioskConfirmation} onChange={e=>setKioskConfirmation(e.target.value)} placeholder="CONFIRMER" required />
                <button className="primary-button" type="submit" disabled={commandBusy || !kioskTarget}>{commandBusy ? "Révocation…" : "Confirmer la révocation"} <ShieldCheck size={16}/></button>
              </form>
              <div className="lower-grid">
                <article className="panel"><div className="panel-heading"><div><h3>Pointages récents</h3><p>Statut et heure d’arrivée depuis la table journalière</p></div><span className="count-pill">{inventory.daily_attendance.length}</span></div>
                  {inventory.daily_attendance.slice(0,15).map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id}</b><small>{x.local_date} · {x.arrived_at ? new Date(x.arrived_at).toLocaleTimeString("fr-FR") : "Pas d’heure d’arrivée"} · {x.minutes_after_cutoff ?? 0} min après limite</small></div><Status tone={String(x.status).toLowerCase().includes("present")?"good":String(x.status).toLowerCase().includes("late")||String(x.status).toLowerCase().includes("retard")?"warn":"muted"}>{x.status}</Status></div>)}
                  {!inventory.daily_attendance.length && <div className="empty-state">Aucun pointage chargé.</div>}
                </article>
                <article className="panel"><div className="panel-heading"><div><h3>Jours d’ouverture</h3><p>Historique d’ouverture et de fermeture</p></div><span className="count-pill">{inventory.operating_days.length}</span></div>
                  {inventory.operating_days.slice(0,15).map((x:any)=><div className="audit-row" key={x.business_date}><div><b>{x.business_date}</b><small>Ouverture : {x.opened_at ? new Date(x.opened_at).toLocaleString("fr-FR") : "—"} · Fermeture : {x.closed_at ? new Date(x.closed_at).toLocaleString("fr-FR") : "—"}</small></div><Status tone={String(x.status).toLowerCase()==="open"?"good":"muted"}>{x.status}</Status></div>)}
                  {!inventory.operating_days.length && <div className="empty-state">Aucun jour d’ouverture chargé.</div>}
                </article>
              </div>
              <div className="section-title"><div><h2>Autres données reliées</h2><p>Compteurs des données de formation, régularisation et finances.</p></div></div>
              <div className="security-list">
                <div><span>Présences par séance</span><b>{inventory.session_attendance.length}</b></div>
                <div><span>Planning hebdomadaire</span><b>{inventory.weekly_schedule.length}</b></div>
                <div><span>Événements hors ligne à examiner</span><b>{inventory.offline_events.filter((x:any)=>!["approved","rejected","synced"].includes(String(x.review_status).toLowerCase())).length}</b></div>
                <div><span>Justifications d’absence</span><b>{inventory.justifications.length}</b></div>
                <div><span>Règles de pénalité actives</span><b>{inventory.penalty_rules.filter((x:any)=>x.active).length}</b></div>
                <div><span>Paiements avec reçu</span><b>{inventory.payments.filter((x:any)=>Boolean(x.receipt_number)).length}</b></div>
              </div>
            </>}
          </div>}

          {active === "commands" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Commandes propriétaires · TEST uniquement</h3><p>Les données sont lues depuis le projet TEST. Aucune connexion à Aéro Service PROD.</p></div><Status tone="good">2 corrections atomiques actives en TEST</Status></div>
            <div className="notice"><ShieldCheck size={17}/>Consultation des profils, inscriptions, formations et groupes. Deux corrections sont disponibles en TEST : nom affiché du profil et association formation/groupe de l’apprenant. Chaque opération est transactionnelle, exige un motif et une confirmation, et inscrit le avant/après dans le journal d’audit. Les suppressions, changements d’e-mail et mots de passe restent protégés.</div>
            <div className="section-title"><div><h2>Inventaire</h2><p>{inventory ? `${inventory.profiles.length} profils · ${inventory.students.length} apprenants · ${inventory.staff.length} personnel · ${inventory.teachers.length} formateurs · ${inventory.registrations.length} inscriptions` : "Charge les données avant toute intervention."}</p></div><button className="subtle-button" disabled={inventoryLoading} onClick={() => void loadCommandInventory()}>{inventoryLoading ? "Chargement…" : "Charger l’inventaire"} <RefreshCw size={15}/></button></div>
            {inventory && <div className="stats-grid"><article className="stat-card"><div className="stat-top"><span>Profils</span><Users size={18}/></div><strong>{inventory.profiles.length}</strong><small>Jusqu’à 500 profils chargés</small></article><article className="stat-card"><div className="stat-top"><span>Formations</span><Blocks size={18}/></div><strong>{inventory.formations.length}</strong><small>Catalogue TEST</small></article><article className="stat-card"><div className="stat-top"><span>Groupes</span><ClipboardList size={18}/></div><strong>{inventory.groups.length}</strong><small>Groupes TEST</small></article></div>}
            <div className="section-title"><div><h2>INTERVENTION DIRECTE · Recherche et diagnostic</h2><p>Recherche en lecture seule dans les comptes et inscriptions TEST. Aucun changement n'est appliqué depuis cette recherche.</p></div></div>
            <div className="search-field"><Search size={17}/><input value={personSearch} onChange={e => setPersonSearch(e.target.value)} placeholder="Nom, e-mail, numéro apprenant, matricule ou inscription…" disabled={!inventory}/></div>
            {personSearch.trim() && inventory && <div className="audit-list">{matchedProfiles.map((p: any) => {
              const student = inventory.students.find((x: any) => x.id === p.id);
              const staffMember = inventory.staff.find((x: any) => x.id === p.id);
              const teacher = inventory.teachers.find((x: any) => x.id === p.id);
              const regs = inventory.registrations.filter((x: any) => x.person_id === p.id);
              const formation = inventory.formations.find((x: any) => x.id === (student?.formation_id ?? regs[0]?.formation_id));
              const group = inventory.groups.find((x: any) => x.id === (student?.group_id ?? regs[0]?.group_id));
              const kind = student ? "Apprenant" : staffMember ? "Personnel" : teacher ? "Formateur" : "Profil sans fiche métier liée";
              return <div className="audit-row" key={p.id}><div><b>{p.display_name || [p.first_name,p.last_name].filter(Boolean).join(" ") || "Sans nom"} · {kind}</b><small>{p.email || "Sans e-mail"} · {p.public_id || student?.student_number || staffMember?.staff_number || teacher?.teacher_number || p.id}</small><small>Formation : {formation?.name ?? "Non associée"} · Groupe : {group?.name ?? "Non associé"}</small><small>Inscriptions : {regs.length ? regs.map((x: any) => `${x.registration_number} (${x.status})`).join(" · ") : "Aucune inscription retrouvée"}</small></div><Status tone={p.status === "active" ? "good" : "warn"}>{p.status}</Status></div>;
            })}{matchedProfiles.length === 0 && <div className="empty-state"><b>Aucun compte correspondant</b><span>La recherche porte sur les profils et identifiants actuellement chargés en TEST.</span></div>}</div>}
            <form className="module-panel" onSubmit={submitProfileNameChange}>
              <h3>Modifier le nom affiché d’un profil</h3>
              <p>Modification directe et journalisée. Sélectionne soigneusement le bon compte.</p>
              <label className="command-label">Profil cible</label>
              <select value={selectedProfile} onChange={e => { setSelectedProfile(e.target.value); const p=inventory?.profiles.find(x=>x.id===e.target.value); setNewDisplayName(p?.display_name ?? ""); }} disabled={!inventory}>
                <option value="">Choisir un profil…</option>{(inventory?.profiles ?? []).map(p => <option key={p.id} value={p.id}>{p.display_name || "Sans nom"} · {p.email || p.public_id || p.id}</option>)}
              </select>
              <label className="command-label">Nouveau nom affiché</label><input value={newDisplayName} onChange={e=>setNewDisplayName(e.target.value)} maxLength={120} required />
              <label className="command-label">Motif obligatoire (8 caractères minimum)</label><textarea value={changeReason} onChange={e=>setChangeReason(e.target.value)} minLength={8} maxLength={500} required />
              <label className="command-label">Confirmation explicite : saisir CONFIRMER</label><input value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="CONFIRMER" required />
              <button className="primary-button" type="submit" disabled={commandBusy || !inventory}>{commandBusy ? "Traitement…" : "Confirmer la modification"} <ShieldCheck size={16}/></button>
            </form>
            <form className="module-panel" onSubmit={submitStudentAssignmentRepair}>
              <h3>Réparer l’association d’un apprenant</h3>
              <p>Met à jour ensemble la fiche apprenant et sa dernière inscription approuvée. La transaction est annulée entièrement si une étape échoue. Vérifie toujours le dossier et l’inscription avant confirmation.</p>
              <label className="command-label">Apprenant</label>
              <select value={assignmentTarget} onChange={e => setAssignmentTarget(e.target.value)} required>
                <option value="">Choisir un apprenant…</option>
                {(inventory?.students ?? []).map((student: any) => {
                  const profile = inventory?.profiles.find((p: any) => p.id === student.id);
                  return <option key={student.id} value={student.id}>{profile?.display_name || profile?.email || student.student_number || student.id}</option>;
                })}
              </select>
              <label className="command-label">Formation active</label>
              <select value={assignmentFormation} onChange={e => { setAssignmentFormation(e.target.value); setAssignmentGroup(""); }} required>
                <option value="">Choisir une formation…</option>
                {(inventory?.formations ?? []).filter((x: any) => x.status === "active").map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <label className="command-label">Groupe (facultatif)</label>
              <select value={assignmentGroup} onChange={e => setAssignmentGroup(e.target.value)} disabled={!assignmentFormation}>
                <option value="">Aucun groupe</option>
                {(inventory?.groups ?? []).filter((x: any) => x.formation_id === assignmentFormation && x.status === "active").map((x: any) => <option key={x.id} value={x.id}>{x.name} · {x.academic_year}</option>)}
              </select>
              <label className="command-label">Motif obligatoire (8 caractères minimum)</label>
              <textarea value={assignmentReason} onChange={e => setAssignmentReason(e.target.value)} minLength={8} maxLength={500} required />
              <label className="command-label">Confirmation explicite : saisir CONFIRMER</label>
              <input value={assignmentConfirmation} onChange={e => setAssignmentConfirmation(e.target.value)} placeholder="CONFIRMER" required />
              <button className="primary-button" type="submit" disabled={commandBusy || !inventory || !assignmentTarget || !assignmentFormation}>{commandBusy ? "Réparation…" : "Confirmer la réparation" } <ShieldCheck size={16}/></button>
            </form>
            {inventory && <div className="section-title"><div><h2>Catalogue des formations</h2><p>Lecture seule</p></div></div>}
            {inventory?.formations.map(x=><div className="audit-row" key={x.id}><div><b>{x.name}</b><small>{x.code} · {x.duration ?? "Durée non précisée"}</small></div><Status>{x.status}</Status></div>)}
          </div>}

          {active === "supabase" && <div className="module-layout"><div className="panel module-panel"><div className="module-icon"><Database/></div><h2>Supabase</h2><p>Le backend de contrôle est actuellement hébergé temporairement dans le projet Aéro Service TEST. Il ne faut pas le confondre avec Aéro Service PROD.</p><div className="security-list"><div><span>Aéro Service TEST · { "nuijzdqnhjzcnqpfqvvl" }</span><Status tone="good">Hôte temporaire</Status></div><div><span>Projet indépendant du centre</span><Status tone="warn">À créer / migrer</Status></div><div><span>Opérations SQL depuis le centre</span><Status>Pas encore activées</Status></div></div><ProviderLink href="https://supabase.com/dashboard/project/nuijzdqnhjzcnqpfqvvl">Ouvrir Supabase TEST</ProviderLink></div><aside className="panel checklist"><h3>Connexion réelle</h3><div><Status tone="good">Actif</Status><span>API sécurisée du centre</span></div><div><Status tone="good">Actif</Status><span>Registre isolé wdesk_control</span></div><div><Status tone="warn">À faire</Status><span>Inventaire de tous les projets via API</span></div><div><Status tone="warn">À faire</Status><span>Commandes SQL et sauvegardes auditées</span></div></aside></div>}

          {active === "hosting" && <div className="module-layout"><div className="panel module-panel"><div className="module-icon"><Cloud/></div><h2>Vercel</h2><p>Le centre est déployé. Les commandes depuis le tableau de bord ne sont pas encore reliées à l’API Vercel.</p><div className="security-list"><div><span>Projet centre</span><Status tone="good">Déployé</Status></div><div><span>Déploiements / rollback depuis WDESK</span><Status>À intégrer</Status></div><div><span>Variables secrètes depuis WDESK</span><Status>À intégrer</Status></div></div><ProviderLink href="https://vercel.com/wdesk/center-work">Ouvrir Vercel · centre</ProviderLink></div><aside className="panel checklist"><h3>Opérations prévues</h3><div><Status tone="warn">À faire</Status><span>Liste et état des déploiements</span></div><div><Status tone="warn">À faire</Status><span>Logs de build et runtime</span></div><div><Status tone="warn">À faire</Status><span>Domaines et variables d’environnement</span></div><div><Status tone="warn">À faire</Status><span>Redéploiement et retour arrière</span></div></aside></div>}

          {active === "github" && <div className="module-layout"><div className="panel module-panel"><div className="module-icon"><Github/></div><h2>GitHub</h2><p>Le code source du centre est dans le dépôt suivant. Le dépôt Aéro Service est séparé.</p><div className="security-list"><div><span>wdesk07/center-work</span><Status tone="good">Dépôt centre</Status></div><div><span>wdesk07/aeroservice</span><Status tone="warn">Séparé · PROD protégée</Status></div><div><span>Lecture des commits depuis WDESK</span><Status>À intégrer</Status></div><div><span>Édition / workflow depuis WDESK</span><Status>À intégrer</Status></div></div><ProviderLink href="https://github.com/wdesk07/center-work">Ouvrir le dépôt du centre</ProviderLink></div><aside className="panel checklist"><h3>Fonctions prévues</h3><div><Status tone="warn">À faire</Status><span>Branches et commits</span></div><div><Status tone="warn">À faire</Status><span>Statut CI et workflows</span></div><div><Status tone="warn">À faire</Status><span>Diffs et revue avant fusion</span></div></aside></div>}

          {active === "access" && <div className="panel module-panel"><div className="module-icon"><Users/></div><h2>Compte propriétaire</h2><p>Le propriétaire principal est validé par Supabase Auth. Les invitations et rôles d’opérateurs ne sont pas encore exposés dans l’interface.</p><div className="security-list"><div><span>Identité</span><b>{data?.owner?.email ?? "Non retournée"}</b></div><div><span>Rôle</span><b>{data?.owner?.role ?? "Non retourné"}</b></div><div><span>Compte confirmé</span><Status tone={data?.owner ? "good" : "warn"}>{data?.owner ? "Oui" : "À vérifier"}</Status></div></div></div>}

          {active === "audit" && <div className="panel project-panel"><div className="panel-heading"><div><h3>Journal d’audit</h3><p>Journal sécurisé renvoyé par l’API.</p></div><span className="count-pill">{data?.audit_total ?? 0} événements</span></div>{audits.length ? <div className="audit-list">{audits.map(event => <div className="audit-row" key={event.id}><div><b>{event.action}</b><small>{new Date(event.occurred_at).toLocaleString("fr-FR")} · {event.actor_email ?? "Système"} · {event.target_type ?? "—"} · {event.environment}</small><small>{event.details ? JSON.stringify(event.details) : "Détails non fournis par la source"}</small></div><Status tone={event.outcome === "success" ? "good" : event.outcome === "failure" || event.outcome === "denied" ? "warn" : "muted"}>{event.outcome}</Status></div>)}</div> : <div className="empty-state"><div><ClipboardList size={21}/></div><b>Aucun événement disponible</b><span>Le registre n’a renvoyé aucun événement d’audit pour le moment.</span></div>}</div>}

          {active === "settings" && <div className="module-layout"><div className="panel module-panel"><div className="module-icon"><Settings/></div><h2>Connexions sécurisées</h2><p>Les clés privilégiées ne doivent jamais être stockées dans le navigateur. Les connecteurs doivent passer par des routes serveur et des autorisations limitées.</p><div className="security-list"><div><span>Supabase Auth + registre</span><Status tone={data ? "good" : "warn"}>{data ? "Connecté" : "À vérifier"}</Status></div><div><span>API Vercel</span><Status>Jeton serveur dédié requis</Status></div><div><span>API GitHub</span><Status>App / jeton à configurer</Status></div><div><span>Stockage indépendant du centre</span><Status tone="warn">À mettre en place</Status></div></div><button className="primary-button" onClick={() => setNotice("La configuration des clés doit se faire côté serveur. Ne collez aucun jeton secret dans une conversation ou dans le navigateur.")}>Consignes de sécurité <ArrowUpRight size={16}/></button></div><aside className="panel checklist"><h3>Règles obligatoires</h3><div><Status tone="good">Actif</Status><span>Identité propriétaire vérifiée</span></div><div><Status tone="good">Actif</Status><span>Registre isolé et protégé</span></div><div><Status tone="good">Actif</Status><span>Secrets absents du client</span></div><div><Status tone="warn">À faire</Status><span>Connecteurs et permissions minimales</span></div></aside></div>}

          <footer className="footer"><span>WDESK CONTROL CENTER <b>·</b> Fondation v0.2</span><span><i/> {data ? "API connectée · opérations fournisseurs encore limitées" : "Synchronisation requise"}</span></footer>
        </div>
      </section>
    </main>
  );
}
