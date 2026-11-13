create table public.project_documents (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 kind text not null check(kind in ('plan','architecture','frontend','backend','instructions')),
 title text not null check(length(trim(title)) between 1 and 120),
 body text not null check(length(trim(body)) between 1 and 50000),
 version integer not null default 1,
 published_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(project_id,kind)
);
alter table public.project_documents enable row level security;
grant select on public.project_documents to authenticated;
grant all on public.project_documents to service_role;
create policy documents_read on public.project_documents for select to authenticated using (private.vc_is_project_member(project_id));

create function public.publish_project_document(p_project_id uuid,p_kind text,p_title text,p_body text,p_expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_document public.project_documents;
begin
 if auth.uid() is null or not private.vc_can_manage_project(p_project_id) then raise exception 'Only an owner or lead can publish project context.' using errcode='42501'; end if;
 if p_expected_version is null or p_expected_version < 0 then raise exception 'Read the current document version before publishing.'; end if;
 perform 1 from public.projects where id=p_project_id for update;
 select * into v_document from public.project_documents where project_id=p_project_id and kind=p_kind;
 if coalesce(v_document.version,0) <> p_expected_version then raise exception 'Context changed. Refresh and review the latest document before publishing.' using errcode='40001'; end if;
 insert into public.project_documents(project_id,kind,title,body,published_by) values(p_project_id,p_kind,trim(p_title),p_body,auth.uid())
 on conflict(project_id,kind) do update set title=excluded.title,body=excluded.body,published_by=excluded.published_by,version=project_documents.version+1,updated_at=now();
 update public.projects set context_revision=context_revision+1,updated_at=now() where id=p_project_id;
 insert into public.activity_events(project_id,actor_id,event_type,entity_type,entity_id,summary) values(p_project_id,auth.uid(),'context_published','project',p_project_id,'Published '||p_kind||' context');
end $$;
revoke all on function public.publish_project_document(uuid,text,text,text,integer) from public,anon;
grant execute on function public.publish_project_document(uuid,text,text,text,integer) to authenticated;

alter table public.agent_access_tokens add column allow_progress boolean not null default false;
grant insert(allow_progress) on public.agent_access_tokens to authenticated;
create function public.agent_update_task(p_token_hash text,p_task_key text,p_expected_version integer,p_status text,p_pr_url text default '',p_evidence text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token public.agent_access_tokens; v_task public.tasks; v_result jsonb;
begin
 select * into v_token from public.agent_access_tokens where token_hash=p_token_hash and revoked_at is null and expires_at>now() and allow_progress;
 if not found or not exists(select 1 from public.workspace_members where workspace_id=v_token.workspace_id and user_id=v_token.user_id) then raise exception 'Token is invalid or progress updates are disabled.' using errcode='42501'; end if;
 select t.* into v_task from public.tasks t join public.projects p on p.id=t.project_id where t.task_key=p_task_key and p.workspace_id=v_token.workspace_id for update of t;
 if not found or (v_task.owner_id is distinct from v_token.user_id and not(v_task.owner_id is null and p_status='CLAIMED')) then raise exception 'Claim an unassigned task or update your own task.' using errcode='42501'; end if;
 if p_status not in ('CLAIMED','IN_PROGRESS','BLOCKED','IN_REVIEW') then raise exception 'Agents may claim, start, block or submit for review. Ask a reviewer to accept completion.'; end if;
 perform set_config('request.jwt.claim.sub',v_token.user_id::text,true);
 if p_status='IN_REVIEW' then
  perform public.submit_feature_review(v_task.id,p_expected_version,p_pr_url,p_evidence);
 else
  perform public.update_task_status(v_task.id,p_status,p_expected_version);
 end if;
 select jsonb_build_object('taskKey',task_key,'status',status,'version',version) into v_result from public.tasks where id=v_task.id;
 return v_result;
end $$;
revoke all on function public.agent_update_task(text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.agent_update_task(text,text,integer,text,text,text) to service_role;

create or replace function public.create_workspace(p_workspace_name text, p_project_name text, p_objective text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace_id uuid;
  v_project_id uuid;
  v_display_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_user_id is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_workspace_name, ''))) not between 2 and 80 then raise exception 'Workspace name must be 2–80 characters.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_project_name, ''))) not between 2 and 80 then raise exception 'Project name must be 2–80 characters.' using errcode = '22023'; end if;
  if char_length(coalesce(p_objective, '')) > 2000 then raise exception 'Project objective must be at most 2000 characters.' using errcode = '22023'; end if;
  if char_length(v_display_name) not between 1 and 48 then raise exception 'Your display name must be 1–48 characters.' using errcode = '22023'; end if;

  insert into public.workspaces(name, created_by) values (btrim(p_workspace_name), v_user_id) returning id into v_workspace_id;
  insert into public.workspace_members(workspace_id, user_id, display_name, role)
  values (v_workspace_id, v_user_id, v_display_name, 'owner');
  insert into public.projects(workspace_id, name, objective, created_by)
  values (v_workspace_id, btrim(p_project_name), btrim(coalesce(p_objective, '')), v_user_id)
  returning id into v_project_id;
  return jsonb_build_object('workspace_id', v_workspace_id, 'project_id', v_project_id);
end;
$$;

