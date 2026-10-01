-- P12 moderation review helpers. Service-only; no player-facing moderation endpoint.

create or replace function public.gomoku_moderation_queue(p_limit integer default 50)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_limit integer:=greatest(1,least(coalesce(p_limit,50),200)); v_reports jsonb; v_flags jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind','report','targetUsername',r.target_username,'category',r.category,'details',r.details,'roomId',r.room_id,'gameVersion',r.game_version,'status',r.status,'createdAt',r.created_at) order by r.created_at asc),'[]'::jsonb)
  into v_reports from (select * from public.gomoku_fair_play_reports where status in ('open','reviewing') order by created_at asc limit v_limit) r;
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'kind','integrity_flag','roomId',f.room_id,'gameVersion',f.game_version,'flagCode',f.flag_code,'severity',f.severity,'metadata',f.metadata,'status',f.status,'createdAt',f.created_at) order by f.severity desc,f.created_at asc),'[]'::jsonb)
  into v_flags from (select * from public.gomoku_match_integrity_flags where status in ('open','reviewing') order by severity desc,created_at asc limit v_limit) f;
  return jsonb_build_object('reports',v_reports,'flags',v_flags,'generatedAt',now());
end $$;
revoke all on function public.gomoku_moderation_queue(integer) from public,anon,authenticated;
grant execute on function public.gomoku_moderation_queue(integer) to service_role;

create or replace function public.gomoku_review_fair_play_report(p_report_id uuid,p_status text,p_resolution text,p_actor_user_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare r public.gomoku_fair_play_reports%rowtype;
begin
  if p_status not in ('reviewing','resolved','dismissed') then raise exception 'Invalid report review status'; end if;
  if p_status in ('resolved','dismissed') and char_length(trim(coalesce(p_resolution,'')))<3 then raise exception 'Resolution is required'; end if;
  update public.gomoku_fair_play_reports set status=p_status,resolution=case when p_status='reviewing' then resolution else left(trim(p_resolution),500) end,reviewed_at=case when p_status='reviewing' then reviewed_at else now() end where id=p_report_id returning * into r;
  if r.id is null then raise exception 'Report not found'; end if;
  insert into public.gomoku_fair_play_audit_events(event_type,actor_user_id,subject_user_id,room_id,game_version,metadata)
  values('moderation_action',p_actor_user_id,r.target_user_id,r.room_id,r.game_version,jsonb_build_object('reviewKind','report','reportId',r.id,'status',r.status));
  return jsonb_build_object('id',r.id,'status',r.status,'resolution',r.resolution,'reviewedAt',r.reviewed_at);
end $$;
revoke all on function public.gomoku_review_fair_play_report(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.gomoku_review_fair_play_report(uuid,text,text,uuid) to service_role;

create or replace function public.gomoku_review_integrity_flag(p_flag_id bigint,p_status text,p_actor_user_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare f public.gomoku_match_integrity_flags%rowtype;
begin
  if p_status not in ('reviewing','confirmed','dismissed') then raise exception 'Invalid integrity review status'; end if;
  update public.gomoku_match_integrity_flags set status=p_status,reviewed_at=case when p_status in ('confirmed','dismissed') then now() else reviewed_at end where id=p_flag_id returning * into f;
  if f.id is null then raise exception 'Integrity flag not found'; end if;
  insert into public.gomoku_fair_play_audit_events(event_type,actor_user_id,room_id,game_version,metadata)
  values('moderation_action',p_actor_user_id,f.room_id,f.game_version,jsonb_build_object('reviewKind','integrity_flag','flagId',f.id,'flagCode',f.flag_code,'status',f.status));
  return jsonb_build_object('id',f.id,'status',f.status,'reviewedAt',f.reviewed_at);
end $$;
revoke all on function public.gomoku_review_integrity_flag(bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.gomoku_review_integrity_flag(bigint,text,uuid) to service_role;
