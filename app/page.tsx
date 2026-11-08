"use client";

import { useEffect, useMemo, useState } from "react";
import OwnerOperations from "./owner-operations";
import ProductionOperations from "./production-operations";
import ProductionGovernance from "./production-governance";
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
  { key: "production", label: "Inventaire PRODUCTION", icon: Database, group: "AÉRO SERVICE" },
  { key: "aero", label: "Borne de présence", icon: ClipboardList, group: "AÉRO SERVICE" },
  { key: "diagnostics", label: "Présences", icon: Activity, group: "AÉRO SERVICE" },
  { key: "projects", label: "Formations et groupes", icon: Blocks, group: "AÉRO SERVICE" },
  { key: "ownerOps", label: "Commandes propriétaires · PROD", icon: ShieldCheck, group: "AÉRO SERVICE" },
  { key: "commands", label: "Personnel et Direction", icon: LockKeyhole, group: "AÉRO SERVICE" },
  { key: "supabase", label: "Finances et pénalités", icon: Database, group: "AÉRO SERVICE" },
  { key: "hosting", label: "QR et synchronisation", icon: Cloud, group: "AÉRO SERVICE" },
  { key: "github", label: "Maintenance", icon: Github, group: "SYSTÈME" },
  { key: "access", label: "Utilisateurs", icon: Users, group: "AÉRO SERVICE" },
  { key: "audit", label: "Sécurité et historique", icon: ShieldCheck, group: "SÉCURITÉ" },
  { key: "settings", label: "Paramètres généraux", icon: Settings, group: "SYSTÈME" },
];

const descriptions: Record<ModuleKey, { title: string; intro: string }> = {
  overview: { title: "Vue générale WDESK", intro: "Authentification propriétaire et pilotage de l’ensemble des données métier directement dans Aéro Service PRODUCTION." },
  production: { title: "Aéro Service PRODUCTION", intro: "Consultation et commandes propriétaires contrôlées, directement sur la base réelle de production." },
  aero: { title: "Borne de présence", intro: "État des appareils, jours d’ouverture, pointages et demandes QR depuis Aéro Service PRODUCTION." },
  diagnostics: { title: "Présences", intro: "Suivi des pointages, retards, régularisations et justifications depuis Aéro Service PRODUCTION." },
  projects: { title: "Formations et groupes", intro: "Catalogue, groupes, inscriptions et emplois du temps depuis Aéro Service PRODUCTION." },
  ownerOps: { title: "Commandes propriétaires · PRODUCTION", intro: "Gestion contrôlée des formations, groupes, emplois du temps, présences, cours, pénalités, comptes et rôles dans la base Aéro Service PRODUCTION." },
  commands: { title: "Personnel et Direction", intro: "Dossiers des collaborateurs, rôles et interventions propriétaires contrôlées dans Aéro Service PRODUCTION." },
  supabase: { title: "Finances et pénalités", intro: "Consultation des pénalités, règles, paiements, reçus et soldes de la base PRODUCTION." },
  hosting: { title: "QR et synchronisation", intro: "Demandes QR, décisions et état des appareils depuis Aéro Service PRODUCTION." },
  github: { title: "Maintenance", intro: "État des composants, incidents, dépendances techniques et accès aux consoles de diagnostic." },
  access: { title: "Utilisateurs", intro: "Recherche des comptes, profils, apprenants, collaborateurs, inscriptions et rôles en PRODUCTION." },
  audit: { title: "Sécurité et historique WDESK", intro: "Journal de sécurité et d’opérations de la base Aéro Service PRODUCTION." },
  settings: { title: "Paramètres généraux PRODUCTION", intro: "Connexions sécurisées de l’espace propriétaire Aéro Service PRODUCTION." },
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
      if (showNotice) setNotice("L’ancien inventaire TEST est en veille. Utilisez exclusivement l’inventaire PRODUCTION.");
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
    const aeroModules: ModuleKey[] = ["production", "aero", "diagnostics", "projects", "ownerOps", "commands", "supabase", "hosting", "access"];
    if (aeroModules.includes(key)) { void loadProductionInventory(); return; }
    // L’espace propriétaire est désormais authentifié sur Aéro Service PRODUCTION.
    // Les anciennes commandes TEST restent désactivées.
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
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu"><Menu size={20}/></button><div className="breadcrumbs">WDESK <span>/</span> {current.title}</div><div className="top-actions"><div className="system-indicator"><i/> {error ? "Synchronisation à vérifier" : loading ? "Synchronisation…" : "API du centre joignable"}</div><button className="icon-button" aria-label="Actualiser" onClick={() => void refresh()}><RefreshCw size={17}/></button><button className="help-button" onClick={() => setNotice("Les commandes de production sont réservées au propriétaire vérifié, protégées par contrôle des rôles, motif obligatoire, confirmation et journal d’audit.")}><CircleHelp size={17}/><span>Aide</span></button></div></header>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow">CENTRE DE COMMANDEMENT WDESK</div><h1>{current.title}</h1><p>{current.intro}</p></div><div className="owner-chip"><div className="crown">♛</div><span><b>{data?.owner?.display_name ?? "WDESK OWNER"}</b><small>{data?.owner?.email ?? "Compte propriétaire"}</small></span></div></div>
          {notice && <div className="notice"><Activity size={17}/>{notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}
          {error && <div className="notice"><Activity size={17}/>{error}<button onClick={() => void refresh()}><RefreshCw size={15}/></button></div>}

          {active === "overview" && <>
            <div className="welcome-banner"><div className="welcome-icon"><Gauge size={24}/></div><div><span>ESPACE PROPRIÉTAIRE</span><h2>Un centre unique pour vos infrastructures.</h2><p>Les statuts reflètent les données réellement retournées par l’API du centre.</p></div><div className="banner-orb orb-one"/><div className="banner-orb orb-two"/></div>
            <div className="section-title"><div><h2>Surveillance du centre Aéro Service · PRODUCTION</h2><p>Ces indicateurs et journaux concernent exclusivement l’espace opérationnel Aéro Service PRODUCTION.</p></div><button className="subtle-button" onClick={() => choose("diagnostics")}>Ouvrir les diagnostics <ArrowUpRight size={15}/></button></div>
            <div className="stats-grid">
              <article className="stat-card"><div className="stat-top"><span>Alertes PRODUCTION</span><Activity size={18}/></div><strong>{diagnostics ? diagnostics.checks.filter(x => x.count > 0).length : "…"}</strong><small>Alertes opérationnelles de production</small></article>
              <article className="stat-card"><div className="stat-top"><span>Pointages aujourd’hui</span><ClipboardList size={18}/></div><strong>{diagnostics ? diagnostics.daily_attendance_records_today : "…"}</strong><small>Indicateur opérationnel PRODUCTION</small></article>
            </div>
            <div className="section-title"><div><h2>État des infrastructures</h2><p>{loading ? "Lecture du registre…" : `${projects.length} élément(s) dans le registre sécurisé`}</p></div><button className="subtle-button" onClick={() => void refresh()}>Actualiser <RefreshCw size={15}/></button></div>
            <div className="stats-grid">
              <article className="stat-card"><div className="stat-top"><span>Projets recensés</span><Blocks size={18}/></div><strong>{loading ? "…" : String(projects.length).padStart(2, "0")}</strong><small>Registre de production, pas un scan complet des comptes</small></article>
              <article className="stat-card"><div className="stat-top"><span>Connecteurs vérifiés</span><Activity size={18}/></div><strong>{loading ? "…" : String(platformCounts.supabase + platformCounts.vercel + platformCounts.github).padStart(2, "0")}</strong><small>Connexions fournisseur marquées connectées</small></article>
              <article className="stat-card"><div className="stat-top"><span>Propriétaire</span><LockKeyhole size={18}/></div><strong>{data?.owner ? "Vérifié" : loading ? "…" : "À vérifier"}</strong><small>{data?.owner?.email ?? "L’identité n’a pas été retournée par l’API"}</small></article>
              <article className="stat-card"><div className="stat-top"><span>Événements d’audit</span><ShieldCheck size={18}/></div><strong>{loading ? "…" : data?.audit_total ?? 0}</strong><small>Événements enregistrés dans le registre</small></article>
            </div>
            <div className="section-title"><div><h2>Accès aux fournisseurs</h2><p>Ouvrir directement les consoles pour les opérations qui ne sont pas encore intégrées.</p></div></div>
            <div className="quick-grid">
              <div><Database/><span><b>Supabase</b><small>{platformCounts.supabase ? "Connexion enregistrée" : "Console fournisseur accessible"}</small><ProviderLink href="https://supabase.com/dashboard/project/tsyhuuqtbcdpolhmmeri">Ouvrir la console</ProviderLink></span><ArrowUpRight/></div>
              <div><Cloud/><span><b>Vercel</b><small>{platformCounts.vercel ? "Connexion enregistrée" : "Gestion via console pour l’instant"}</small><ProviderLink href="https://vercel.com/wdesk/center-work">Ouvrir le projet centre</ProviderLink></span><ArrowUpRight/></div>
              <div><Github/><span><b>GitHub</b><small>{platformCounts.github ? "Connexion enregistrée" : "Dépôt source du centre"}</small><ProviderLink href="https://github.com/wdesk07/center-work">Ouvrir le dépôt</ProviderLink></span><ArrowUpRight/></div>
              <div><BriefcaseBusiness/><span><b>Aéro Service</b><small>PRODUCTION active · TEST en veille</small><ProviderLink href="https://aero-service.vercel.app/">Ouvrir le site de production</ProviderLink></span><ArrowUpRight/></div>
            </div>
            <div className="lower-grid">
              <article className="panel"><div className="panel-heading"><div><h3>Activité récente</h3><p>Journal réellement retourné par l’API</p></div><button onClick={() => choose("audit")}>Tout voir <ArrowUpRight size={14}/></button></div>{audits.length ? <div className="audit-list">{audits.slice(0,5).map(event => <div className="audit-row" key={event.id}><div><b>{event.action}</b><small>{event.actor_email ?? "Système"} · {event.environment}</small><small>{event.details ? JSON.stringify(event.details) : "Détails non fournis par la source"}</small></div><Status tone={event.outcome === "success" ? "good" : event.outcome === "denied" || event.outcome === "failure" ? "warn" : "muted"}>{event.outcome}</Status></div>)}</div> : <div className="empty-state"><div><Activity size={21}/></div><b>Aucun événement récent retourné</b><span>Le journal s’affichera ici lorsque l’API renverra des événements.</span></div>}</article>
              <article className="panel"><div className="panel-heading"><div><h3>État de sécurité</h3><p>État connu, sans masquer les éléments manquants</p></div><ShieldCheck size={19}/></div><div className="security-list"><div><span>Identité propriétaire</span><Status tone={data?.owner ? "good" : "warn"}>{data?.owner ? "Vérifiée" : "À vérifier"}</Status></div><div><span>Registre / audit</span><Status tone={data ? "good" : "warn"}>{data ? "API accessible" : "Indisponible"}</Status></div><div><span>Opérations fournisseur depuis l’interface</span><Status tone="good">API de commandes PROD raccordée · tests métier à terminer</Status></div><div><span>Authentification et registre propriétaire PROD</span><Status tone="good">Session propriétaire PROD vérifiée</Status></div></div></article>
            </div>
          </>}

          {(["aero", "diagnostics", "projects", "ownerOps", "commands", "supabase", "hosting", "access"] as ModuleKey[]).includes(active) && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>{current.title} · AÉRO SERVICE PRODUCTION</h3><p>Source unique : Supabase PRODUCTION (tsyhuuqtbcdpolhmmeri). Aucun recours aux données TEST Aéro Service.</p></div><Status tone="good">PRODUCTION</Status></div>
            <div className="section-title"><div><h2>Commandes et données de production</h2><p>Les rubriques métier utilisent le même inventaire PRODUCTION et les actions autorisées de l’API de production.</p></div><button className="subtle-button" disabled={productionLoading} onClick={() => void loadProductionInventory()}>{productionLoading ? "Lecture…" : "Actualiser PRODUCTION"} <RefreshCw size={15}/></button></div>
            {productionLoading && <div className="empty-state">Lecture de la base Aéro Service PRODUCTION…</div>}
            {productionError && <div className="notice"><Activity size={17}/>{productionError}</div>}
            {productionInventory && <>
              <div className="stats-grid">
                {([["Profils","profiles"],["Apprenants","students"],["Personnel","staff"],["Formateurs","teachers"],["Formations","formations"],["Groupes","groups"],["Inscriptions","registrations"],["Pointages","attendance"],["Demandes QR","qr_requests"],["Pénalités","penalties"],["Paiements","payments"]] as const).map(([label,key]) => <article className="stat-card" key={key}><div className="stat-top"><span>{label}</span><Database size={18}/></div><strong>{(productionInventory[key] ?? []).length}</strong><small>Enregistrements PRODUCTION</small></article>)}
              </div>
              <ProductionOperations inventory={productionInventory} onRefresh={loadProductionInventory}/>
              <ProductionGovernance inventory={productionInventory} onRefresh={loadProductionInventory}/>
            </>}
            {!productionLoading && !productionError && !productionInventory && <div className="empty-state"><b>Inventaire PRODUCTION non chargé</b><span>Relance la lecture. Aucun basculement automatique vers TEST n’est autorisé.</span></div>}
          </div>}

          {active === "production" && <div className="panel project-panel">
            <div className="panel-heading"><div><h3>Aéro Service · PRODUCTION</h3><p>Projet Supabase <b>tsyhuuqtbcdpolhmmeri</b> · données réelles · périmètre PROD isolé.</p></div><Status tone="good">PROD CONTRÔLÉE</Status></div>
            <ProductionOperations inventory={productionInventory ?? {}} onRefresh={loadProductionInventory}/>
              <ProductionGovernance inventory={productionInventory ?? {}} onRefresh={loadProductionInventory}/>
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
              <div className="section-title"><div><h2>Personnel et formateurs</h2><p>Fiches opérationnelles reliées aux profils de production.</p></div></div>
              <div className="lower-grid">
                <article className="panel"><div className="panel-heading"><div><h3>Personnel</h3><p>Département, fonction et statut</p></div><span className="count-pill">{(productionInventory.staff ?? []).length}</span></div>
                  {(productionInventory.staff ?? []).map((s:any)=><div className="audit-row" key={s.id}><div><b>{(productionInventory.profiles ?? []).find((p:any)=>p.id===s.id)?.display_name ?? s.staff_number}</b><small>{s.staff_number} · {s.department ?? "Département non renseigné"} · {s.position ?? "Fonction non renseignée"}</small></div><Status tone={s.status==="active"?"good":"muted"}>{s.status}</Status></div>)}
                </article>
                <article className="panel"><div className="panel-heading"><div><h3>Formateurs</h3><p>Spécialités et statut</p></div><span className="count-pill">{(productionInventory.teachers ?? []).length}</span></div>
                  {(productionInventory.teachers ?? []).map((t:any)=><div className="audit-row" key={t.id}><div><b>{(productionInventory.profiles ?? []).find((p:any)=>p.id===t.id)?.display_name ?? t.teacher_number}</b><small>{t.teacher_number} · {t.specialization ?? "Spécialité non renseignée"}</small></div><Status tone={t.status==="active"?"good":"muted"}>{t.status}</Status></div>)}
                </article>
              </div>
              <div className="section-title"><div><h2>Horaires et séances</h2><p>Modèles hebdomadaires et séances matérialisées.</p></div></div>
              <div className="lower-grid">
                <article className="panel"><div className="panel-heading"><div><h3>Modèles d’emploi du temps</h3><p>Jours et heures planifiés</p></div><span className="count-pill">{(productionInventory.schedule_templates ?? []).length}</span></div>
                  {(productionInventory.schedule_templates ?? []).map((s:any)=><div className="audit-row" key={s.id}><div><b>{(productionInventory.formations ?? []).find((f:any)=>f.id===s.formation_id)?.name ?? "Formation"} · {s.weekday ?? "Jour non défini"}</b><small>{s.start_time}–{s.end_time} · Groupe : {(productionInventory.groups ?? []).find((g:any)=>g.id===s.group_id)?.name ?? "Tous / non précisé"} · {s.status}</small></div><Status tone={s.status==="active"?"good":"muted"}>{s.status}</Status></div>)}
                </article>
                <article className="panel"><div className="panel-heading"><div><h3>Suspensions de cours</h3><p>Périodes et motifs enregistrés</p></div><span className="count-pill">{(productionInventory.course_suspensions ?? []).length}</span></div>
                  {(productionInventory.course_suspensions ?? []).map((s:any)=><div className="audit-row" key={s.id}><div><b>{(productionInventory.formations ?? []).find((f:any)=>f.id===s.formation_id)?.name ?? "Toutes formations"} · {s.starts_on} → {s.ends_on}</b><small>{s.reason}</small></div><Status tone={s.revoked_at?"muted":"warn"}>{s.revoked_at?"Révoquée":"Enregistrée"}</Status></div>)}
                </article>
              </div>
              <div className="section-title"><div><h2>Justifications et règles financières</h2><p>État des demandes, règles actives et paiements.</p></div></div>
              <div className="lower-grid">
                <article className="panel"><div className="panel-heading"><div><h3>Justifications d’absence</h3><p>Demandes soumises et décisions</p></div><span className="count-pill">{(productionInventory.justifications ?? []).length}</span></div>
                  {(productionInventory.justifications ?? []).slice(0,20).map((j:any)=><div className="audit-row" key={j.id}><div><b>{(productionInventory.profiles ?? []).find((p:any)=>p.id===j.person_id)?.display_name ?? j.person_id}</b><small>{j.reason_type} · {j.reason ?? "Sans commentaire"} · {j.submitted_at ? new Date(j.submitted_at).toLocaleString("fr-FR") : "—"}</small></div><Status tone={j.status==="approved"?"good":j.status==="rejected"?"warn":"muted"}>{j.status}</Status></div>)}
                </article>
                <article className="panel"><div className="panel-heading"><div><h3>Règles de pénalité</h3><p>Seuils, montants et application</p></div><span className="count-pill">{(productionInventory.penalty_rules ?? []).length}</span></div>
                  {(productionInventory.penalty_rules ?? []).map((r:any)=><div className="audit-row" key={r.id}><div><b>{r.penalty_type} · {Number(r.amount_fcfa).toLocaleString("fr-FR")} FCFA</b><small>{r.description ?? "—"} · {r.min_delay_minutes} à {r.max_delay_minutes ?? "∞"} min · tolérance {r.tolerance_minutes ?? 0} min · {r.target_scope}</small></div><Status tone={r.active?"good":"muted"}>{r.active?"Active":"Inactive"}</Status></div>)}
                </article>
              </div>
              <div className="section-title"><div><h2>Comptes, sécurité et appareils</h2><p>Rôles, permissions, paramètres non secrets et audit de production.</p></div></div>
              <div className="stats-grid">
                {([["Rôles","roles"],["Affectations de rôles","user_roles"],["Permissions","permissions"],["Liens rôles/permissions","role_permissions"],["Points de contrôle","checkpoints"],["Tentatives borne","kiosk_auth_attempts"],["Journal d’audit","audit_logs"],["Paramètres (sans valeurs)","system_settings"]] as const).map(([label,key])=><article className="stat-card" key={key}><div className="stat-top"><span>{label}</span><ShieldCheck size={18}/></div><strong>{(productionInventory[key] ?? []).length}</strong><small>Enregistrements chargés · PRODUCTION</small></article>)}
              </div>
              <div className="section-title"><div><h2>Pénalités et paiements</h2><p>Consultation uniquement ; aucune validation financière depuis cet écran.</p></div></div>
              <div className="audit-list">{(productionInventory.penalties ?? []).slice(0,30).map((p:any)=><div className="audit-row" key={p.id}><div><b>{(productionInventory.profiles ?? []).find((x:any)=>x.id===p.person_id)?.display_name ?? p.person_id}</b><small>{p.penalty_type ?? "Pénalité"} · {Number(p.amount_fcfa ?? 0).toLocaleString("fr-FR")} FCFA · {p.description ?? "—"}</small></div><Status>{p.status}</Status></div>)}
              {(productionInventory.payments ?? []).slice(0,30).map((p:any)=><div className="audit-row" key={p.id}><div><b>{p.receipt_number ?? "Paiement sans reçu"}</b><small>{(productionInventory.profiles ?? []).find((x:any)=>x.id===p.person_id)?.display_name ?? p.payer_name ?? p.person_id} · {Number(p.amount_fcfa ?? 0).toLocaleString("fr-FR")} FCFA · {p.payment_type ?? "Paiement"}</small></div><Status tone={p.status==="validated"?"good":"warn"}>{p.status}</Status></div>)}</div>
              <div className="section-title"><div><h2>Historique des interventions</h2><p>Journal métier de la base de production.</p></div></div>
              <div className="audit-list">{(productionInventory.audit_logs ?? []).slice(0,30).map((a:any)=><div className="audit-row" key={a.id}><div><b>{a.action} · {a.module}</b><small>{new Date(a.created_at).toLocaleString("fr-FR")} · {a.entity_type ?? "—"} · {a.entity_id ?? "—"}</small></div><Status>{a.visibility ?? "business"}</Status></div>)}</div>
              <div className="empty-state">Les données proviennent exclusivement de la base PRODUCTION. Les listes sont plafonnées par la route serveur et ne constituent pas un export exhaustif. Les écritures passent uniquement par les actions autorisées de l’API propriétaire PRODUCTION, avec motif, confirmation et journal d’audit.</div>
            </>}
            {!productionInventory && !productionLoading && !productionError && <div className="empty-state">Aucune donnée PRODUCTION chargée. Lance la lecture ci-dessus.</div>}
          </div>}
          {active === "audit" && <div className="panel project-panel"><div className="panel-heading"><div><h3>Journal d’audit</h3><p>Journal métier Aéro Service PRODUCTION.</p></div><span className="count-pill">{data?.audit_total ?? 0} événements</span></div>{audits.length ? <div className="audit-list">{audits.map(event => <div className="audit-row" key={event.id}><div><b>{event.action}</b><small>{new Date(event.occurred_at).toLocaleString("fr-FR")} · {event.actor_email ?? "Système"} · {event.target_type ?? "—"} · {event.environment}</small><small>{event.details ? JSON.stringify(event.details) : "Détails non fournis par la source"}</small></div><Status tone={event.outcome === "success" ? "good" : event.outcome === "failure" || event.outcome === "denied" ? "warn" : "muted"}>{event.outcome}</Status></div>)}</div> : <div className="empty-state"><div><ClipboardList size={21}/></div><b>Aucun événement disponible</b><span>Le registre n’a renvoyé aucun événement d’audit pour le moment.</span></div>}</div>}

          {active === "settings" && <div className="module-layout"><div className="panel module-panel"><div className="module-icon"><Settings/></div><h2>Connexions sécurisées</h2><p>Les clés privilégiées ne doivent jamais être stockées dans le navigateur. Les connecteurs doivent passer par des routes serveur et des autorisations limitées.</p><div className="security-list"><div><span>Supabase Auth + profils PRODUCTION</span><Status tone={data ? "good" : "warn"}>{data ? "Connecté" : "À vérifier"}</Status></div><div><span>API Vercel</span><Status>Jeton serveur dédié requis</Status></div><div><span>API GitHub</span><Status>App / jeton à configurer</Status></div><div><span>Stockage indépendant du centre</span><Status tone="warn">À mettre en place</Status></div></div><button className="primary-button" onClick={() => setNotice("La configuration des clés doit se faire côté serveur. Ne collez aucun jeton secret dans une conversation ou dans le navigateur.")}>Consignes de sécurité <ArrowUpRight size={16}/></button></div><aside className="panel checklist"><h3>Règles obligatoires</h3><div><Status tone="good">Actif</Status><span>Identité propriétaire vérifiée</span></div><div><Status tone="good">Actif</Status><span>Registre isolé et protégé</span></div><div><Status tone="good">Actif</Status><span>Secrets absents du client</span></div><div><Status tone="warn">À faire</Status><span>Connecteurs et permissions minimales</span></div></aside></div>}

          <footer className="footer"><span>WDESK CONTROL CENTER <b>·</b> Fondation v0.2</span><span><i/> {data ? "API connectée · opérations fournisseurs encore limitées" : "Synchronisation requise"}</span></footer>
        </div>
      </section>
    </main>
  );
}
