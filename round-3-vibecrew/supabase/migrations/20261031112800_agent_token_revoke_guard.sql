create index if not exists agent_access_tokens_workspace_user_idx
  on public.agent_access_tokens (workspace_id, user_id);

drop policy if exists agent_access_tokens_revoke_own on public.agent_access_tokens;
create policy agent_access_tokens_revoke_own
  on public.agent_access_tokens for update to authenticated
  using (user_id = (select auth.uid()) and private.vc_is_workspace_member(workspace_id))
  with check (
    user_id = (select auth.uid())
    and private.vc_is_workspace_member(workspace_id)
    and revoked_at is not null
    and revoked_at <= statement_timestamp()
  );
