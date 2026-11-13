alter table public.tasks add column review_evidence text, add column submitted_by uuid references auth.users(id), add column reviewed_by uuid references auth.users(id), add column published_revision integer;

create function private.vc_review_transition() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); workspace uuid; reviewer_role text;
begin
  if tg_op='INSERT' then
    if new.status in ('DONE','IN_REVIEW') or new.submitted_by is not null or new.reviewed_by is not null or new.published_revision is not null then raise exception 'Create the task before submitting for review.'; end if;
    return new;
  end if;
  if new.status=old.status then return new; end if;
  if new.status='IN_REVIEW' then
    if actor is null or actor is distinct from new.owner_id or new.submitted_by is distinct from actor or nullif(trim(new.review_evidence),'') is null then raise exception 'Claim the task and submit verification evidence first.'; end if;
  elsif new.status='DONE' then
    select workspace_id into workspace from public.projects where id=new.project_id;
    select role into reviewer_role from public.workspace_members where workspace_id=workspace and user_id=actor;
    if old.status <> 'IN_REVIEW' or old.submitted_by is null or coalesce(reviewer_role,'') not in ('owner','lead','reviewer') then raise exception 'Submit evidence and ask a reviewer to accept it.'; end if;
    if old.submitted_by=actor and (reviewer_role <> 'owner' or exists(select 1 from public.workspace_members where workspace_id=workspace and user_id<>actor)) then raise exception 'Ask another reviewer to accept your submission.'; end if;
    update public.projects set context_revision=context_revision+1,updated_at=now() where id=new.project_id returning context_revision into new.published_revision;
    new.reviewed_by := actor;
  else
    new.submitted_by := null;
    new.reviewed_by := null;
    new.published_revision := null;
  end if;
  return new;
end $$;
create trigger vc_review_transition before insert or update of status on public.tasks for each row execute function private.vc_review_transition();

create function public.submit_feature_review(p_task_id uuid,p_expected_version integer,p_pr_url text,p_evidence text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(p_pr_url,'') !~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[1-9][0-9]*$' or coalesce(length(trim(p_evidence)),0) not between 1 and 2000 then raise exception 'Enter a GitHub pull request URL and verification evidence (1–2000 characters).'; end if;
  update public.tasks t set pr_url=p_pr_url,review_evidence=trim(p_evidence),submitted_by=auth.uid(),reviewed_by=null,published_revision=null,status='IN_REVIEW',version=t.version+1,updated_at=now()
  where t.id=p_task_id and t.version=p_expected_version and t.owner_id=auth.uid() and t.status <> 'DONE'
    and exists(select 1 from public.projects p join public.workspace_members m on m.workspace_id=p.workspace_id where p.id=t.project_id and m.user_id=auth.uid());
  if not found then raise exception 'Refresh the board and check that this task is assigned to you.'; end if;
end $$;
revoke all on function public.submit_feature_review(uuid,integer,text,text) from public,anon;
grant execute on function public.submit_feature_review(uuid,integer,text,text) to authenticated;

create or replace function public.update_task_status(p_task_id uuid, p_status text, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_role text;
  v_updated public.tasks%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_status not in ('READY', 'CLAIMED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE') then
    raise exception 'Unsupported task status.' using errcode = '22023';
  end if;
  select t.* into v_task from public.tasks t where t.id = p_task_id for update;
  if not found or not private.vc_is_project_member(v_task.project_id) then
    raise exception 'Task not found or not accessible.' using errcode = '42501';
  end if;
  select wm.role into v_role from public.workspace_members wm
  join public.projects p on p.workspace_id = wm.workspace_id
  where p.id = v_task.project_id and wm.user_id = (select auth.uid());
  if v_role not in ('owner', 'lead', 'reviewer')
      and v_task.owner_id is distinct from (select auth.uid())
      and not (v_task.owner_id is null and p_status = 'CLAIMED') then
    raise exception 'You can only claim an unassigned task or update a task assigned to you.' using errcode = '42501';
  end if;
  if v_task.version <> p_expected_version then
    raise exception 'Task changed in another session. Refresh and try again.' using errcode = '40001';
  end if;
  update public.tasks t set
    status = p_status,
    owner_id = case when p_status = 'CLAIMED' and t.owner_id is null then (select auth.uid()) else t.owner_id end,
    version = t.version + 1,
    updated_at = now()
  where t.id = p_task_id and t.version = p_expected_version
  returning t.* into v_updated;
  if not found then raise exception 'Task changed in another session. Refresh and try again.' using errcode = '40001'; end if;
  return to_jsonb(v_updated);
end;
$$;

create or replace function public.accept_decision(p_decision_id uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_decision public.architecture_decisions%rowtype;
  v_revision integer;
begin
  select d.* into v_decision from public.architecture_decisions d
  where d.id = p_decision_id for update;
  if not found or not private.vc_can_manage_project(v_decision.project_id) then
    raise exception 'Decision not found or manager access required.' using errcode = '42501';
  end if;
  if v_decision.version <> p_expected_version or v_decision.status <> 'PROPOSED' then
    raise exception 'Decision changed in another session. Refresh and try again.' using errcode = '40001';
  end if;
  update public.architecture_decisions d set
    status = 'ACCEPTED', accepted_by = (select auth.uid()), accepted_at = now(),
    version = d.version + 1, updated_at = now()
  where d.id = p_decision_id and d.version = p_expected_version
  returning d.* into v_decision;
  update public.projects p set context_revision = p.context_revision + 1, updated_at = now()
  where p.id = v_decision.project_id returning p.context_revision into v_revision;
  return jsonb_build_object('decision', to_jsonb(v_decision), 'context_revision', v_revision);
end;
$$;

create or replace function public.refresh_task_context(p_task_id uuid, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_revision integer;
begin
  select t.* into v_task from public.tasks t where t.id = p_task_id for update;
  if not found or not private.vc_is_project_member(v_task.project_id) then
    raise exception 'Task not found or not accessible.' using errcode = '42501';
  end if;
  if v_task.owner_id is not null and v_task.owner_id <> (select auth.uid())
     and not private.vc_can_manage_project(v_task.project_id) then
    raise exception 'Only the task owner or a project lead can refresh this context.' using errcode = '42501';
  end if;
  if v_task.version <> p_expected_version then
    raise exception 'Task changed in another session. Refresh and try again.' using errcode = '40001';
  end if;
  select p.context_revision into v_revision from public.projects p where p.id = v_task.project_id;
  update public.tasks t set context_revision_seen = v_revision, version = t.version + 1, updated_at = now()
  where t.id = p_task_id and t.version = p_expected_version returning t.* into v_task;
  return to_jsonb(v_task);
end;
$$;
