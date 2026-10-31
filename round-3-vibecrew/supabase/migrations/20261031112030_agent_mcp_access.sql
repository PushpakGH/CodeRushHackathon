create table public.agent_access_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null default auth.uid(),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint agent_access_tokens_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '90 days'),
  constraint agent_access_tokens_workspace_member_fkey
    foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id)
    on delete cascade
);

create index agent_access_tokens_user_workspace_idx
  on public.agent_access_tokens (user_id, workspace_id, created_at desc);

alter table public.agent_access_tokens enable row level security;
revoke all on public.agent_access_tokens from public, anon, authenticated;
grant select (id, workspace_id, label, created_at, expires_at, revoked_at)
  on public.agent_access_tokens to authenticated;
grant insert (workspace_id, label, token_hash, expires_at)
  on public.agent_access_tokens to authenticated;
grant update (revoked_at) on public.agent_access_tokens to authenticated;
grant all on public.agent_access_tokens to service_role;

create policy agent_access_tokens_select_own
  on public.agent_access_tokens for select to authenticated
  using (user_id = (select auth.uid()) and private.vc_is_workspace_member(workspace_id));

create policy agent_access_tokens_insert_own
  on public.agent_access_tokens for insert to authenticated
  with check (user_id = (select auth.uid()) and private.vc_is_workspace_member(workspace_id));

create policy agent_access_tokens_revoke_own
  on public.agent_access_tokens for update to authenticated
  using (user_id = (select auth.uid()) and private.vc_is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and private.vc_is_workspace_member(workspace_id));
