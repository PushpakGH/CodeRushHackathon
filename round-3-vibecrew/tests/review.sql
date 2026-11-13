begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); t uuid:=gen_random_uuid();
begin
insert into auth.users values(a),(b);
insert into workspaces(id,name,created_by) values(w,'Review team',a);
insert into workspace_members(workspace_id,user_id,display_name,role) values(w,a,'Owner','owner'),(w,b,'Developer','member');
insert into projects(id,workspace_id,name,created_by) values(p,w,'Product',a);
insert into tasks(id,project_id,title,owner_id,created_by) values(t,p,'Feature',b,a);
set local role authenticated;
perform set_config('test.uid',b::text,true);
begin
perform public.submit_feature_review(t,1,'https://untrusted.example/pull/1','Checks passed');
raise exception 'unexpected invalid URL acceptance';
exception when raise_exception then
if sqlerrm not like 'Enter a GitHub pull request URL%' then raise; end if;
end;
perform public.submit_feature_review(t,1,'https://github.com/example/product/pull/1','Integration check passed');
begin
perform public.update_task_status(t,'DONE',2);
raise exception 'unexpected self approval';
exception when raise_exception then
if sqlerrm <> 'Submit evidence and ask a reviewer to accept it.' then raise; end if;
end;
perform set_config('test.uid',a::text,true);
perform public.update_task_status(t,'DONE',2);
begin
perform public.update_task_status(t,'DONE',2);
raise exception 'unexpected duplicate approval';
exception when serialization_failure then null;
end;
if (select context_revision from projects where id=p) <> 2 or (select reviewed_by from tasks where id=t) is distinct from a then raise exception 'publication mismatch'; end if;
perform set_config('test.uid',gen_random_uuid()::text,true);
if exists(select 1 from tasks where id=t) then raise exception 'outsider read task'; end if;
begin
perform public.update_task_status(t,'DONE',3);
raise exception 'unexpected outsider approval';
exception when insufficient_privilege then null;
end;
reset role;
end $$;
rollback;
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); w uuid; p uuid; t uuid; key text; setup jsonb;
begin
insert into auth.users(id) values(a),(b);
set local role authenticated;
perform set_config('test.uid',a::text,true);
setup := public.create_workspace('Empty workspace','New product','Real objective','Owner');
w := (setup->>'workspace_id')::uuid; p := (setup->>'project_id')::uuid;
if exists(select 1 from tasks where project_id=p) or exists(select 1 from release_checks where project_id=p) or exists(select 1 from project_documents where project_id=p) then raise exception 'Workspace was seeded'; end if;
perform public.publish_project_document(p,'plan','Plan','Build the real product',0);
begin
perform public.publish_project_document(p,'plan','Plan','Stale overwrite',0);
raise exception 'stale document accepted';
exception when serialization_failure then null;
end;
if (select context_revision from projects where id=p)<>2 then raise exception 'Document publication did not advance revision'; end if;
reset role;
insert into workspace_members(workspace_id,user_id,display_name,role) values(w,b,'Member','member');
insert into tasks(project_id,title,created_by) values(p,'Agent task',a) returning id,task_key into t,key;
perform set_config('test.uid',b::text,true);
set local role authenticated;
begin
perform public.publish_project_document(p,'backend','Backend','Member overwrite',0);
raise exception 'member published';
exception when insufficient_privilege then null;
end;
reset role;
insert into agent_access_tokens(workspace_id,user_id,label,token_hash,expires_at,allow_progress) values(w,b,'Progress',repeat('a',64),now()+interval '1 day',true),(w,b,'Read only',repeat('b',64),now()+interval '1 day',false);
set local role service_role;
begin
perform public.agent_update_task(repeat('b',64),key,1,'CLAIMED');
raise exception 'read-only write accepted';
exception when insufficient_privilege then null;
end;
perform public.agent_update_task(repeat('a',64),key,1,'CLAIMED');
perform public.agent_update_task(repeat('a',64),key,2,'IN_PROGRESS');
begin
perform public.agent_update_task(repeat('a',64),key,2,'BLOCKED');
raise exception 'stale task update accepted';
exception when serialization_failure then null;
end;
reset role;
if (select owner_id from tasks where id=t) is distinct from b then raise exception 'Agent claim owner incorrect'; end if;
end $$;
rollback;
