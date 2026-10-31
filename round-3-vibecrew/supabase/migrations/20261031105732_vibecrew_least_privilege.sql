create or replace function private.vc_validate_task_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null and not exists (
    select 1
    from public.workspace_members wm
    join public.projects p on p.workspace_id = wm.workspace_id
    where p.id = new.project_id and wm.user_id = new.owner_id
  ) then
    raise exception 'Task owner must be an active member of this workspace.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.vc_validate_task_owner() from public, anon, authenticated;
drop trigger if exists tasks_validate_owner on public.tasks;
create trigger tasks_validate_owner
before insert or update of project_id, owner_id on public.tasks
for each row execute function private.vc_validate_task_owner();

create or replace function private.vc_stamp_release_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.vc_stamp_release_check() from public, anon, authenticated;
drop trigger if exists release_checks_stamp_update on public.release_checks;
create trigger release_checks_stamp_update
before update on public.release_checks
for each row execute function private.vc_stamp_release_check();

revoke update on public.workspaces, public.projects, public.tasks, public.release_checks from authenticated;
grant update (status) on public.release_checks to authenticated;

drop policy if exists workspace_update_manager on public.workspaces;
drop policy if exists projects_update_manager on public.projects;
drop policy if exists tasks_update_owner_or_manager on public.tasks;
drop policy if exists release_checks_update_manager on public.release_checks;
create policy release_checks_update_manager on public.release_checks
for update to authenticated
using (private.vc_can_manage_project(project_id))
with check (
  private.vc_can_manage_project(project_id)
  and updated_by = (select auth.uid())
);
