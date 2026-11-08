create or replace function public.wdesk_owner_archive_student(
  p_actor_id uuid, p_target_id uuid, p_reason text, p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor public.profiles%rowtype;
  v_roles text[];
  v_old_profile jsonb;
  v_new_profile jsonb;
  v_old_regs jsonb;
  v_new_regs jsonb;
  v_count integer;
  v_result jsonb;
begin
  if p_actor_id is null or p_target_id is null or p_request_id is null then raise exception 'OWNER_AND_TARGET_REQUIRED'; end if;
  if length(trim(coalesce(p_reason,''))) < 8 then raise exception 'OWNER_REASON_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select new_values into v_result from public.audit_logs
    where module='wdesk_production' and new_values->>'request_id'=p_request_id::text
    order by created_at desc limit 1;
  if v_result is not null then return v_result || jsonb_build_object('ok',true,'replayed',true); end if;
  select * into v_actor from public.profiles where id=p_actor_id for share;
  if not found or lower(coalesce(v_actor.email,'')) <> 'wdesk87@gmail.com' or lower(v_actor.status) <> 'active' then raise exception 'PRODUCTION_OWNER_NOT_VERIFIED'; end if;
  select array_agg(upper(r.code)) into v_roles from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_actor_id;
  if not coalesce(v_roles,'{}'::text[]) @> array['DIRECTOR','PRE_ADMIN']::text[] then raise exception 'PRODUCTION_OWNER_ROLES_REQUIRED'; end if;
  if p_actor_id=p_target_id then raise exception 'OWNER_SELF_ARCHIVE_FORBIDDEN'; end if;
  select to_jsonb(p) into v_old_profile from public.profiles p where p.id=p_target_id for update;
  if v_old_profile is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if not exists(select 1 from public.students s where s.id=p_target_id) then raise exception 'STUDENT_PROFILE_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]'::jsonb) into v_old_regs from public.registrations r where r.person_id=p_target_id;
  update public.registrations set status='cancelled',reviewed_at=clock_timestamp(),reviewed_by=p_actor_id,
    review_comment=left(trim(p_reason),500),updated_at=clock_timestamp()
    where person_id=p_target_id and status in ('pending','submitted','approved');
  get diagnostics v_count = row_count;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]'::jsonb) into v_new_regs from public.registrations r where r.person_id=p_target_id;
  update public.profiles set status='archived',updated_at=clock_timestamp()
    where id=p_target_id returning to_jsonb(public.profiles.*) into v_new_profile;
  insert into public.audit_logs(actor_id,action,module,entity_type,entity_id,old_values,new_values,visibility)
    values(p_actor_id,'student_archive','wdesk_production','student',p_target_id,
      jsonb_build_object('profile',v_old_profile,'registrations',v_old_regs),
      jsonb_build_object('profile',v_new_profile,'registrations',v_new_regs,'cancelled_registrations',v_count,
        'request_id',p_request_id,'reason',left(trim(p_reason),500)),'business');
  return jsonb_build_object('ok',true,'action','student_archive','entity_id',p_target_id,
    'cancelled_registrations',v_count,'profile',v_new_profile,'request_id',p_request_id);
end;
$function$;
revoke all on function public.wdesk_owner_archive_student(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.wdesk_owner_archive_student(uuid,uuid,text,uuid) to service_role;
