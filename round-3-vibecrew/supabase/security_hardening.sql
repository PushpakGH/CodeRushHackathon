create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.vc_is_workspace_member(uuid) set schema private;
alter function public.vc_can_manage_workspace(uuid) set schema private;
alter function public.vc_is_project_member(uuid) set schema private;
alter function public.vc_can_manage_project(uuid) set schema private;
alter function public.vc_log_task_change() set schema private;
alter function public.vc_log_decision_acceptance() set schema private;

revoke all on function private.vc_is_workspace_member(uuid) from public, anon;
revoke all on function private.vc_can_manage_workspace(uuid) from public, anon;
revoke all on function private.vc_is_project_member(uuid) from public, anon;
revoke all on function private.vc_can_manage_project(uuid) from public, anon;
revoke all on function private.vc_log_task_change() from public, anon, authenticated;
revoke all on function private.vc_log_decision_acceptance() from public, anon, authenticated;
grant execute on function private.vc_is_workspace_member(uuid) to authenticated;
grant execute on function private.vc_can_manage_workspace(uuid) to authenticated;
grant execute on function private.vc_is_project_member(uuid) to authenticated;
grant execute on function private.vc_can_manage_project(uuid) to authenticated;

revoke execute on function public.create_workspace(text, text, text, text) from public, anon;
revoke execute on function public.create_workspace_invite(uuid, text, text) from public, anon;
revoke execute on function public.join_workspace(text, text) from public, anon;
revoke execute on function public.update_task_status(uuid, text, integer) from public, anon;
revoke execute on function public.accept_decision(uuid, integer) from public, anon;
revoke execute on function public.refresh_task_context(uuid, integer) from public, anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.create_workspace_invite(uuid, text, text) to authenticated;
grant execute on function public.join_workspace(text, text) to authenticated;
grant execute on function public.update_task_status(uuid, text, integer) to authenticated;
grant execute on function public.accept_decision(uuid, integer) to authenticated;
grant execute on function public.refresh_task_context(uuid, integer) to authenticated;

create policy workspace_invites_deny_direct_access on public.workspace_invites
for all to anon, authenticated using (false) with check (false);

create index if not exists workspaces_created_by_idx on public.workspaces(created_by);
create index if not exists projects_created_by_idx on public.projects(created_by);
create index if not exists tasks_owner_idx on public.tasks(owner_id);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists decisions_author_idx on public.architecture_decisions(author_id);
create index if not exists decisions_accepted_by_idx on public.architecture_decisions(accepted_by);
create index if not exists activity_actor_idx on public.activity_events(actor_id);
create index if not exists release_checks_updated_by_idx on public.release_checks(updated_by);
create index if not exists workspace_invites_created_by_idx on public.workspace_invites(created_by);
