create or replace function public.wdesk_owner_prepare_student_hard_delete(
  p_actor_id uuid,
  p_target_id uuid,
  p_expected_email text,
  p_reason text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor public.profiles%rowtype;
  v_roles text[];
  v_profile public.profiles%rowtype;
  v_replay jsonb;
  v_registration_count integer;
begin
  if p_actor_id is null or p_target_id is null or p_request_id is null then
    raise exception 'OWNER_AND_TARGET_REQUIRED';
  end if;
  if length(trim(coalesce(p_reason,''))) < 8 then
    raise exception 'OWNER_REASON_REQUIRED';
  end if;
  if lower(trim(coalesce(p_expected_email,''))) = '' then
    raise exception 'EXPECTED_EMAIL_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));

  select new_values into v_replay
  from public.audit_logs
  where module='wdesk_production'
    and action='student_hard_delete_pending'
    and new_values->>'request_id'=p_request_id::text
  order by created_at desc limit 1;

  if v_replay is not null then
    return v_replay || jsonb_build_object('ok',true,'replayed',true);
  end if;

  select * into v_actor from public.profiles where id=p_actor_id for share;
  if not found or lower(coalesce(v_actor.email,'')) <> 'wdesk87@gmail.com' or lower(v_actor.status) <> 'active' then
    raise exception 'PRODUCTION_OWNER_NOT_VERIFIED';
  end if;

  select array_agg(upper(r.code)) into v_roles
  from public.user_roles ur join public.roles r on r.id=ur.role_id
  where ur.user_id=p_actor_id;
  if not coalesce(v_roles,'{}'::text[]) @> array['DIRECTOR','PRE_ADMIN']::text[] then
    raise exception 'PRODUCTION_OWNER_ROLES_REQUIRED';
  end if;

  if p_actor_id=p_target_id then raise exception 'OWNER_SELF_DELETE_FORBIDDEN'; end if;

  select * into v_profile from public.profiles where id=p_target_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if lower(coalesce(v_profile.email,'')) <> lower(trim(p_expected_email)) then
    raise exception 'TARGET_EMAIL_MISMATCH';
  end if;
  if not exists(select 1 from public.students s where s.id=p_target_id) then
    raise exception 'STUDENT_PROFILE_REQUIRED';
  end if;

  -- Permanent deletion is deliberately refused whenever academic, attendance,
  -- financial, biometric, or review history exists. Such accounts must be archived.
  if exists(select 1 from public.attendance where person_id=p_target_id)
    or exists(select 1 from public.attendance_events where person_id=p_target_id)
    or exists(select 1 from public.absence_justifications where person_id=p_target_id)
    or exists(select 1 from public.payments where person_id=p_target_id)
    or exists(select 1 from public.penalties where person_id=p_target_id)
    or exists(select 1 from public.qr_checkin_requests where person_id=p_target_id)
    or exists(select 1 from public.biometric_events where person_id=p_target_id)
    or exists(select 1 from public.registration_documents d
      join public.registrations r on r.id=d.registration_id where r.person_id=p_target_id)
    or exists(select 1 from public.attendance_events where created_by=p_target_id)
    or exists(select 1 from public.absence_justifications where reviewed_by=p_target_id)
    or exists(select 1 from public.payments where received_by=p_target_id or validated_by=p_target_id)
    or exists(select 1 from public.qr_checkin_requests where reviewed_by=p_target_id)
    or exists(select 1 from public.course_sessions where created_by=p_target_id)
    or exists(select 1 from public.course_suspensions where created_by=p_target_id or revoked_by=p_target_id)
    or exists(select 1 from public.schedule_templates where created_by=p_target_id)
    or exists(select 1 from public.penalty_rules where created_by=p_target_id)
    or exists(select 1 from public.operating_days where opened_by=p_target_id or closed_by=p_target_id)
    or exists(select 1 from public.presence_kiosk_devices where activated_by=p_target_id)
    or exists(select 1 from public.registration_documents where validated_by=p_target_id)
    or exists(select 1 from public.system_settings where updated_by=p_target_id)
  then
    raise exception 'STUDENT_HAS_HISTORY_ARCHIVE_REQUIRED';
  end if;

  select count(*) into v_registration_count
  from public.registrations where person_id=p_target_id;

  -- Only enrollment rows with no attached documents or protected history are removed.
  delete from public.registrations where person_id=p_target_id;

  insert into public.audit_logs(actor_id,action,module,entity_type,entity_id,old_values,new_values,visibility)
  values(
    p_actor_id,
    'student_hard_delete_pending',
    'wdesk_production',
    'student',
    p_target_id,
    jsonb_build_object('profile_id',v_profile.id,'email',v_profile.email,'status',v_profile.status,'registrations_count',v_registration_count),
    jsonb_build_object(
      'request_id',p_request_id,
      'target_email',lower(trim(p_expected_email)),
      'reason',left(trim(p_reason),500),
      'registrations_deleted',v_registration_count,
      'status','auth_deletion_pending'
    ),
    'business'
  );

  return jsonb_build_object(
    'ok',true,
    'action','student_hard_delete_pending',
    'entity_id',p_target_id,
    'target_email',lower(trim(p_expected_email)),
    'registrations_deleted',v_registration_count,
    'request_id',p_request_id,
    'status','auth_deletion_pending'
  );
end;
$function$;

revoke all on function public.wdesk_owner_prepare_student_hard_delete(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.wdesk_owner_prepare_student_hard_delete(uuid,uuid,text,text,uuid) to service_role;
