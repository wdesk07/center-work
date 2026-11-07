"use client";

import { useEffect, useMemo, useState } from "react";
import OwnerOperations from "./owner-operations";
import {
  Activity, ArrowUpRight, Bell, Blocks, Box, BriefcaseBusiness, ChevronDown,
  CircleHelp, Cloud, Code2, Database, Gauge, Github, LockKeyhole, Menu,
  Search, Settings, ShieldCheck, Users, X, RefreshCw, ExternalLink, ClipboardList
} from "lucide-react";

type ModuleKey = "overview" | "production" | "aero" | "diagnostics" | "projects" | "ownerOps" | "commands" | "supabase" | "hosting" | "github" | "access" | "audit" | "settings";
type Project = { id?: string; platform: string; project_name: string; environment: string; external_ref?: string | null; dashboard_url?: string | null; connection_status: string; notes?: string | null; updated_at?: string };
type AuditEvent = { id: number; occurred_at: string; actor_email?: string; action: string; target_type?: string; target_ref?: string; environment: string; outcome: string; details?: Record<string, unknown> };
type DiagnosticCheck = { component: string; check_name: string; count: number; status: string; explanation: string };
type Diagnostics = { checked_at: string; environment: string; source: string; overall: string; checks: DiagnosticCheck[]; daily_attendance_records_today: number; qr_requests_pending_total?: number; limitations: string[] };
type Incident = { id: string; fingerprint: string; component: string; severity: string; status: string; title: string; summary: string; first_seen_at: string; last_seen_at: string; occurrence_count: number; resolved_at?: string | null };
type Dashboard = { owner?: { email: string; display_name: string; role: string }; environment?: string; projects?: Project[]; recent_audit?: AuditEvent[]; audit_total?: number; diagnostics?: Diagnostics; incidents?: Incident[]; capabilities?: { provider_operations?: boolean; diagnostics_read?: boolean; incident_tracking?: boolean } };

const nav: { key: ModuleKey; label: string; icon: typeof Gauge; group: string }[] = [
  { key: "overview", label: "Vue générale", icon: Gauge, group: "ESPACE DE TRAVAIL" },
  { key: "production", label: "Aéro Service PRODUCTION", icon: Database, group: "AÉRO SERVICE" },
  { key: "aero", label: "Borne de présence", icon: ClipboardList, group: "AÉRO SERVICE" },
  { key: "diagnostics", label: "Présences", icon: Activity, group: "AÉRO SERVICE" },
  { key: "projects", label: "Formations et groupes", icon: Blocks, group: "AÉRO SERVICE" },
  { key: "ownerOps", label: "Commandes propriétaires", icon: ShieldCheck, group: "AÉRO SERVICE" },
  { key: "commands", label: "Personnel et Direction", icon: LockKeyhole, group: "AÉRO SERVICE" },
  { key: "supabase", label: "Finances et pénalités", icon: Database, group: "AÉRO SERVICE" },
  { key: "hosting", label: "QR et synchronisation", icon: Cloud, group: "AÉRO SERVICE" },
  { key: "github", label: "Maintenance", icon: Github, group: "SYSTÈME" },
  { key: "access", label: "Utilisateurs", icon: Users, group: "AÉRO SERVICE" },
  { key: "audit", label: "Sécurité et historique", icon: ShieldCheck, group: "SÉCURITÉ" },
  { key: "settings", label: "Paramètres généraux", icon: Settings, group: "SYSTÈME" },
];

const descriptions: Record<ModuleKey, { title: string; intro: string }> = {
  overview: { title: "Vue générale", intro: "Vue réelle du registre WDESK et des connexions actuellement vérifiées." },
  production: { title: "Aéro Service PRODUCTION · lecture seule", intro: "Consultation séparée des données réelles de production. Aucun formulaire ni aucune commande de modification n’est disponible dans cet espace." },
  aero: { title: "Borne de présence", intro: "État des appareils, jours d’ouverture, pointages et demandes de contrôle QR depuis Aéro Service TEST." },
  diagnostics: { title: "Présences", intro: "Suivi des pointages journaliers et par séance, retards, régularisations, justifications et anomalies de synchronisation." },
  projects: { title: "Formations et groupes", intro: "Catalogue des formations, groupes, inscriptions et associations apprenants depuis la base TEST." },
  ownerOps: { title: "Commandes propriétaires", intro: "Gestion contrôlée des formations, groupes, emplois du temps, présences, cours, pénalités, comptes et rôles dans TEST." },
  commands: { title: "Personnel et Direction", intro: "Dossiers des collaborateurs, rôles et interventions propriétaires contrôlées dans l’environnement TEST." },
  supabase: { title: "Finances et pénalités", intro: "Consultation des pénalités, règles, paiements, reçus et soldes à partir des enregistrements TEST." },
  hosting: { title: "QR et synchronisation", intro: "Demandes QR, décisions, événements hors ligne et état de synchronisation des présences." },
  github: { title: "Maintenance", intro: "État des composants, incidents, dépendances techniques et accès aux consoles de diagnostic." },
  access: { title: "Utilisateurs", intro: "Recherche centralisée des comptes Auth, profils, apprenants, collaborateurs, inscriptions et rôles." },
  audit: { title: "Sécurité et historique", intro: "Événements d’audit, décisions, acteurs, motifs et résultats des interventions." },
  settings: { title: "Paramètres généraux", intro: "Connexions, périmètres TEST/PROD, autorisations et réglages de sécurité du centre." },
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
    justifications: any[]; penalties: any[]; penalty_rules: any[]; payments: any[]; roles: any[]; user_roles: any[]; auth_users: any[];
  } | null>(null);
  const [personSearch, setPersonSearch] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [productionInventory, setProductionInventory] = useState<Record<string, any[]> | null>(null);
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionError, setProductionError] = useState("");
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
  const [justificationTarget, setJustificationTarget] = useState("");
  const [justificationDecision, setJustificationDecision] = useState<"approved" | "rejected">("approved");
  const [justificationReason, setJustificationReason] = useState("");
  const [justificationConfirmation, setJustificationConfirmation] = useState("");
  const [registrationTarget, setRegistrationTarget] = useState("");
  const [registrationDecision, setRegistrationDecision] = useState<"approved" | "rejected">("approved");
  const [registrationReason, setRegistrationReason] = useState("");
  const [registrationConfirmation, setRegistrationConfirmation] = useState("");
  const [kioskTarget, setKioskTarget] = useState("");
  const [kioskReason, setKioskReason] = useState("");
  const [kioskConfirmation, setKioskConfirmation] = useState("");
  const [paymentTarget, setPaymentTarget] = useState("");
  const [paymentReason, setPaymentReason] = useState("");
  const [paymentConfirmation, setPaymentConfirmation] = useState("");

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

  async function loadProductionInventory() {
    setProductionLoading(true);
    setProductionError("");
    try {
      const response = await fetch("/api/production", { method: "GET", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "production_readonly_not_configured"
        ? "Connexion PRODUCTION non configurée : les deux variables serveur AERO_PRODUCTION_SUPABASE_URL et AERO_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY sont requises. Aucun accès TEST n’est utilisé comme remplacement."
        : result.error ?? `Lecture PRODUCTION refusée (HTTP ${response.status}).`);
      if (result.environment !== "production" || result.writable !== false || result.read_only !== true || result.project_ref !== "tsyhuuqtbcdpolhmmeri") {
        throw new Error("Réponse refusée : l’environnement PRODUCTION n’a pas passé les contrôles d’identité et de lecture seule.");
      }
      setProductionInventory(result.inventory ?? {});
    } catch (e) {
      setProductionInventory(null);
      setProductionError(e instanceof Error ? e.message : "Impossible de lire Aéro Service PRODUCTION.");
    } finally { setProductionLoading(false); }
  }

  async function loadCommandInventory(showNotice = true) {
    setInventoryLoading(true);
    if (showNotice) setNotice("");
    try {
      const response = await fetch("/api/commands", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Lecture refusée");
      setInventory(result.inventory);
      if (showNotice) setNotice("Inventaire du projet TEST chargé en lecture seule.");
    } catch (e) { if (showNotice) setNotice(e instanceof Error ? e.message : "Impossible de charger l’inventaire."); }
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
      await loadCommandInventory(false);
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
      setNotice(result.audit_warning
        ? "Décision QR appliquée dans Aéro Service TEST, mais la mise à jour du journal WDESK a échoué. Ne répète pas l’action ; vérifie l’historique."
        : qrDecision === "approved"
          ? "Demande QR approuvée par les règles Aéro Service TEST. Vérifie le résultat et toute pénalité éventuelle."
          : "Demande QR rejetée et motif enregistré dans l’historique TEST.");
      setQrTarget(""); setQrReason(""); setQrConfirmation("");
      await loadCommandInventory();
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la décision QR."); }
    finally { setCommandBusy(false); }
  }

  async function submitRegistrationReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registrationTarget || registrationReason.trim().length < 8 || registrationConfirmation !== "CONFIRMER") {
      setNotice("Choisis une inscription en attente, indique le motif et saisis CONFIRMER.");
      return;
    }
    setCommandBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "registration_review", target_id: registrationTarget,
          decision: registrationDecision, reason: registrationReason.trim(),
          confirmation: "CONFIRMER", request_id: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Décision d’inscription refusée");
      setNotice(result.audit_warning
        ? "Décision d’inscription appliquée dans Aéro Service TEST, mais la mise à jour du journal WDESK a échoué. Ne répète pas l’action ; vérifie l’historique."
        : registrationDecision === "approved"
          ? "Inscription approuvée. Le profil est activé et la fiche apprenant est créée ou complétée selon les règles Aéro Service."
          : "Inscription refusée. Le motif est enregistré dans Aéro Service TEST.");
      setRegistrationTarget(""); setRegistrationReason(""); setRegistrationConfirmation("");
      await loadCommandInventory(false);
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la revue d’inscription."); }
    finally { setCommandBusy(false); }
  }

  async function submitAbsenceJustificationReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!justificationTarget || justificationReason.trim().length < 8 || justificationConfirmation !== "CONFIRMER") {
      setNotice("Choisis une justification en attente, indique le motif et saisis CONFIRMER.");
      return;
    }
    setCommandBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "absence_justification_review", target_id: justificationTarget,
          decision: justificationDecision, reason: justificationReason.trim(),
          confirmation: "CONFIRMER", request_id: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Décision de justification refusée");
      setNotice(result.audit_warning
        ? "Décision appliquée dans Aéro Service TEST, mais la mise à jour du journal WDESK a échoué. Ne répète pas l’action ; vérifie l’historique."
        : justificationDecision === "approved"
          ? "Justification approuvée. La présence liée est régularisée si une absence correspondante existe, et l’apprenant est notifié."
          : "Justification refusée. Le commentaire est enregistré et l’apprenant est notifié.");
      setJustificationTarget(""); setJustificationReason(""); setJustificationConfirmation("");
      await loadCommandInventory(false);
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la revue de justification."); }
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
      setNotice(result.audit_warning
        ? "Borne révoquée dans Aéro Service TEST, mais la mise à jour du journal WDESK a échoué. Ne répète pas l’action ; vérifie l’historique."
        : "Borne révoquée dans Aéro Service TEST. Le terminal concerné ne peut plus utiliser son ancien jeton.");
      setKioskTarget(""); setKioskReason(""); setKioskConfirmation("");
      await loadCommandInventory();
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la révocation."); }
    finally { setCommandBusy(false); }
  }

  async function submitPaymentValidation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentTarget || paymentReason.trim().length < 8 || paymentConfirmation !== "CONFIRMER") {
      setNotice("Choisis un paiement en attente, indique le motif et saisis CONFIRMER.");
      return;
    }
    setCommandBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payment_validate", target_id: paymentTarget,
          reason: paymentReason.trim(), confirmation: "CONFIRMER", request_id: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Validation du paiement refusée");
      setNotice(result.audit_warning
        ? "Paiement validé dans Aéro Service TEST, mais la mise à jour du journal WDESK a échoué. Ne répète pas l’action ; vérifie l’historique."
        : `Paiement validé. Reçu : ${result.after?.receipt_number ?? "à vérifier"}.${result.attendance_after?.status === "regularized" ? " La présence liée est régularisée." : ""}`);
      setPaymentTarget(""); setPaymentReason(""); setPaymentConfirmation("");
      await loadCommandInventory();
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Échec de la validation du paiement."); }
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
    const roleText = inventory?.user_roles.filter((x: any) => x.user_id === p.id).map((x: any) => inventory?.roles.find((r: any) => r.id === x.role_id)?.code ?? "").join(" ") ?? "";
    const authUser = inventory?.auth_users.find((x: any) => x.id === p.id);
    const authStateText = authUser ? (authUser.banned_until && new Date(authUser.banned_until).getTime() > Date.now() ? "auth suspendu" : authUser.email_confirmed_at ? "auth confirmé" : "auth non confirmé") : "sans auth auth absent";
    return [p.display_name,p.first_name,p.last_name,p.email,p.public_id,linkedStudent?.student_number,linkedStaff?.staff_number,linkedTeacher?.teacher_number,registrationText,roleText,authUser?.phone,authStateText].some(v => String(v ?? "").toLowerCase().includes(q));
  }).slice(0, 30);

  function choose(key: ModuleKey) {
    setActive(key); setMobileOpen(false); setNotice("");
    if (key === "production") { void loadProductionInventory(); return; }
    if (key !== "overview" && !inventory) void loadCommandInventory(false);
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
          {(["ESPACE DE TRAVAIL", "AÉRO SERVICE", "SÉCURITÉ", "SYSTÈME"] as const).map(group => <div className="nav-group" key={group}><p>{group}</p>{nav.filter(item => item.group === group).map(item => { const Icon = item.icon; return <button key={item.key} className={`nav-link ${active === item.key ? "nav-active" : ""}`} onClick={() => choose(item.key)}><Icon size={17}/><span>{item.label}</span>{item.key === "audit" && audits.length > 0 && <span className="nav-dot"/>}</button>; })}</div>)}
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

          {active === "production" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Aéro Service · PRODUCTION</h3><p>Projet Supabase <b>tsyhuuqtbcdpolhmmeri</b> · données réelles · consultation uniquement.</p></div><Status tone="warn">LECTURE SEULE</Status></div>
            <div className="notice"><ShieldCheck size={17}/>Environnement PRODUCTION isolé. Les actions de création, modification, suppression, validation, suspension et correction sont désactivées ici. Les commandes TEST restent dans leurs modules séparés.</div>
            <div className="section-title"><div><h2>Inventaire de production</h2><p>Chargement direct via la route serveur protégée ; aucun basculement du client Supabase TEST.</p></div><button className="subtle-button" disabled={productionLoading} onClick={() => void loadProductionInventory()}>{productionLoading ? "Lecture…" : "Actualiser la production"} <RefreshCw size={15}/></button></div>
            {productionLoading && <div className="empty-state">Lecture de l’inventaire PRODUCTION…</div>}
            {productionError && <div className="notice"><Activity size={17}/>{productionError}</div>}
            {productionInventory && <>
              <div className="stats-grid">
                {([["Profils","profiles"],["Apprenants","students"],["Personnel","staff"],["Formateurs","teachers"],["Formations","formations"],["Groupes","groups"],["Inscriptions","registrations"],["Pointages","attendance"],["Événements de présence","attendance_events"],["Séances de cours","course_sessions"],["Pénalités","penalties"],["Paiements","payments"]] as const).map(([label,key]) => <article className="stat-card" key={key}><div className="stat-top"><span>{label}</span><Database size={18}/></div><strong>{(productionInventory[key] ?? []).length}</strong><small>Enregistrements chargés · PRODUCTION</small></article>)}
              </div>
              <div className="section-title"><div><h2>Formations et groupes</h2><p>Référentiel réel de production.</p></div></div>
              <div className="audit-list">{(productionInventory.formations ?? []).map((f:any)=><div className="audit-row" key={f.id}><div><b>{f.name}</b><small>{f.code ?? "Sans code"} · {f.duration ?? "Durée non précisée"} · {(productionInventory.groups ?? []).filter((g:any)=>g.formation_id===f.id).length} groupe(s)</small></div><Status tone={f.status==="active"?"good":"muted"}>{f.status ?? "État non précisé"}</Status></div>)}</div>
              <div className="section-title"><div><h2>Pointages récents</h2><p>Table PRODUCTION : attendance (distincte de daily_attendance/session_attendance dans TEST).</p></div><span className="count-pill">{(productionInventory.attendance ?? []).length}</span></div>
              <div className="audit-list">{(productionInventory.attendance ?? []).slice(0,30).map((a:any)=><div className="audit-row" key={a.id}><div><b>{(productionInventory.profiles ?? []).find((p:any)=>p.id===a.person_id)?.display_name ?? a.person_id}</b><small>{a.arrived_at ? new Date(a.arrived_at).toLocaleString("fr-FR") : "Heure d’arrivée non renseignée"} · prévu : {a.planned_at ? new Date(a.planned_at).toLocaleString("fr-FR") : "—"} · retard : {a.delay_minutes ?? 0} min</small><small>Type : {a.person_type ?? "—"} · source : {a.source ?? "—"} · anomalie : {a.anomaly_reason ?? "aucune signalée"}</small></div><Status tone={["present","on_time","regularized"].includes(String(a.status).toLowerCase())?"good":String(a.status).toLowerCase().includes("late")?"warn":"muted"}>{a.status}</Status></div>)}</div>
              <div className="section-title"><div><h2>Appareils de borne</h2><p>Informations non secrètes uniquement ; aucun jeton ni secret appareil n’est exposé.</p></div></div>
              <div className="audit-list">{(productionInventory.kiosk_devices ?? []).map((d:any)=><div className="audit-row" key={d.id}><div><b>{d.name ?? "Borne sans nom"}</b><small>Activée : {d.activated_at ? new Date(d.activated_at).toLocaleString("fr-FR") : "—"} · Dernière utilisation : {d.last_used_at ? new Date(d.last_used_at).toLocaleString("fr-FR") : "—"}</small></div><Status tone={d.revoked_at?"warn":"good"}>{d.revoked_at?"Révoquée":"Non révoquée"}</Status></div>)}</div>
              <div className="section-title"><div><h2>Pénalités et paiements</h2><p>Consultation uniquement ; aucun paiement ne sera validé depuis cet écran.</p></div></div>
              <div className="audit-list">{(productionInventory.penalties ?? []).slice(0,30).map((p:any)=><div className="audit-row" key={p.id}><div><b>{(productionInventory.profiles ?? []).find((x:any)=>x.id===p.person_id)?.display_name ?? p.person_id}</b><small>{p.penalty_type ?? "Pénalité"} · {Number(p.amount_fcfa ?? 0).toLocaleString("fr-FR")} FCFA · {p.description ?? "—"}</small></div><Status>{p.status}</Status></div>)}</div>
              <div className="empty-state">Les données ci-dessus proviennent exclusivement de la base PRODUCTION. Les volumes affichés sont limités par la route serveur (pagination plafonnée) et ne constituent pas un export exhaustif.</div>
            </>}
            {!productionInventory && !productionLoading && !productionError && <div className="empty-state">Aucune donnée PRODUCTION chargée. Lance la lecture ci-dessus.</div>}
          </div>}

          {active === "diagnostics" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Suivi central des présences · TEST</h3><p>Les mêmes identifiants de personne relient les pointages journaliers, les séances, les justifications et les dossiers.</p></div><button className="subtle-button" onClick={() => void loadCommandInventory()}>Actualiser les présences <RefreshCw size={15}/></button></div>
            {inventory ? <>
              <div className="stats-grid">
                <article className="stat-card"><div className="stat-top"><span>Pointages du jour chargé</span><ClipboardList size={18}/></div><strong>{inventory.daily_attendance.filter((x:any)=>x.local_date===new Date().toLocaleDateString("en-CA")).length}</strong><small>Dans les lignes journalières TEST</small></article>
                <article className="stat-card"><div className="stat-top"><span>Retards enregistrés</span><Activity size={18}/></div><strong>{inventory.daily_attendance.filter((x:any)=>String(x.status).toLowerCase().includes("late")||String(x.status).toLowerCase().includes("retard")).length}</strong><small>Historique chargé</small></article>
                <article className="stat-card"><div className="stat-top"><span>Régularisations</span><ShieldCheck size={18}/></div><strong>{inventory.daily_attendance.filter((x:any)=>String(x.status).toLowerCase()==="regularized").length}</strong><small>Statut porté par la source</small></article>
                <article className="stat-card"><div className="stat-top"><span>Justifications</span><ClipboardList size={18}/></div><strong>{inventory.justifications.length}</strong><small>Demandes chargées</small></article>
              </div>
              <div className="audit-list">{inventory.daily_attendance.slice(0,30).map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id}</b><small>{x.local_date} · {x.arrived_at ? new Date(x.arrived_at).toLocaleTimeString("fr-FR") : "Heure non enregistrée"} · {x.minutes_after_cutoff ?? 0} minute(s) après la limite</small></div><Status tone={["present","on_time","regularized"].includes(String(x.status).toLowerCase())?"good":String(x.status).toLowerCase().includes("late")||String(x.status).toLowerCase().includes("retard")?"warn":"muted"}>{x.status}</Status></div>)}</div>
              <form className="module-panel" onSubmit={submitAbsenceJustificationReview}>
                <h3>Traiter une justification d’absence</h3>
                <p>La décision passe par la règle métier Aéro Service TEST. Une approbation régularise l’absence correspondante et envoie une notification. Motif et confirmation obligatoires.</p>
                <label className="command-label">Justification en attente</label>
                <select value={justificationTarget} onChange={e=>setJustificationTarget(e.target.value)} required>
                  <option value="">Choisir une justification…</option>
                  {inventory.justifications.filter((x:any)=>x.status==="pending").map((x:any)=><option key={x.id} value={x.id}>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id} · {x.reason_type ?? "Absence"} · {new Date(x.submitted_at).toLocaleDateString("fr-FR")}</option>)}
                </select>
                <label className="command-label">Décision</label>
                <select value={justificationDecision} onChange={e=>setJustificationDecision(e.target.value as "approved"|"rejected")}>
                  <option value="approved">Approuver et régulariser si possible</option>
                  <option value="rejected">Refuser la justification</option>
                </select>
                <label className="command-label">Motif / commentaire obligatoire</label>
                <textarea value={justificationReason} onChange={e=>setJustificationReason(e.target.value)} minLength={8} maxLength={500} required />
                <label className="command-label">Confirmation explicite : saisir CONFIRMER</label>
                <input value={justificationConfirmation} onChange={e=>setJustificationConfirmation(e.target.value)} placeholder="CONFIRMER" required />
                <button className="primary-button" type="submit" disabled={commandBusy || !justificationTarget}>{commandBusy ? "Traitement…" : "Confirmer la décision"} <ShieldCheck size={16}/></button>
              </form>
              <div className="section-title"><div><h2>Présences par séance</h2><p>Les statuts de séance sont conservés séparément des pointages journaliers.</p></div><span className="count-pill">{inventory.session_attendance.length}</span></div>
              <div className="audit-list">{inventory.session_attendance.slice(0,20).map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id}</b><small>{x.local_date} · {x.source ?? "Source non précisée"} · {x.arrived_at ? new Date(x.arrived_at).toLocaleTimeString("fr-FR") : "—"}</small></div><Status>{x.status}</Status></div>)}</div>
            </> : <div className="empty-state">Charge l’inventaire pour consulter les présences réelles.</div>}
          </div>}

          {active === "projects" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Catalogue formations et groupes · TEST</h3><p>Associations réelles entre formations, groupes, apprenants et inscriptions.</p></div><button className="subtle-button" onClick={() => void loadCommandInventory()}>Actualiser <RefreshCw size={15}/></button></div>
            {inventory ? <>
              <div className="stats-grid"><article className="stat-card"><div className="stat-top"><span>Formations</span><Blocks size={18}/></div><strong>{inventory.formations.length}</strong></article><article className="stat-card"><div className="stat-top"><span>Groupes</span><Users size={18}/></div><strong>{inventory.groups.length}</strong></article><article className="stat-card"><div className="stat-top"><span>Inscriptions</span><ClipboardList size={18}/></div><strong>{inventory.registrations.length}</strong></article><article className="stat-card"><div className="stat-top"><span>Emplois du temps</span><Activity size={18}/></div><strong>{inventory.weekly_schedule.length}</strong></article></div>
              <div className="audit-list">{inventory.formations.map((f:any)=><div className="audit-row" key={f.id}><div><b>{f.name}</b><small>{f.code ?? "Sans code"} · {f.duration ?? "Durée non précisée"} · {inventory.students.filter((s:any)=>s.formation_id===f.id).length} apprenant(s) · {inventory.groups.filter((g:any)=>g.formation_id===f.id).length} groupe(s)</small></div><Status tone={f.status==="active"?"good":"muted"}>{f.status}</Status></div>)}</div>
              <div className="section-title"><div><h2>Groupes existants</h2><p>Les groupes restent liés à leur formation d’origine.</p></div></div>
              <div className="audit-list">{inventory.groups.map((g:any)=><div className="audit-row" key={g.id}><div><b>{g.name}</b><small>{inventory.formations.find((f:any)=>f.id===g.formation_id)?.name ?? "Formation inconnue"} · {g.academic_year ?? "Année non précisée"} · capacité {g.capacity ?? "—"}</small></div><Status>{g.status}</Status></div>)}</div>
            </> : <div className="empty-state">Charge l’inventaire TEST.</div>}
          </div>}

          {active === "ownerOps" && (inventory ? <OwnerOperations inventory={inventory} onRefresh={() => loadCommandInventory(false)} onNotice={setNotice} /> : <div className="empty-state">Chargement de l’inventaire TEST…</div>)}

          {active === "commands" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Personnel et Direction · TEST</h3><p>Fiches collaborateurs, formateurs et rôles sont rapprochés par identifiant de profil.</p></div><button className="subtle-button" onClick={() => void loadCommandInventory()}>Actualiser <RefreshCw size={15}/></button></div>
            {inventory ? <div className="audit-list">{inventory.profiles.filter((p:any)=>inventory.staff.some((s:any)=>s.id===p.id)||inventory.teachers.some((t:any)=>t.id===p.id)||inventory.user_roles.some((r:any)=>["DIRECTOR","PRE_ADMIN","ADMIN","SECRETARY","SECRETARIAT"].includes(String(inventory.roles.find((role:any)=>role.id===r.role_id)?.code ?? "").toUpperCase()))).map((p:any)=>{const s=inventory.staff.find((x:any)=>x.id===p.id);const t=inventory.teachers.find((x:any)=>x.id===p.id);const roles=inventory.user_roles.filter((x:any)=>x.user_id===p.id).map((x:any)=>inventory.roles.find((r:any)=>r.id===x.role_id)?.code).filter(Boolean);return <div className="audit-row" key={p.id}><div><b>{p.display_name ?? p.email ?? p.id}</b><small>{p.email ?? "Sans e-mail"} · {s?.position ?? t?.specialization ?? "Fonction à vérifier"} · {s?.department ?? "Département non renseigné"}</small><small>Matricule : {s?.staff_number ?? t?.teacher_number ?? "Non attribué"} · Rôles : {roles.join(" · ") || "Aucun rôle"}</small></div><Status tone={p.status==="active"?"good":"warn"}>{p.status}</Status></div>})}</div> : <div className="empty-state">Charge l’inventaire TEST.</div>}
          </div>}

          {active === "supabase" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Finances et pénalités · TEST</h3><p>Les pénalités et paiements sont rapprochés avec la personne et le reçu lorsqu’il existe.</p></div><button className="subtle-button" onClick={() => void loadCommandInventory()}>Actualiser <RefreshCw size={15}/></button></div>
            {inventory ? <>
              <div className="stats-grid"><article className="stat-card"><div className="stat-top"><span>Pénalités ouvertes</span><Activity size={18}/></div><strong>{inventory.penalties.filter((x:any)=>!["paid","cancelled","waived","closed"].includes(String(x.status).toLowerCase())).length}</strong><small>{inventory.penalties.filter((x:any)=>!["paid","cancelled","waived","closed"].includes(String(x.status).toLowerCase())).reduce((sum:number,x:any)=>sum+Number(x.amount_fcfa||0),0).toLocaleString("fr-FR")} FCFA</small></article><article className="stat-card"><div className="stat-top"><span>Paiements</span><ShieldCheck size={18}/></div><strong>{inventory.payments.length}</strong><small>{inventory.payments.filter((x:any)=>x.status==="validated").length} validés · {inventory.payments.filter((x:any)=>x.status==="pending").length} en attente</small></article><article className="stat-card"><div className="stat-top"><span>Règles actives</span><ClipboardList size={18}/></div><strong>{inventory.penalty_rules.filter((x:any)=>x.active).length}</strong></article></div>
              <div className="audit-list">{inventory.penalties.map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id}</b><small>{x.penalty_type ?? "Pénalité"} · {Number(x.amount_fcfa).toLocaleString("fr-FR")} FCFA · {x.description ?? "Sans description"}</small></div><Status tone={x.status==="paid"?"good":x.status==="pending"?"warn":"muted"}>{x.status}</Status></div>)}</div>
              <div className="section-title"><div><h2>Paiements et reçus</h2><p>État de validation retourné par Aéro Service TEST.</p></div></div>
              <div className="audit-list">{inventory.payments.map((x:any)=><div className="audit-row" key={x.id}><div><b>{x.receipt_number ?? "Paiement sans reçu"}</b><small>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.payer_name ?? x.person_id} · {Number(x.amount_fcfa).toLocaleString("fr-FR")} FCFA · {x.payment_type ?? "Paiement"}</small></div><Status tone={x.status==="validated"?"good":"warn"}>{x.status}</Status></div>)}</div>
                <form className="module-panel" onSubmit={submitPaymentValidation}>
                  <h3>Valider un paiement en attente</h3>
                  <p>Validation définitive : génère le reçu. Pour un paiement de pénalité, Aéro Service peut également solder la pénalité, régulariser le retard et notifier l’apprenant. Un paiement validé devient immuable.</p>
                  <label className="command-label">Paiement en attente</label>
                  <select value={paymentTarget} onChange={e=>setPaymentTarget(e.target.value)} required>
                    <option value="">Choisir un paiement…</option>
                    {(inventory.payments ?? []).filter((x:any)=>x.status==="pending").map((x:any)=><option key={x.id} value={x.id}>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.payer_name ?? x.person_id} · {Number(x.amount_fcfa).toLocaleString("fr-FR")} FCFA · {x.id}</option>)}
                  </select>
                  <label className="command-label">Motif obligatoire (8 caractères minimum)</label>
                  <textarea value={paymentReason} onChange={e=>setPaymentReason(e.target.value)} minLength={8} maxLength={500} required />
                  <label className="command-label">Confirmation explicite : saisir CONFIRMER</label>
                  <input value={paymentConfirmation} onChange={e=>setPaymentConfirmation(e.target.value)} placeholder="CONFIRMER" required />
                  <button className="primary-button" type="submit" disabled={commandBusy || !paymentTarget}>{commandBusy ? "Validation…" : "Confirmer la validation définitive"} <ShieldCheck size={16}/></button>
                </form>
              <div className="section-title"><div><h2>Règles de pénalité</h2><p>Consultation uniquement : aucune règle n’est modifiée sans contrôle métier dédié.</p></div></div>
              <div className="audit-list">{inventory.penalty_rules.map((x:any)=><div className="audit-row" key={x.id}><div><b>{x.penalty_type} · {Number(x.amount_fcfa).toLocaleString("fr-FR")} FCFA</b><small>{x.description ?? "—"} · {x.min_delay_minutes ?? 0} à {x.max_delay_minutes ?? "∞"} minute(s) · priorité {x.priority}</small></div><Status tone={x.active?"good":"muted"}>{x.active?"Active":"Inactive"}</Status></div>)}</div>
            </> : <div className="empty-state">Charge l’inventaire TEST.</div>}
          </div>}

          {active === "hosting" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>QR et synchronisation · TEST</h3><p>Demandes QR, événements hors ligne et décisions sont visibles dans un même espace.</p></div><button className="subtle-button" onClick={() => void loadCommandInventory()}>Actualiser <RefreshCw size={15}/></button></div>
            {inventory ? <>
              <div className="stats-grid"><article className="stat-card"><div className="stat-top"><span>Demandes QR</span><Activity size={18}/></div><strong>{inventory.qr_requests.length}</strong><small>{inventory.qr_requests.filter((x:any)=>x.status==="pending_confirmation").length} en attente de décision</small></article><article className="stat-card"><div className="stat-top"><span>Événements hors ligne</span><Cloud size={18}/></div><strong>{inventory.offline_events.length}</strong><small>{inventory.offline_events.filter((x:any)=>!["approved","rejected","synced"].includes(String(x.review_status).toLowerCase())).length} à examiner</small></article></div>
              <div className="audit-list">{inventory.qr_requests.map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id}</b><small>{new Date(x.requested_at).toLocaleString("fr-FR")} · {x.rejection_reason ?? "Aucun motif de rejet"}</small></div><Status tone={x.status==="approved"?"good":x.status==="rejected"?"warn":"muted"}>{x.status}</Status></div>)}</div>
              <div className="section-title"><div><h2>Événements à synchroniser ou examiner</h2><p>Une décision de revue n’est pas appliquée automatiquement.</p></div></div>
              <div className="audit-list">{inventory.offline_events.map((x:any)=><div className="audit-row" key={x.id}><div><b>{x.person_name ?? x.person_identifier}</b><small>{new Date(x.observed_at).toLocaleString("fr-FR")} · {x.reason ?? "Aucun motif"} · {x.device_label ?? "Appareil inconnu"}</small></div><Status>{x.review_status}</Status></div>)}</div>
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
            </> : <div className="empty-state">Charge l’inventaire TEST.</div>}
          </div>}

          {active === "github" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Maintenance du centre</h3><p>Diagnostic disponible, état des incidents et limites de surveillance réelles.</p></div><button className="subtle-button" onClick={() => void refresh()}>Relancer le diagnostic <RefreshCw size={15}/></button></div>
            <div className="security-list"><div><span>API du centre</span><Status tone={error?"warn":"good"}>{error?"Erreur":"Réponse reçue"}</Status></div><div><span>Identité propriétaire</span><Status tone={data?.owner?"good":"warn"}>{data?.owner?"Vérifiée":"Non vérifiée"}</Status></div><div><span>Diagnostic opérationnel</span><Status tone={diagnostics?"good":"warn"}>{diagnostics?"Disponible":"Non disponible"}</Status></div><div><span>Incidents ouverts</span><b>{incidents.filter((x:any)=>x.status==="open").length}</b></div><div><span>Déploiement et journaux Vercel</span><Status tone="warn">Pas encore reliés en direct dans cette page</Status></div></div>
            {incidents.map((x:any)=><div className="audit-row" key={x.id}><div><b>{x.title}</b><small>{x.summary} · {x.occurrence_count} détection(s)</small></div><Status tone={x.status==="open"?"warn":"good"}>{x.status}</Status></div>)}
          </div>}

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
                  {inventory.daily_attendance.slice(0,15).map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id}</b><small>{x.local_date} · {x.arrived_at ? new Date(x.arrived_at).toLocaleTimeString("fr-FR") : "Pas d’heure d’arrivée"} · {x.minutes_after_cutoff ?? 0} min après limite</small></div><Status tone={["present","on_time","regularized"].includes(String(x.status).toLowerCase())?"good":String(x.status).toLowerCase().includes("late")||String(x.status).toLowerCase().includes("retard")?"warn":"muted"}>{x.status}</Status></div>)}
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
              <div className="lower-grid">
                <article className="panel"><div className="panel-heading"><div><h3>Planning des cours</h3><p>Séances programmées et associations formation/groupe</p></div><span className="count-pill">{inventory.course_sessions.length}</span></div>
                  {inventory.course_sessions.slice(0,15).map((x:any)=><div className="audit-row" key={x.id}><div><b>{x.subject || "Cours sans matière"}</b><small>{x.session_date} · {x.planned_start}–{x.planned_end} · {inventory.formations.find((f:any)=>f.id===x.formation_id)?.name ?? "Formation inconnue"} · {inventory.groups.find((g:any)=>g.id===x.group_id)?.name ?? "Sans groupe"}</small></div><Status>{x.status}</Status></div>)}
                  {!inventory.course_sessions.length && <div className="empty-state">Aucune séance programmée.</div>}
                </article>
                <article className="panel"><div className="panel-heading"><div><h3>Pénalités et paiements</h3><p>Dernières opérations financières TEST</p></div><span className="count-pill">{inventory.penalties.length + inventory.payments.length}</span></div>
                  {inventory.penalties.slice(0,8).map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id}</b><small>Pénalité · {x.penalty_type} · {Number(x.amount_fcfa).toLocaleString("fr-FR")} FCFA · {x.description ?? "—"}</small></div><Status tone={x.status==="paid"?"good":x.status==="pending"?"warn":"muted"}>{x.status}</Status></div>)}
                  {inventory.payments.slice(0,8).map((x:any)=><div className="audit-row" key={x.id}><div><b>{inventory.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.payer_name ?? x.person_id}</b><small>Paiement · {Number(x.amount_fcfa).toLocaleString("fr-FR")} FCFA · {x.receipt_number ?? "Sans reçu"}</small></div><Status tone={x.status==="validated"?"good":"warn"}>{x.status}</Status></div>)}

                  {!inventory.penalties.length && !inventory.payments.length && <div className="empty-state">Aucune opération financière chargée.</div>}
                </article>
              </div>
            </>}
          </div>}

          {active === "commands" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Commandes propriétaires · TEST uniquement</h3><p>Les données sont lues depuis le projet TEST. Aucune connexion à Aéro Service PROD.</p></div><Status tone="good">7 interventions protégées actives en TEST</Status></div>
            <div className="notice"><ShieldCheck size={17}/>Consultation des comptes, inscriptions, formations, groupes, présences, bornes, QR et finances. Sept interventions protégées sont disponibles : modifier le nom affiché, réparer l’association formation/groupe, approuver ou rejeter une demande QR, traiter une justification d’absence, examiner une inscription et activer un apprenant, révoquer une borne, valider un paiement en attente. Les deux corrections de profil sont transactionnelles ; les opérations QR, borne et paiement utilisent les règles métier Aéro Service. Motif, confirmation et journalisation sont requis. Les suppressions, changements d’e-mail et mots de passe restent protégés.</div>
            <div className="section-title"><div><h2>Inventaire</h2><p>{inventory ? `${inventory.profiles.length} profils · ${inventory.students.length} apprenants · ${inventory.staff.length} personnel · ${inventory.teachers.length} formateurs · ${inventory.registrations.length} inscriptions` : "Charge les données avant toute intervention."}</p></div><button className="subtle-button" disabled={inventoryLoading} onClick={() => void loadCommandInventory()}>{inventoryLoading ? "Chargement…" : "Charger l’inventaire"} <RefreshCw size={15}/></button></div>
            {inventory && <div className="stats-grid"><article className="stat-card"><div className="stat-top"><span>Profils</span><Users size={18}/></div><strong>{inventory.profiles.length}</strong><small>Jusqu’à 500 profils chargés</small></article><article className="stat-card"><div className="stat-top"><span>Formations</span><Blocks size={18}/></div><strong>{inventory.formations.length}</strong><small>Catalogue TEST</small></article><article className="stat-card"><div className="stat-top"><span>Groupes</span><ClipboardList size={18}/></div><strong>{inventory.groups.length}</strong><small>Groupes TEST</small></article></div>}
            <div className="section-title"><div><h2>INTERVENTION DIRECTE · Recherche et diagnostic</h2><p>Recherche en lecture seule dans les comptes et inscriptions TEST. Aucun changement n'est appliqué depuis cette recherche.</p></div></div>
            <div className="search-field"><Search size={17}/><input value={personSearch} onChange={e => setPersonSearch(e.target.value)} placeholder="Nom, e-mail, numéro apprenant, matricule ou inscription…" disabled={!inventory}/></div>
            {personSearch.trim() && inventory && <div className="audit-list">{matchedProfiles.map((p: any) => {
              const student = inventory.students.find((x: any) => x.id === p.id);
              const staffMember = inventory.staff.find((x: any) => x.id === p.id);
              const teacher = inventory.teachers.find((x: any) => x.id === p.id);
              const regs = inventory.registrations.filter((x: any) => x.person_id === p.id);
              const roles = inventory.user_roles.filter((x: any) => x.user_id === p.id).map((x: any) => inventory.roles.find((r: any) => r.id === x.role_id)?.code).filter(Boolean);
              const authUser = inventory.auth_users.find((x: any) => x.id === p.id);
              const formation = inventory.formations.find((x: any) => x.id === (student?.formation_id ?? regs[0]?.formation_id));
              const group = inventory.groups.find((x: any) => x.id === (student?.group_id ?? regs[0]?.group_id));
              const personDaily = inventory.daily_attendance.filter((x: any) => x.person_id === p.id);
              const personSessions = inventory.session_attendance.filter((x: any) => x.person_id === p.id);
              const personPenalties = inventory.penalties.filter((x: any) => x.person_id === p.id);
              const personPayments = inventory.payments.filter((x: any) => x.person_id === p.id);
              const personQr = inventory.qr_requests.filter((x: any) => x.person_id === p.id);
              const openPenalties = personPenalties.filter((x: any) => !["paid","cancelled","waived","closed"].includes(String(x.status).toLowerCase()));
              const pendingPayments = personPayments.filter((x: any) => ["pending","submitted","received"].includes(String(x.status).toLowerCase()) && !x.validated_at);
              const kind = student ? "Apprenant" : teacher || roles.some((r:any)=>["TEACHER","ENSEIGNANT"].includes(String(r).toUpperCase())) ? "Formateur" : staffMember || roles.some((r:any)=>["STAFF","PERSONNEL"].includes(String(r).toUpperCase())) ? "Personnel" : roles.some((r:any)=>["DIRECTOR","ADMIN","PRE_ADMIN"].includes(String(r).toUpperCase())) ? "Direction" : roles.some((r:any)=>["SECRETARIAT","SECRETARY","SECRETAIRE","SECRÉTAIRE"].includes(String(r).toUpperCase())) ? "Secrétariat" : "Profil sans fiche métier liée";
              return <div className="audit-row" key={p.id}><div><b>{p.display_name || [p.first_name,p.last_name].filter(Boolean).join(" ") || "Sans nom"} · {kind}</b><small>{p.email || "Sans e-mail"} · {p.public_id || student?.student_number || staffMember?.staff_number || teacher?.teacher_number || p.id}</small><small>Formation : {formation?.name ?? "Non associée"} · Groupe : {group?.name ?? "Non associé"}</small><small>Inscriptions : {regs.length ? regs.map((x: any) => `${x.registration_number} (${x.status})`).join(" · ") : "Aucune inscription retrouvée"}</small>
                <small>Présences : {personDaily.length} journalières · {personSessions.length} par séance · derniers statuts : {[...personDaily].slice(0,3).map((x: any) => `${x.local_date} ${x.status}`).join(" / ") || "Aucun pointage"}</small>
                <small>Pénalités : {personPenalties.length} au total · {openPenalties.length} ouvertes · {openPenalties.reduce((sum: number, x: any) => sum + Number(x.amount_fcfa || 0), 0).toLocaleString("fr-FR")} FCFA restant sur les pénalités ouvertes</small>
                <small>Paiements : {personPayments.length} opérations · {pendingPayments.length} en attente · reçus : {personPayments.filter((x: any) => Boolean(x.receipt_number)).length}</small>
                <small>Demandes QR : {personQr.length} · {personQr.filter((x: any) => ["pending","submitted","requested","pending_confirmation"].includes(String(x.status).toLowerCase())).length} en attente</small>
                <small>Rôles : {roles.length ? roles.join(" · ") : "Aucun rôle attribué"}</small>
                <small>Compte Auth : {authUser ? (authUser.banned_until && new Date(authUser.banned_until).getTime() > Date.now() ? "Suspendu" : authUser.email_confirmed_at ? "Confirmé" : "E-mail non confirmé") : "Absent"} · Téléphone : {authUser?.phone || "Non renseigné"} · Dernière connexion : {authUser?.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString("fr-FR") : "Jamais / inconnue"}</small></div><Status tone={p.status === "active" ? "good" : "warn"}>{p.status}</Status></div>;
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

          {active === "access" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Utilisateurs et accès · Aéro Service TEST</h3><p>Comptes, profils métier, inscriptions et rôles réels. Les modifications d’accès restent protégées tant que leurs workflows ne sont pas validés.</p></div><Status tone="good">Lecture réelle</Status></div>
            <form className="module-panel" onSubmit={submitRegistrationReview}>
              <h3>Examiner une inscription et activer un apprenant</h3>
              <p>L’approbation utilise la fonction métier Aéro Service : elle valide l’inscription, active le profil, attribue le rôle apprenant et prépare sa fiche. Le refus conserve le commentaire. Les deux décisions exigent un motif et une confirmation.</p>
              <label className="command-label">Inscription en attente</label>
              <select value={registrationTarget} onChange={e=>setRegistrationTarget(e.target.value)} required>
                <option value="">Choisir une inscription…</option>
                {(inventory?.registrations ?? []).filter((x:any)=>x.status==="pending").map((x:any)=><option key={x.id} value={x.id}>{x.registration_number ?? x.id} · {inventory?.profiles.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id} · {inventory?.formations.find((f:any)=>f.id===x.formation_id)?.name ?? "Formation inconnue"}</option>)}
              </select>
              <label className="command-label">Décision</label>
              <select value={registrationDecision} onChange={e=>setRegistrationDecision(e.target.value as "approved"|"rejected")}>
                <option value="approved">Approuver et activer</option>
                <option value="rejected">Refuser l’inscription</option>
              </select>
              <label className="command-label">Motif / commentaire obligatoire</label>
              <textarea value={registrationReason} onChange={e=>setRegistrationReason(e.target.value)} minLength={8} maxLength={500} required />
              <label className="command-label">Confirmation explicite : saisir CONFIRMER</label>
              <input value={registrationConfirmation} onChange={e=>setRegistrationConfirmation(e.target.value)} placeholder="CONFIRMER" required />
              <button className="primary-button" type="submit" disabled={commandBusy || !registrationTarget}>{commandBusy ? "Traitement…" : "Confirmer la décision d’inscription"} <ShieldCheck size={16}/></button>
            </form>
            <div className="security-list">
              <div><span>Propriétaire WDESK</span><b>{data?.owner?.email ?? "Non retourné"}</b></div>
              <div><span>Rôle propriétaire WDESK</span><b>{data?.owner?.role ?? "Non retourné"}</b></div>
              <div><span>Profils chargés</span><b>{inventory ? inventory.profiles.length : "—"}</b></div>
              <div><span>Apprenants / Personnel / Formateurs</span><b>{inventory ? `${inventory.students.length} / ${inventory.staff.length} / ${inventory.teachers.length}` : "—"}</b></div>
              <div><span>Profils sans compte Auth</span><b>{inventory ? inventory.profiles.filter((p:any)=>!inventory.auth_users.some((u:any)=>u.id===p.id)).length : "—"}</b></div>
              <div><span>Dont profils actifs / en attente sans Auth</span><b>{inventory ? `${inventory.profiles.filter((p:any)=>p.status==="active"&&!inventory.auth_users.some((u:any)=>u.id===p.id)).length} / ${inventory.profiles.filter((p:any)=>p.status==="pending"&&!inventory.auth_users.some((u:any)=>u.id===p.id)).length}` : "—"}</b></div>
              <div><span>Comptes Auth sans profil</span><b>{inventory ? inventory.auth_users.filter((u:any)=>!inventory.profiles.some((p:any)=>p.id===u.id)).length : "—"}</b></div>
              <div><span>E-mails confirmés / téléphones renseignés</span><b>{inventory ? `${inventory.auth_users.filter((u:any)=>Boolean(u.email_confirmed_at)).length} / ${inventory.auth_users.filter((u:any)=>Boolean(u.phone)).length}` : "—"}</b></div>
            </div>
            <div className="section-title"><div><h2>Recherche de comptes</h2><p>Nom, e-mail, matricule, numéro d’inscription ou rôle.</p></div><button className="subtle-button" disabled={inventoryLoading} onClick={() => void loadCommandInventory()}>{inventoryLoading ? "Chargement…" : "Charger les comptes"} <RefreshCw size={15}/></button></div>
            <div className="search-field"><Search size={17}/><input value={personSearch} onChange={e=>setPersonSearch(e.target.value)} placeholder="Nom, e-mail, matricule, rôle ou « sans auth »…" disabled={!inventory}/></div>
            {personSearch.trim() && inventory && <div className="audit-list">{matchedProfiles.map((p:any)=>{
              const student=inventory.students.find((x:any)=>x.id===p.id);
              const staffMember=inventory.staff.find((x:any)=>x.id===p.id);
              const teacher=inventory.teachers.find((x:any)=>x.id===p.id);
              const regs=inventory.registrations.filter((x:any)=>x.person_id===p.id);
              const roleNames=inventory.user_roles.filter((x:any)=>x.user_id===p.id).map((x:any)=>inventory.roles.find((r:any)=>r.id===x.role_id)?.code).filter(Boolean);
              const authUser=inventory.auth_users.find((x:any)=>x.id===p.id);
              const formation=inventory.formations.find((x:any)=>x.id===(student?.formation_id??regs[0]?.formation_id));
              const group=inventory.groups.find((x:any)=>x.id===(student?.group_id??regs[0]?.group_id));
              const kind=student?"Apprenant":teacher||roleNames.some((r:any)=>["TEACHER","ENSEIGNANT"].includes(String(r).toUpperCase()))?"Formateur":staffMember||roleNames.some((r:any)=>["STAFF","PERSONNEL"].includes(String(r).toUpperCase()))?"Personnel":roleNames.some((r:any)=>["DIRECTOR","ADMIN","PRE_ADMIN"].includes(String(r).toUpperCase()))?"Direction":roleNames.some((r:any)=>["SECRETARIAT","SECRETARY","SECRETAIRE","SECRÉTAIRE"].includes(String(r).toUpperCase()))?"Secrétariat":"Profil sans fiche métier liée";
              return <div className="audit-row" key={p.id}><div><b>{p.display_name||[p.first_name,p.last_name].filter(Boolean).join(" ")||"Sans nom"} · {kind}</b><small>{p.email||"Sans e-mail"} · {p.public_id||student?.student_number||staffMember?.staff_number||teacher?.teacher_number||p.id}</small><small>Rôles : {roleNames.length?roleNames.join(" · "):"Aucun rôle attribué"} · Statut : {p.status}</small>
                <small>Compte Auth : {authUser?(authUser.banned_until&&new Date(authUser.banned_until).getTime()>Date.now()?"Suspendu":authUser.email_confirmed_at?"Confirmé":"E-mail non confirmé"):"Absent"} · Téléphone : {authUser?.phone||"Non renseigné"} · Dernière connexion : {authUser?.last_sign_in_at?new Date(authUser.last_sign_in_at).toLocaleString("fr-FR"):"Jamais / inconnue"}</small><small>Formation : {formation?.name??"Non associée"} · Groupe : {group?.name??"Non associé"}</small><small>Inscriptions : {regs.length?regs.map((x:any)=>`${x.registration_number} (${x.status})`).join(" · "):"Aucune inscription retrouvée"}</small></div><Status tone={p.status==="active"?"good":"warn"}>{p.status}</Status></div>;
            })}{matchedProfiles.length===0&&<div className="empty-state"><b>Aucun compte correspondant</b><span>Vérifie le terme de recherche ou recharge l’inventaire TEST.</span></div>}</div>}
            {inventory && inventory.auth_users.some((u:any)=>!inventory.profiles.some((p:any)=>p.id===u.id)) && <article className="panel"><div className="panel-heading"><div><h3>Comptes Auth sans profil métier</h3><p>Comptes authentifiés qui n’ont pas de fiche dans profiles.</p></div><Status tone="warn">{inventory.auth_users.filter((u:any)=>!inventory.profiles.some((p:any)=>p.id===u.id)).length} à examiner</Status></div>
              {inventory.auth_users.filter((u:any)=>!inventory.profiles.some((p:any)=>p.id===u.id)).map((u:any)=><div className="audit-row" key={u.id}><div><b>{u.email ?? u.id}</b><small>{u.email_confirmed_at?"E-mail confirmé":"E-mail non confirmé"} · Dernière connexion : {u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString("fr-FR"):"Jamais / inconnue"}</small><small>ID Auth : {u.id}</small></div><Status tone={u.banned_until&&new Date(u.banned_until).getTime()>Date.now()?"warn":"muted"}>{u.banned_until&&new Date(u.banned_until).getTime()>Date.now()?"Suspendu":"Sans profil"}</Status></div>)}
            </article>}
            {!inventory && <div className="empty-state"><b>Inventaire non chargé</b><span>Charge les comptes pour consulter les profils et rôles réels.</span></div>}
          </div>}

          {active === "audit" && <div className="panel project-panel"><div className="panel-heading"><div><h3>Journal d’audit</h3><p>Journal sécurisé renvoyé par l’API.</p></div><span className="count-pill">{data?.audit_total ?? 0} événements</span></div>{audits.length ? <div className="audit-list">{audits.map(event => <div className="audit-row" key={event.id}><div><b>{event.action}</b><small>{new Date(event.occurred_at).toLocaleString("fr-FR")} · {event.actor_email ?? "Système"} · {event.target_type ?? "—"} · {event.environment}</small><small>{event.details ? JSON.stringify(event.details) : "Détails non fournis par la source"}</small></div><Status tone={event.outcome === "success" ? "good" : event.outcome === "failure" || event.outcome === "denied" ? "warn" : "muted"}>{event.outcome}</Status></div>)}</div> : <div className="empty-state"><div><ClipboardList size={21}/></div><b>Aucun événement disponible</b><span>Le registre n’a renvoyé aucun événement d’audit pour le moment.</span></div>}</div>}

          {active === "settings" && <div className="module-layout"><div className="panel module-panel"><div className="module-icon"><Settings/></div><h2>Connexions sécurisées</h2><p>Les clés privilégiées ne doivent jamais être stockées dans le navigateur. Les connecteurs doivent passer par des routes serveur et des autorisations limitées.</p><div className="security-list"><div><span>Supabase Auth + registre</span><Status tone={data ? "good" : "warn"}>{data ? "Connecté" : "À vérifier"}</Status></div><div><span>API Vercel</span><Status>Jeton serveur dédié requis</Status></div><div><span>API GitHub</span><Status>App / jeton à configurer</Status></div><div><span>Stockage indépendant du centre</span><Status tone="warn">À mettre en place</Status></div></div><button className="primary-button" onClick={() => setNotice("La configuration des clés doit se faire côté serveur. Ne collez aucun jeton secret dans une conversation ou dans le navigateur.")}>Consignes de sécurité <ArrowUpRight size={16}/></button></div><aside className="panel checklist"><h3>Règles obligatoires</h3><div><Status tone="good">Actif</Status><span>Identité propriétaire vérifiée</span></div><div><Status tone="good">Actif</Status><span>Registre isolé et protégé</span></div><div><Status tone="good">Actif</Status><span>Secrets absents du client</span></div><div><Status tone="warn">À faire</Status><span>Connecteurs et permissions minimales</span></div></aside></div>}

          <footer className="footer"><span>WDESK CONTROL CENTER <b>·</b> Fondation v0.2</span><span><i/> {data ? "API connectée · opérations fournisseurs encore limitées" : "Synchronisation requise"}</span></footer>
        </div>
      </section>
    </main>
  );
}
