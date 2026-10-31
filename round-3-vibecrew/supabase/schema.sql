-- VibeCrew hosted collaboration schema. Applied to the dedicated hackathon project.
create sequence public.vibecrew_task_number_seq start with 1;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 48),
  role text not null default 'member' check (role in ('owner', 'lead', 'member', 'reviewer')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  objective text not null default '' check (char_length(objective) <= 2000),
  repository_url text not null default '' check (char_length(repository_url) <= 500),
  lifecycle_stage text not null default 'Discovery' check (lifecycle_stage in ('Discovery', 'Design', 'Implementation', 'Release')),
  context_revision integer not null default 1 check (context_revision >= 1),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_workspace_idx on public.projects(workspace_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_key text not null unique default ('VBC-' || lpad(nextval('public.vibecrew_task_number_seq')::text, 3, '0')),
  title text not null check (char_length(btrim(title)) between 1 and 90),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'READY' check (status in ('READY', 'CLAIMED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE')),
  priority text not null default 'P1' check (priority in ('P0', 'P1', 'P2')),
  owner_id uuid references auth.users(id) on delete set null,
  scope text[] not null default '{}' check (cardinality(scope) <= 20),
  dependencies text[] not null default '{}' check (cardinality(dependencies) <= 20),
  acceptance text not null default '' check (char_length(acceptance) <= 2000),
  test_plan text not null default '' check (char_length(test_plan) <= 2000),
  branch text not null default '' check (char_length(branch) <= 250),
  pr_url text not null default '' check (char_length(pr_url) <= 500),
  context_revision_seen integer not null default 1 check (context_revision_seen >= 1),
  version integer not null default 1 check (version >= 1),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, task_key)
);
create index tasks_project_status_idx on public.tasks(project_id, status, priority);
create index tasks_project_owner_idx on public.tasks(project_id, owner_id);

create table public.architecture_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  decision_key text not null check (char_length(btrim(decision_key)) between 3 and 24),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  context text not null default '' check (char_length(context) <= 2000),
  decision text not null check (char_length(btrim(decision)) between 1 and 4000),
  consequence text not null default '' check (char_length(consequence) <= 2000),
  status text not null default 'PROPOSED' check (status in ('PROPOSED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED')),
  version integer not null default 1 check (version >= 1),
  author_id uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, decision_key)
);
create index decisions_project_status_idx on public.architecture_decisions(project_id, status);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 40),
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id uuid,
  summary text not null check (char_length(summary) between 1 and 240),
  created_at timestamptz not null default now()
);
create index activity_project_created_idx on public.activity_events(project_id, created_at desc);

create table public.release_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  check_key text not null check (char_length(check_key) between 1 and 40),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  detail text not null default '' check (char_length(detail) <= 500),
  status text not null default 'NOT_TESTED' check (status in ('NOT_TESTED', 'VERIFIED', 'FAILED')),
  evidence text not null default '' check (char_length(evidence) <= 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (project_id, check_key)
);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  role text not null default 'member' check (role in ('member', 'reviewer')),
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  max_uses integer not null default 10 check (max_uses between 1 and 50),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index workspace_invites_workspace_idx on public.workspace_invites(workspace_id, expires_at);

create or replace function public.vc_is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.vc_can_manage_workspace(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'lead')
  );
$$;

create or replace function public.vc_is_project_member(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = p_project_id and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.vc_can_manage_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = p_project_id and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'lead')
  );
$$;

create or replace function public.vc_log_task_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_summary text;
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'task_created';
    v_summary := 'Created ' || new.task_key || ' · ' || new.title;
  elsif old.status is distinct from new.status or old.owner_id is distinct from new.owner_id then
    v_event_type := 'task_updated';
    v_summary := 'Updated ' || new.task_key || ' · ' || new.title || ' (' || new.status || ')';
  else
    return new;
  end if;
  insert into public.activity_events(project_id, actor_id, event_type, entity_type, entity_id, summary)
  values (new.project_id, (select auth.uid()), v_event_type, 'task', new.id, v_summary);
  return new;
end;
$$;
create trigger tasks_activity_trigger after insert or update on public.tasks
for each row execute function public.vc_log_task_change();

create or replace function public.vc_log_decision_acceptance()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status = 'ACCEPTED' then
    insert into public.activity_events(project_id, actor_id, event_type, entity_type, entity_id, summary)
    values (new.project_id, (select auth.uid()), 'decision_accepted', 'decision', new.id,
      'Accepted ' || new.decision_key || ' · ' || new.title);
  end if;
  return new;
end;
$$;
create trigger decisions_activity_trigger after update on public.architecture_decisions
for each row execute function public.vc_log_decision_acceptance();

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
  insert into public.release_checks(project_id, check_key, title, detail)
  values
    (v_project_id, 'build', 'Production build succeeds', 'Capture the exact command and output.'),
    (v_project_id, 'journey', 'Critical user journey works', 'Workspace → task → context → progress.'),
    (v_project_id, 'isolation', 'Workspace access is isolated', 'Verify a different member cannot read this workspace.'),
    (v_project_id, 'claim', 'Concurrent task claim is safe', 'Only one simultaneous claim can win.'),
    (v_project_id, 'mobile', 'Phone layout is usable', 'Check navigation, board, and context export.'),
    (v_project_id, 'deploy', 'Preview deployment is smoke-tested', 'Open the deployed URL and check the main flow.'),
    (v_project_id, 'handoff', 'Limitations and demo handoff are clear', 'Name unverified capabilities and next steps.');
  return jsonb_build_object('workspace_id', v_workspace_id, 'project_id', v_project_id);
end;
$$;

create or replace function public.create_workspace_invite(p_workspace_id uuid, p_token_hash text, p_role text default 'member')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if (select auth.uid()) is null or not public.vc_can_manage_workspace(p_workspace_id) then
    raise exception 'Workspace manager access required.' using errcode = '42501';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' or p_role not in ('member', 'reviewer') then
    raise exception 'Invalid invitation request.' using errcode = '22023';
  end if;
  insert into public.workspace_invites(workspace_id, token_hash, role, created_by, expires_at)
  values (p_workspace_id, p_token_hash, p_role, (select auth.uid()), v_expires_at)
  returning id into v_id;
  return jsonb_build_object('invite_id', v_id, 'expires_at', v_expires_at, 'max_uses', 10);
end;
$$;

create or replace function public.join_workspace(p_token_hash text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_project_id uuid;
  v_role text;
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_user_id is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' or char_length(v_name) not between 1 and 48 then
    raise exception 'Invitation or display name is invalid.' using errcode = '22023';
  end if;
  select * into v_invite from public.workspace_invites wi
  where wi.token_hash = p_token_hash and wi.revoked_at is null and wi.expires_at > now()
    and wi.used_count < wi.max_uses
  for update;
  if not found then raise exception 'This invitation is invalid, expired, revoked, or full.' using errcode = '22023'; end if;

  select p.id into v_project_id from public.projects p
  where p.workspace_id = v_invite.workspace_id order by p.created_at limit 1;
  if v_project_id is null then raise exception 'This workspace has no active project.' using errcode = '22023'; end if;

  if exists (select 1 from public.workspace_members wm where wm.workspace_id = v_invite.workspace_id and wm.user_id = v_user_id) then
    return jsonb_build_object('workspace_id', v_invite.workspace_id, 'project_id', v_project_id, 'already_member', true);
  end if;

  insert into public.workspace_members(workspace_id, user_id, display_name, role)
  values (v_invite.workspace_id, v_user_id, v_name, v_invite.role);
  update public.workspace_invites set used_count = used_count + 1 where id = v_invite.id;
  return jsonb_build_object('workspace_id', v_invite.workspace_id, 'project_id', v_project_id, 'already_member', false);
end;
$$;

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
  if not found or not public.vc_is_project_member(v_task.project_id) then
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
  if not found or not public.vc_can_manage_project(v_decision.project_id) then
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
  if not found or not public.vc_is_project_member(v_task.project_id) then
    raise exception 'Task not found or not accessible.' using errcode = '42501';
  end if;
  if v_task.owner_id is not null and v_task.owner_id <> (select auth.uid())
     and not public.vc_can_manage_project(v_task.project_id) then
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

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.architecture_decisions enable row level security;
alter table public.activity_events enable row level security;
alter table public.release_checks enable row level security;
alter table public.workspace_invites enable row level security;

create policy workspace_read_member on public.workspaces for select to authenticated
using (public.vc_is_workspace_member(id));
create policy workspace_update_manager on public.workspaces for update to authenticated
using (public.vc_can_manage_workspace(id)) with check (public.vc_can_manage_workspace(id));

create policy workspace_members_read_member on public.workspace_members for select to authenticated
using (public.vc_is_workspace_member(workspace_id));

create policy projects_read_member on public.projects for select to authenticated
using (public.vc_is_workspace_member(workspace_id));
create policy projects_update_manager on public.projects for update to authenticated
using (public.vc_can_manage_workspace(workspace_id)) with check (public.vc_can_manage_workspace(workspace_id));

create policy tasks_read_member on public.tasks for select to authenticated
using (public.vc_is_project_member(project_id));
create policy tasks_insert_member on public.tasks for insert to authenticated
with check (public.vc_can_manage_project(project_id) and created_by = (select auth.uid()));
create policy tasks_update_owner_or_manager on public.tasks for update to authenticated
using (public.vc_can_manage_project(project_id) or owner_id = (select auth.uid()))
with check (public.vc_can_manage_project(project_id) or owner_id = (select auth.uid()));
create policy tasks_delete_manager on public.tasks for delete to authenticated
using (public.vc_can_manage_project(project_id));

create policy decisions_read_member on public.architecture_decisions for select to authenticated
using (public.vc_is_project_member(project_id));
create policy decisions_insert_manager on public.architecture_decisions for insert to authenticated
with check (public.vc_can_manage_project(project_id) and author_id = (select auth.uid()));

create policy activity_read_member on public.activity_events for select to authenticated
using (public.vc_is_project_member(project_id));

create policy release_checks_read_member on public.release_checks for select to authenticated
using (public.vc_is_project_member(project_id));
create policy release_checks_insert_manager on public.release_checks for insert to authenticated
with check (public.vc_can_manage_project(project_id));
create policy release_checks_update_manager on public.release_checks for update to authenticated
using (public.vc_can_manage_project(project_id)) with check (public.vc_can_manage_project(project_id));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.workspaces, public.workspace_members, public.projects, public.tasks,
  public.architecture_decisions, public.activity_events, public.release_checks to authenticated;
grant insert on public.tasks, public.architecture_decisions, public.release_checks to authenticated;
grant update on public.workspaces, public.projects, public.tasks, public.release_checks to authenticated;
grant delete on public.tasks to authenticated;
grant usage, select on sequence public.vibecrew_task_number_seq to authenticated;

revoke all on function public.vc_is_workspace_member(uuid) from public;
revoke all on function public.vc_can_manage_workspace(uuid) from public;
revoke all on function public.vc_is_project_member(uuid) from public;
revoke all on function public.vc_can_manage_project(uuid) from public;
grant execute on function public.vc_is_workspace_member(uuid) to authenticated;
grant execute on function public.vc_can_manage_workspace(uuid) to authenticated;
grant execute on function public.vc_is_project_member(uuid) to authenticated;
grant execute on function public.vc_can_manage_project(uuid) to authenticated;

revoke all on function public.create_workspace(text, text, text, text) from public;
revoke all on function public.create_workspace_invite(uuid, text, text) from public;
revoke all on function public.join_workspace(text, text) from public;
revoke all on function public.update_task_status(uuid, text, integer) from public;
revoke all on function public.accept_decision(uuid, integer) from public;
revoke all on function public.refresh_task_context(uuid, integer) from public;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.create_workspace_invite(uuid, text, text) to authenticated;
grant execute on function public.join_workspace(text, text) to authenticated;
grant execute on function public.update_task_status(uuid, text, integer) to authenticated;
grant execute on function public.accept_decision(uuid, integer) to authenticated;
grant execute on function public.refresh_task_context(uuid, integer) to authenticated;
