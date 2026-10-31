-- Keep invite creation aligned with the private helper introduced by
-- 20261031104310_vibecrew_security_hardening.sql.
create or replace function public.create_workspace_invite(
  p_workspace_id uuid,
  p_token_hash text,
  p_role text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not private.vc_can_manage_workspace(p_workspace_id) then
    raise exception 'Workspace manager access required.' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
      or p_role is null or p_role not in ('member', 'reviewer') then
    raise exception 'Invalid invitation request.' using errcode = '22023';
  end if;

  insert into public.workspace_invites(workspace_id, token_hash, role, created_by, expires_at)
  values (p_workspace_id, p_token_hash, p_role, (select auth.uid()), v_expires_at)
  returning id into v_id;
  return jsonb_build_object('invite_id', v_id, 'expires_at', v_expires_at, 'max_uses', 10);
end;
$$;

revoke all on function public.create_workspace_invite(uuid, text, text) from public, anon;
grant execute on function public.create_workspace_invite(uuid, text, text) to authenticated;
