"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

type Props = {
  inventory: any;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
};

const blankFormation = { code: "", name: "", description: "", duration: "", status: "active" };
const blankGroup = { formation_id: "", code: "", name: "", academic_year: "2026-2027", capacity: "", status: "active" };
const blankSchedule = { formation_id: "", weekday_iso: "1", subject: "", planned_start: "09:00", planned_end: "11:00", active: true };
const blankRule = { person_type: "student", penalty_type: "late_arrival", description: "", target_scope: "all", application_mode: "automatic", min_delay_minutes: "0", max_delay_minutes: "", tolerance_minutes: "0", amount_fcfa: "1000", priority: "100", formation_id: "", blocks_access: false, active: true };

export default function OwnerOperations({ inventory, onRefresh, onNotice }: Props) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formationId, setFormationId] = useState("");
  const [formation, setFormation] = useState<any>(blankFormation);
  const [groupId, setGroupId] = useState("");
  const [group, setGroup] = useState<any>(blankGroup);
  const [scheduleId, setScheduleId] = useState("");
  const [schedule, setSchedule] = useState<any>(blankSchedule);
  const [sessionId, setSessionId] = useState("");
  const [attendanceType, setAttendanceType] = useState("daily");
  const [attendanceId, setAttendanceId] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("on_time");
  const [attendanceTime, setAttendanceTime] = useState("");
  const [attendanceMinutes, setAttendanceMinutes] = useState("0");
  const [ruleId, setRuleId] = useState("");
  const [rule, setRule] = useState<any>(blankRule);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accountStatus, setAccountStatus] = useState("suspended");
  const [roleUserId, setRoleUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roleMode, setRoleMode] = useState("assign");

  useEffect(() => {
    const item = inventory?.formations?.find((x: any) => x.id === formationId);
    if (item) setFormation({ code: item.code ?? "", name: item.name ?? "", description: item.description ?? "", duration: item.duration ?? "", status: item.status ?? "active" });
    else if (!formationId) setFormation(blankFormation);
  }, [formationId, inventory?.formations]);

  useEffect(() => {
    const item = inventory?.groups?.find((x: any) => x.id === groupId);
    if (item) setGroup({ formation_id: item.formation_id, code: item.code ?? "", name: item.name ?? "", academic_year: item.academic_year ?? "", capacity: item.capacity ?? "", status: item.status ?? "active" });
    else if (!groupId) setGroup(blankGroup);
  }, [groupId, inventory?.groups]);

  useEffect(() => {
    const item = inventory?.weekly_schedule?.find((x: any) => x.id === scheduleId);
    if (item) setSchedule({ formation_id: item.formation_id, weekday_iso: String(item.weekday_iso), subject: item.subject ?? "", planned_start: String(item.planned_start ?? "").slice(0, 5), planned_end: String(item.planned_end ?? "").slice(0, 5), active: item.active !== false });
    else if (!scheduleId) setSchedule(blankSchedule);
  }, [scheduleId, inventory?.weekly_schedule]);

  useEffect(() => {
    const item = inventory?.penalty_rules?.find((x: any) => x.id === ruleId);
    if (item) setRule({
      person_type: item.person_type, penalty_type: item.penalty_type, description: item.description ?? "",
      target_scope: item.target_scope, application_mode: item.application_mode,
      min_delay_minutes: String(item.min_delay_minutes), max_delay_minutes: item.max_delay_minutes == null ? "" : String(item.max_delay_minutes),
      tolerance_minutes: String(item.tolerance_minutes), amount_fcfa: String(item.amount_fcfa), priority: String(item.priority),
      formation_id: item.formation_id ?? "", blocks_access: !!item.blocks_access, active: !!item.active,
    });
    else if (!ruleId) setRule(blankRule);
  }, [ruleId, inventory?.penalty_rules]);

  const attendanceOptions = useMemo(() => {
    const rows = attendanceType === "daily" ? inventory?.daily_attendance ?? [] : inventory?.session_attendance ?? [];
    return rows.slice(0, 500);
  }, [attendanceType, inventory]);
  const selectedAttendance = attendanceOptions.find((x: any) => x.id === attendanceId);

  async function send(action: string, payload: Record<string, unknown>, success: string) {
    if (reason.trim().length < 8 || confirmation !== "CONFIRMER") {
      onNotice("Indique un motif d’au moins 8 caractères et saisis CONFIRMER.");
      return;
    }
    setBusy(true);
    onNotice("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload, reason: reason.trim(), confirmation: "CONFIRMER", request_id: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Commande refusée");
      onNotice(result.audit_warning ? success + " Attention : le serveur a signalé un avertissement d’audit, vérifie le journal avant de répéter." : success);
      setReason(""); setConfirmation("");
      await onRefresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Échec de la commande propriétaire.");
    } finally {
      setBusy(false);
    }
  }

  const input = "command-input";
  const label = "command-label";
  const btn = "primary-button";
  const days = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  return <div className="owner-operations">
    <div className="section-title"><div><h2>Commandes propriétaires · TEST</h2><p>Chaque modification est limitée au projet TEST, confirmée et inscrite au journal d’audit.</p></div><button className="subtle-button" onClick={() => void onRefresh()}>Actualiser <RefreshCw size={15}/></button></div>

    <div className="module-panel">
      <h3>Formations</h3>
      <p>Créer une formation ou sélectionner une fiche existante pour la modifier. L’archivage conserve l’historique.</p>
      <form onSubmit={e => { e.preventDefault(); void send("formation_upsert", { target_id: formationId || null, ...formation }, formationId ? "Formation modifiée dans TEST." : "Formation créée dans TEST."); }}>
        <label className={label}>Formation existante (facultatif)</label>
        <select className={input} value={formationId} onChange={e => setFormationId(e.target.value)}><option value="">Nouvelle formation</option>{(inventory?.formations ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name} · {x.code}</option>)}</select>
        <div className="form-grid">
          <label className={label}>Code<input className={input} value={formation.code} onChange={e=>setFormation({...formation,code:e.target.value})} required maxLength={40}/></label>
          <label className={label}>Nom<input className={input} value={formation.name} onChange={e=>setFormation({...formation,name:e.target.value})} required maxLength={160}/></label>
          <label className={label}>Durée<input className={input} value={formation.duration} onChange={e=>setFormation({...formation,duration:e.target.value})} maxLength={80}/></label>
          <label className={label}>Statut<select className={input} value={formation.status} onChange={e=>setFormation({...formation,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archivée</option></select></label>
        </div>
        <label className={label}>Description<textarea className={input} value={formation.description} onChange={e=>setFormation({...formation,description:e.target.value})} maxLength={2000}/></label>
        <button className={btn} disabled={busy} type="submit">{formationId ? "Enregistrer la formation" : "Créer la formation"} <ShieldCheck size={16}/></button>
      </form>
    </div>

    <div className="module-panel">
      <h3>Groupes</h3>
      <p>Un groupe doit toujours être rattaché à une formation existante.</p>
      <form onSubmit={e => { e.preventDefault(); void send("group_upsert", { target_id: groupId || null, ...group, capacity: group.capacity === "" ? null : Number(group.capacity) }, groupId ? "Groupe modifié dans TEST." : "Groupe créé dans TEST."); }}>
        <label className={label}>Groupe existant (facultatif)</label>
        <select className={input} value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Nouveau groupe</option>{(inventory?.groups ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.name} · {x.code}</option>)}</select>
        <div className="form-grid">
          <label className={label}>Formation<select className={input} value={group.formation_id} onChange={e=>setGroup({...group,formation_id:e.target.value})} required><option value="">Choisir…</option>{(inventory?.formations ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className={label}>Code<input className={input} value={group.code} onChange={e=>setGroup({...group,code:e.target.value})} required maxLength={40}/></label>
          <label className={label}>Nom<input className={input} value={group.name} onChange={e=>setGroup({...group,name:e.target.value})} required maxLength={160}/></label>
          <label className={label}>Année académique<input className={input} value={group.academic_year} onChange={e=>setGroup({...group,academic_year:e.target.value})} required maxLength={40}/></label>
          <label className={label}>Capacité<input className={input} type="number" min="1" value={group.capacity} onChange={e=>setGroup({...group,capacity:e.target.value})}/></label>
          <label className={label}>Statut<select className={input} value={group.status} onChange={e=>setGroup({...group,status:e.target.value})}><option value="active">Actif</option><option value="inactive">Inactif</option><option value="archived">Archivé</option></select></label>
        </div>
        <button className={btn} disabled={busy} type="submit">{groupId ? "Enregistrer le groupe" : "Créer le groupe"} <ShieldCheck size={16}/></button>
      </form>
    </div>

    <div className="module-panel">
      <h3>Emploi du temps hebdomadaire</h3>
      <form onSubmit={e => { e.preventDefault(); void send("weekly_schedule_upsert", { target_id: scheduleId || null, ...schedule }, scheduleId ? "Créneau modifié dans TEST." : "Créneau ajouté dans TEST."); }}>
        <label className={label}>Créneau existant (facultatif)</label>
        <select className={input} value={scheduleId} onChange={e=>setScheduleId(e.target.value)}><option value="">Nouveau créneau</option>{(inventory?.weekly_schedule ?? []).map((x:any)=><option key={x.id} value={x.id}>{days[x.weekday_iso]} · {x.subject} · {String(x.planned_start).slice(0,5)}</option>)}</select>
        <div className="form-grid">
          <label className={label}>Formation<select className={input} value={schedule.formation_id} onChange={e=>setSchedule({...schedule,formation_id:e.target.value})} required><option value="">Choisir…</option>{(inventory?.formations ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className={label}>Jour<select className={input} value={schedule.weekday_iso} onChange={e=>setSchedule({...schedule,weekday_iso:e.target.value})}>{days.slice(1).map((d,i)=><option key={d} value={String(i+1)}>{d}</option>)}</select></label>
          <label className={label}>Matière<input className={input} value={schedule.subject} onChange={e=>setSchedule({...schedule,subject:e.target.value})} required maxLength={160}/></label>
          <label className={label}>Début<input className={input} type="time" value={schedule.planned_start} onChange={e=>setSchedule({...schedule,planned_start:e.target.value})} required/></label>
          <label className={label}>Fin<input className={input} type="time" value={schedule.planned_end} onChange={e=>setSchedule({...schedule,planned_end:e.target.value})} required/></label>
          <label className={label}>État<select className={input} value={schedule.active ? "active" : "inactive"} onChange={e=>setSchedule({...schedule,active:e.target.value==="active"})}><option value="active">Actif</option><option value="inactive">Désactivé</option></select></label>
        </div>
        <button className={btn} disabled={busy} type="submit">{scheduleId ? "Enregistrer le créneau" : "Ajouter le créneau"} <ShieldCheck size={16}/></button>
      </form>
      <div className="audit-list">{(inventory?.weekly_schedule ?? []).map((x:any)=><div className="audit-row" key={x.id}><div><b>{days[x.weekday_iso]} · {x.subject}</b><small>{inventory.formations.find((f:any)=>f.id===x.formation_id)?.name ?? "Formation"} · {String(x.planned_start).slice(0,5)}–{String(x.planned_end).slice(0,5)}</small></div><span>{x.active ? "Actif" : "Inactif"}</span></div>)}</div>
    </div>

    <div className="module-panel">
      <h3>Suspension et reprise d’un cours</h3>
      <form onSubmit={e=>{e.preventDefault(); const target=inventory?.course_sessions?.find((x:any)=>x.id===sessionId); if(target) void send("course_session_status",{target_id:sessionId,status:target.status==="suspended"?"scheduled":"suspended"},target.status==="suspended"?"Cours repris.":"Cours suspendu.");}}>
        <label className={label}>Séance</label>
        <select className={input} value={sessionId} onChange={e=>setSessionId(e.target.value)} required><option value="">Choisir une séance…</option>{(inventory?.course_sessions ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.session_date} · {x.subject ?? "Cours"} · {x.status}</option>)}</select>
        <button className={btn} disabled={busy || !sessionId} type="submit">Basculer suspension / reprise <ShieldCheck size={16}/></button>
      </form>
    </div>

    <div className="module-panel">
      <h3>Correction manuelle d’un pointage</h3>
      <p>La correction conserve l’enregistrement initial dans l’audit et ajoute un événement de correction à l’historique de présence.</p>
      <form onSubmit={e=>{e.preventDefault(); void send("attendance_correct",{target_type:attendanceType,target_id:attendanceId,status:attendanceStatus,arrived_at:attendanceTime ? new Date(attendanceTime).toISOString() : null,minutes_after_cutoff:Number(attendanceMinutes)},"Pointage corrigé dans TEST.");}}>
        <div className="form-grid">
          <label className={label}>Type<select className={input} value={attendanceType} onChange={e=>{setAttendanceType(e.target.value);setAttendanceId("");setAttendanceStatus(e.target.value==="daily"?"on_time":"present");}}><option value="daily">Pointage journalier</option><option value="session">Présence par séance</option></select></label>
          <label className={label}>Enregistrement<select className={input} value={attendanceId} onChange={e=>{setAttendanceId(e.target.value);const row=(attendanceType==="daily"?inventory?.daily_attendance:inventory?.session_attendance)?.find((x:any)=>x.id===e.target.value);if(row){setAttendanceStatus(row.status);setAttendanceTime(row.arrived_at ? new Date(row.arrived_at).toISOString().slice(0,16) : "");setAttendanceMinutes(String(row.minutes_after_cutoff ?? 0));}}} required><option value="">Choisir…</option>{attendanceOptions.map((x:any)=><option key={x.id} value={x.id}>{inventory?.profiles?.find((p:any)=>p.id===x.person_id)?.display_name ?? x.person_id} · {x.local_date} · {x.status}</option>)}</select></label>
          <label className={label}>Nouveau statut<select className={input} value={attendanceStatus} onChange={e=>setAttendanceStatus(e.target.value)}>{(attendanceType==="daily"?["on_time","late","absent","regularized"]:["present","late","absent","pending"]).map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          <label className={label}>Heure d’arrivée<input className={input} type="datetime-local" value={attendanceTime} onChange={e=>setAttendanceTime(e.target.value)}/></label>
          <label className={label}>Minutes après limite<input className={input} type="number" min="0" max="10000" value={attendanceMinutes} onChange={e=>setAttendanceMinutes(e.target.value)}/></label>
        </div>
        <button className={btn} disabled={busy || !attendanceId} type="submit">Confirmer la correction <ShieldCheck size={16}/></button>
      </form>
    </div>

    <div className="module-panel">
      <h3>Règles de pénalité</h3>
      <form onSubmit={e=>{e.preventDefault(); void send("penalty_rule_upsert",{target_id:ruleId||null,...rule,min_delay_minutes:Number(rule.min_delay_minutes),max_delay_minutes:rule.max_delay_minutes===""?null:Number(rule.max_delay_minutes),tolerance_minutes:Number(rule.tolerance_minutes),amount_fcfa:Number(rule.amount_fcfa),priority:Number(rule.priority),formation_id:rule.formation_id||null},"Règle de pénalité enregistrée dans TEST.");}}>
        <label className={label}>Règle existante (facultatif)</label>
        <select className={input} value={ruleId} onChange={e=>setRuleId(e.target.value)}><option value="">Nouvelle règle</option>{(inventory?.penalty_rules ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.penalty_type} · {x.amount_fcfa} FCFA</option>)}</select>
        <div className="form-grid">
          <label className={label}>Type de personne<select className={input} value={rule.person_type} onChange={e=>setRule({...rule,person_type:e.target.value})}><option value="student">Apprenant</option><option value="staff">Personnel</option><option value="teacher">Formateur</option></select></label>
          <label className={label}>Type de pénalité<input className={input} value={rule.penalty_type} onChange={e=>setRule({...rule,penalty_type:e.target.value})} required/></label>
          <label className={label}>Périmètre<select className={input} value={rule.target_scope} onChange={e=>setRule({...rule,target_scope:e.target.value})}><option value="all">Tous</option><option value="students">Apprenants</option><option value="staff">Personnel</option><option value="teacher">Formateurs</option></select></label>
          <label className={label}>Application<select className={input} value={rule.application_mode} onChange={e=>setRule({...rule,application_mode:e.target.value})}><option value="automatic">Automatique</option><option value="manual">Manuelle</option></select></label>
          <label className={label}>Retard minimum (min)<input className={input} type="number" min="0" value={rule.min_delay_minutes} onChange={e=>setRule({...rule,min_delay_minutes:e.target.value})}/></label>
          <label className={label}>Retard maximum (vide = illimité)<input className={input} type="number" min="0" value={rule.max_delay_minutes} onChange={e=>setRule({...rule,max_delay_minutes:e.target.value})}/></label>
          <label className={label}>Tolérance (min)<input className={input} type="number" min="0" value={rule.tolerance_minutes} onChange={e=>setRule({...rule,tolerance_minutes:e.target.value})}/></label>
          <label className={label}>Montant (FCFA)<input className={input} type="number" min="1" value={rule.amount_fcfa} onChange={e=>setRule({...rule,amount_fcfa:e.target.value})}/></label>
          <label className={label}>Priorité<input className={input} type="number" min="0" value={rule.priority} onChange={e=>setRule({...rule,priority:e.target.value})}/></label>
          <label className={label}>Formation (facultatif)<select className={input} value={rule.formation_id} onChange={e=>setRule({...rule,formation_id:e.target.value})}><option value="">Toutes</option>{(inventory?.formations ?? []).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className={label}>Bloque l’accès<select className={input} value={rule.blocks_access?"yes":"no"} onChange={e=>setRule({...rule,blocks_access:e.target.value==="yes"})}><option value="no">Non</option><option value="yes">Oui</option></select></label>
          <label className={label}>État<select className={input} value={rule.active?"active":"inactive"} onChange={e=>setRule({...rule,active:e.target.value==="active"})}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <label className={label}>Description<textarea className={input} value={rule.description} onChange={e=>setRule({...rule,description:e.target.value})}/></label>
        <button className={btn} disabled={busy} type="submit">{ruleId?"Enregistrer la règle":"Créer la règle"} <ShieldCheck size={16}/></button>
      </form>
    </div>

    <div className="module-panel">
      <h3>Comptes et rôles</h3>
      <form onSubmit={e=>{e.preventDefault();void send("account_invite",{email:inviteEmail,display_name:inviteName},"Invitation créée. La réception de l’e-mail dépend de la configuration SMTP.");}}>
        <h4>Inviter un nouveau compte</h4>
        <div className="form-grid"><label className={label}>Nom<input className={input} value={inviteName} onChange={e=>setInviteName(e.target.value)} required/></label><label className={label}>Adresse e-mail<input className={input} type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} required/></label></div>
        <button className={btn} disabled={busy} type="submit">Envoyer l’invitation <ShieldCheck size={16}/></button>
      </form>
      <form onSubmit={e=>{e.preventDefault();void send("role_assignment",{target_user_id:roleUserId,role_id:roleId,mode:roleMode},"Affectation de rôle mise à jour.");}}>
        <h4>Affecter ou retirer un rôle</h4>
        <div className="form-grid">
          <label className={label}>Compte<select className={input} value={roleUserId} onChange={e=>setRoleUserId(e.target.value)} required><option value="">Choisir un compte…</option>{(inventory?.auth_users ?? []).map((u:any)=><option key={u.id} value={u.id}>{u.email ?? u.id}</option>)}</select></label>
          <label className={label}>Rôle<select className={input} value={roleId} onChange={e=>setRoleId(e.target.value)} required><option value="">Choisir un rôle…</option>{(inventory?.roles ?? []).filter((r:any)=>!["OWNER","PRIMARY_OWNER","WDESK_OWNER"].includes(String(r.code).toUpperCase())).map((r:any)=><option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}</select></label>
          <label className={label}>Action<select className={input} value={roleMode} onChange={e=>setRoleMode(e.target.value)}><option value="assign">Attribuer</option><option value="revoke">Retirer</option></select></label>
        </div>
        <button className={btn} disabled={busy || !roleUserId || !roleId} type="submit">Confirmer le rôle <ShieldCheck size={16}/></button>
      </form>
      <form onSubmit={e=>{e.preventDefault();void send("account_status",{target_user_id:accountId,status:accountStatus},"État du compte mis à jour.");}}>
        <h4>Suspendre ou réactiver un compte</h4>
        <div className="form-grid">
          <label className={label}>Compte<select className={input} value={accountId} onChange={e=>setAccountId(e.target.value)} required><option value="">Choisir un compte…</option>{(inventory?.auth_users ?? []).map((u:any)=><option key={u.id} value={u.id}>{u.email ?? u.id}</option>)}</select></label>
          <label className={label}>Nouvel état<select className={input} value={accountStatus} onChange={e=>setAccountStatus(e.target.value)}><option value="suspended">Suspendu</option><option value="active">Actif</option></select></label>
        </div>
        <button className={btn} disabled={busy || !accountId} type="submit">Appliquer l’état du compte <ShieldCheck size={16}/></button>
      </form>
    </div>

    <div className="module-panel">
      <h3>Motif et confirmation obligatoires</h3>
      <label className={label}>Motif de l’intervention (8 caractères minimum)<textarea className={input} value={reason} onChange={e=>setReason(e.target.value)} minLength={8} maxLength={500}/></label>
      <label className={label}>Pour autoriser une modification, saisir CONFIRMER<input className={input} value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="CONFIRMER"/></label>
      <p>Ces deux champs sont partagés par les formulaires ci-dessus. Aucun changement n’est appliqué tant que la confirmation n’est pas fournie.</p>
    </div>
  </div>;
}
