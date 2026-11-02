"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, Blocks, Box, BriefcaseBusiness, ChevronDown,
  CircleHelp, Cloud, Code2, Database, Gauge, Github, HardDrive, LayoutDashboard,
  LockKeyhole, Menu, Search, Server, Settings, ShieldCheck, Users, X
} from "lucide-react";

type ModuleKey = "overview" | "projects" | "supabase" | "hosting" | "github" | "access" | "audit" | "settings";

const nav: { key: ModuleKey; label: string; icon: typeof LayoutDashboard; group: string }[] = [
  { key: "overview", label: "Vue générale", icon: LayoutDashboard, group: "ESPACE DE TRAVAIL" },
  { key: "projects", label: "Projets & infrastructures", icon: Blocks, group: "PILOTAGE" },
  { key: "supabase", label: "Supabase", icon: Database, group: "PILOTAGE" },
  { key: "hosting", label: "Hébergement", icon: Cloud, group: "PILOTAGE" },
  { key: "github", label: "Code & dépôts", icon: Github, group: "PILOTAGE" },
  { key: "access", label: "Utilisateurs & accès", icon: Users, group: "SÉCURITÉ" },
  { key: "audit", label: "Journal d'audit", icon: ShieldCheck, group: "SÉCURITÉ" },
  { key: "settings", label: "Paramètres", icon: Settings, group: "SYSTÈME" },
];

const projects = [
  { name: "Aéro Service", env: "Production", platform: "Vercel + Supabase", status: "À connecter", tone: "muted", detail: "Infrastructure de production — aucune action automatique" },
  { name: "Aéro Service TEST", env: "Test", platform: "Supabase", status: "Hôte du centre", tone: "good", detail: "Projet Supabase nuijzdqnhjzcnqpfqvvl" },
  { name: "WDESK Control Center", env: "Développement", platform: "Next.js", status: "En construction", tone: "info", detail: "Dépôt GitHub wdesk07/center-work" },
];

const descriptions: Record<ModuleKey, { title: string; intro: string }> = {
  overview: { title: "Vue générale", intro: "Pilotez vos projets, vos accès et vos infrastructures depuis un espace unique." },
  projects: { title: "Projets & infrastructures", intro: "Inventaire centralisé des environnements connus. Les connexions réelles seront activées progressivement." },
  supabase: { title: "Supabase", intro: "Bases de données, Auth, politiques RLS, fonctions et sauvegardes." },
  hosting: { title: "Hébergement", intro: "Déploiements, domaines, variables d’environnement, journaux et disponibilité." },
  github: { title: "Code & dépôts", intro: "Dépôts, branches, commits et historique des modifications." },
  access: { title: "Utilisateurs & accès", intro: "Gestion des identités et des autorisations avec séparation des responsabilités." },
  audit: { title: "Journal d’audit", intro: "Historique des opérations et des tentatives d’administration." },
  settings: { title: "Paramètres", intro: "Configuration générale, sécurité et connexions des fournisseurs." },
};

function Status({ children, tone = "muted" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status status-${tone}`}><i />{children}</span>;
}

export default function Home() {
  const [active, setActive] = useState<ModuleKey>("overview");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const filteredProjects = useMemo(() => projects.filter(p => (p.name + p.platform + p.env).toLowerCase().includes(query.toLowerCase())), [query]);
  const current = descriptions[active];

  function choose(key: ModuleKey) {
    setActive(key);
    setMobileOpen(false);
    setNotice("");
  }

  return (
    <main className="shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Box size={21} strokeWidth={2.2} /></div>
          <div><strong>WDESK</strong><span>CONTROL CENTER</span></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fermer"><X size={18}/></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch"><div className="workspace-avatar">W</div><span><b>WDesk Principal</b><small>Propriétaire</small></span><ChevronDown size={15}/></button>
        <nav className="navigation">
          {(["ESPACE DE TRAVAIL", "PILOTAGE", "SÉCURITÉ", "SYSTÈME"] as const).map(group => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {nav.filter(item => item.group === group).map(item => {
                const Icon = item.icon;
                return <button key={item.key} className={`nav-link ${active === item.key ? "nav-active" : ""}`} onClick={() => choose(item.key)}><Icon size={17}/><span>{item.label}</span>{item.key === "audit" && <span className="nav-dot"/>}</button>;
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-note"><ShieldCheck size={17}/><span><b>Espace protégé</b><small>Connexions à configurer</small></span></div>
          <div className="profile"><div className="profile-avatar">WO</div><div><b>WDESK OWNER</b><small>wdesk87@gmail.com</small></div><button aria-label="Paramètres du compte" onClick={() => choose("settings")}><Settings size={16}/></button></div>
        </div>
      </aside>

      {mobileOpen && <button className="scrim" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)}/>}

      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu"><Menu size={20}/></button>
          <div className="breadcrumbs">WDESK <span>/</span> {current.title}</div>
          <div className="top-actions">
            <div className="system-indicator"><i/> Système en initialisation</div>
            <button className="icon-button" aria-label="Notifications" onClick={() => setNotice("Aucune notification pour le moment.")}><Bell size={18}/></button>
            <button className="help-button" onClick={() => setNotice("Centre d’aide : les connexions et opérations seront activées après configuration sécurisée.")}><CircleHelp size={17}/><span>Aide</span></button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">CENTRE DE COMMANDEMENT WDESK</div><h1>{current.title}</h1><p>{current.intro}</p></div>
            <div className="owner-chip"><div className="crown">♛</div><span><b>WDESK OWNER</b><small>Propriétaire principal</small></span></div>
          </div>

          {notice && <div className="notice"><Activity size={17}/>{notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}

          {active === "overview" && <>
            <div className="welcome-banner">
              <div className="welcome-icon"><Gauge size={24}/></div>
              <div><span>BIENVENUE DANS VOTRE ESPACE</span><h2>Tout votre environnement, un seul centre.</h2><p>Un point de contrôle pour vos applications, vos données et vos services.</p></div>
              <div className="banner-orb orb-one"/><div className="banner-orb orb-two"/>
            </div>
            <div className="section-title"><div><h2>État des infrastructures</h2><p>État de référence connu à la création du centre</p></div><button className="subtle-button" onClick={() => choose("projects")}>Voir l’inventaire <ArrowUpRight size={15}/></button></div>
            <div className="stats-grid">
              <article className="stat-card"><div className="stat-top"><span>Projets recensés</span><Blocks size={18}/></div><strong>03</strong><small>Production, test et centre</small></article>
              <article className="stat-card"><div className="stat-top"><span>Services connectés</span><Activity size={18}/></div><strong>01</strong><small>Hôte Supabase TEST</small></article>
              <article className="stat-card"><div className="stat-top"><span>Accès propriétaire</span><LockKeyhole size={18}/></div><strong>À valider</strong><small>Identité Auth non liée</small></article>
              <article className="stat-card"><div className="stat-top"><span>Événements d’audit</span><ShieldCheck size={18}/></div><strong>0</strong><small>Journal prêt à recevoir</small></article>
            </div>
            <div className="section-title"><div><h2>Accès rapides</h2><p>Ouvrir un domaine de gestion</p></div></div>
            <div className="quick-grid">
              <button onClick={() => choose("supabase")}><Database/><span><b>Supabase</b><small>Base de données & Auth</small></span><ArrowUpRight/></button>
              <button onClick={() => choose("hosting")}><Cloud/><span><b>Hébergement</b><small>Déploiements & services</small></span><ArrowUpRight/></button>
              <button onClick={() => choose("github")}><Github/><span><b>GitHub</b><small>Code & versions</small></span><ArrowUpRight/></button>
              <button onClick={() => choose("access")}><Users/><span><b>Utilisateurs</b><small>Rôles & permissions</small></span><ArrowUpRight/></button>
            </div>
            <div className="lower-grid">
              <article className="panel"><div className="panel-heading"><div><h3>Activité récente</h3><p>Événements enregistrés dans le centre</p></div><button onClick={() => choose("audit")}>Tout voir <ArrowUpRight size={14}/></button></div><div className="empty-state"><div><Activity size={21}/></div><b>Aucune activité enregistrée</b><span>Les opérations apparaîtront ici après activation des connexions.</span></div></article>
              <article className="panel"><div className="panel-heading"><div><h3>État de sécurité</h3><p>Préparation du compte propriétaire</p></div><ShieldCheck size={19}/></div><div className="security-list"><div><span>Schéma de données isolé</span><Status tone="good">Prêt</Status></div><div><span>Identité propriétaire</span><Status tone="warn">À lier</Status></div><div><span>Clés fournisseurs</span><Status>Non configurées</Status></div><div><span>Journal d’audit</span><Status tone="good">Initialisé</Status></div></div></article>
            </div>
          </>}

          {active === "projects" && <div className="panel project-panel"><div className="panel-heading"><div><h3>Inventaire des projets</h3><p>Les statuts reflètent uniquement les connexions vérifiées ou déclarées.</p></div><span className="count-pill">03 éléments</span></div><div className="search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un projet..."/></div><div className="project-list">{filteredProjects.map((p, i) => <article className="project-row" key={p.name}><div className="project-symbol">{i === 0 ? <BriefcaseBusiness/> : i === 1 ? <Database/> : <Code2/>}</div><div className="project-info"><b>{p.name}</b><span>{p.platform} · {p.detail}</span></div><div className="project-meta"><small>{p.env}</small><Status tone={p.tone}>{p.status}</Status></div></article>)}</div></div>}

          {active !== "overview" && active !== "projects" && <div className="module-layout"><div className="panel module-panel"><div className="module-icon">{active === "supabase" ? <Database/> : active === "hosting" ? <Cloud/> : active === "github" ? <Github/> : active === "access" ? <Users/> : active === "audit" ? <ShieldCheck/> : <Settings/>}</div><h2>{current.title}</h2><p>{current.intro}</p><div className="module-callout"><LockKeyhole size={18}/><div><b>Connexion sécurisée requise</b><span>Ce module est en préparation. Aucun accès fournisseur ni aucune opération réelle n’est encore exposé depuis l’interface.</span></div></div><button className="primary-button" onClick={() => setNotice("Ce module sera activé après configuration des identifiants sécurisés et des contrôles d’accès.")}>Consulter les prérequis <ArrowUpRight size={16}/></button></div><aside className="panel checklist"><h3>Préparation du module</h3><div><Status tone="good">Prêt</Status><span>Structure de navigation</span></div><div><Status tone="warn">En cours</Status><span>Connexion et permissions</span></div><div><Status>À faire</Status><span>Actions opérationnelles</span></div><div><Status>À faire</Status><span>Journalisation et tests</span></div></aside></div>}

          <footer className="footer"><span>WDESK CONTROL CENTER <b>·</b> Fondation v0.1</span><span><i/> Environnement de construction · Aucun accès production activé</span></footer>
        </div>
      </section>
    </main>
  );
}