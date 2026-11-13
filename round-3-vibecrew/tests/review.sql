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
