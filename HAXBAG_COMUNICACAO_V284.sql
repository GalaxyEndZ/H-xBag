-- HäxBag V284 · Comunicação: servidores, canais, mensagens e anexos privados.
-- Execute uma vez no SQL Editor do Supabase, como proprietário do banco.
-- Não altera o banco do Social, as fichas ou as tabelas de RPG.
begin;
create extension if not exists pgcrypto;

create table if not exists public.hax_v284_servers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text not null default '' check (char_length(description)<=500),
  icon text not null default '✦' check (char_length(icon)<=12),
  created_at timestamptz not null default now()
);
create table if not exists public.hax_v284_members (
  server_id uuid not null references public.hax_v284_servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','mod','member')),
  joined_at timestamptz not null default now(),
  primary key(server_id,user_id)
);
create table if not exists public.hax_v284_channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.hax_v284_servers(id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  topic text not null default '' check (char_length(topic)<=350),
  staff_only boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(server_id,name)
);
create table if not exists public.hax_v284_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.hax_v284_channels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '' check(char_length(content)<=4000),
  reply_to uuid references public.hax_v284_messages(id) on delete set null,
  attachment_path text,
  attachment_name text,
  is_deleted boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint hax_v284_message_content check (is_deleted or char_length(btrim(content))>0 or attachment_path is not null),
  constraint hax_v284_file_pair check ((attachment_path is null)=(attachment_name is null))
);
create index if not exists hax_v284_messages_channel_time on public.hax_v284_messages(channel_id,created_at desc);
create table if not exists public.hax_v284_reactions (
  message_id uuid not null references public.hax_v284_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check(emoji in ('❤️','😂','🔥','✨','👍','🎲','⚔️','👏')),
  created_at timestamptz not null default now(),
  primary key(message_id,user_id,emoji)
);
create table if not exists public.hax_v284_invites (
  code text primary key default encode(gen_random_bytes(9),'hex'),
  server_id uuid not null references public.hax_v284_servers(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  max_uses integer check(max_uses between 1 and 1000),
  uses integer not null default 0 check(uses>=0),
  revoked boolean not null default false
);
create table if not exists public.hax_v284_reads (
  channel_id uuid not null references public.hax_v284_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(channel_id,user_id)
);

create or replace function public.hax_v284_server_member(p_server uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.hax_v284_members m where m.server_id=p_server and m.user_id=(select auth.uid())
  );
$$;
create or replace function public.hax_v284_server_staff(p_server uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.hax_v284_members m where m.server_id=p_server
    and m.user_id=(select auth.uid()) and m.role in ('owner','admin','mod')
  );
$$;
create or replace function public.hax_v284_channel_readable(p_channel uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.hax_v284_channels c
    join public.hax_v284_members m on m.server_id=c.server_id
    where c.id=p_channel and m.user_id=(select auth.uid())
    and (not c.staff_only or m.role in ('owner','admin','mod')));
$$;
create or replace function public.hax_v284_message_readable(p_message uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.hax_v284_messages x
    where x.id=p_message and public.hax_v284_channel_readable(x.channel_id));
$$;
create or replace function public.hax_v284_message_staff(p_message uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.hax_v284_messages x
    join public.hax_v284_channels c on c.id=x.channel_id
    where x.id=p_message and public.hax_v284_server_staff(c.server_id));
$$;

create or replace function public.hax_v284_seed_server()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.hax_v284_members(server_id,user_id,role) values(new.id,new.owner_id,'owner');
  insert into public.hax_v284_channels(server_id,name,topic,sort_order)
  values(new.id,'geral','Boas-vindas ao servidor!',0), (new.id,'avisos','Avisos e novidades do servidor.',1);
  return new;
end;
$$;
drop trigger if exists hax_v284_server_seed on public.hax_v284_servers;
create trigger hax_v284_server_seed after insert on public.hax_v284_servers
for each row execute function public.hax_v284_seed_server();

create or replace function public.hax_v284_guard_server()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.owner_id <> old.owner_id or new.created_at <> old.created_at then
    raise exception 'A autoria do servidor não pode ser alterada.';
  end if;
  return new;
end;
$$;
drop trigger if exists hax_v284_guard_server on public.hax_v284_servers;
create trigger hax_v284_guard_server before update on public.hax_v284_servers
for each row execute function public.hax_v284_guard_server();

-- Canais não podem mudar de servidor: isso impede que o histórico seja revelado a outro grupo.
create or replace function public.hax_v284_guard_channel()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.server_id is distinct from old.server_id or new.id is distinct from old.id then
    raise exception 'Não é permitido transferir canais entre servidores';
  end if;
  return new;
end;
$$;
drop trigger if exists hax_v284_guard_channel on public.hax_v284_channels;
create trigger hax_v284_guard_channel before update on public.hax_v284_channels
for each row execute function public.hax_v284_guard_channel();

create or replace function public.hax_v284_guard_message()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_server uuid;
begin
  if tg_op='INSERT' then
    if new.author_id<>(select auth.uid()) then raise exception 'Autor inválido'; end if;
    new.created_at:=now();
    if new.reply_to is not null and not exists(
      select 1 from public.hax_v284_messages r where r.id=new.reply_to and r.channel_id=new.channel_id and not r.is_deleted
    ) then raise exception 'Resposta deve pertencer ao mesmo canal'; end if;
    if new.attachment_path is not null then
      select server_id into v_server from public.hax_v284_channels where id=new.channel_id;
      if left(new.attachment_path,length(v_server::text || '/' || new.channel_id::text || '/' || new.author_id::text || '/')) <> v_server::text || '/' || new.channel_id::text || '/' || new.author_id::text || '/' then
        raise exception 'Anexo não pertence à mensagem';
      end if;
    end if;
    if new.pinned or new.is_deleted or new.edited_at is not null then raise exception 'Estado inicial inválido'; end if;
    if (select count(*) from public.hax_v284_messages m where m.author_id=new.author_id and m.created_at > now()-interval '6 seconds') >= 8 then
      raise exception 'Muitas mensagens em sequência. Tente novamente.';
    end if;
  else
    if new.channel_id is distinct from old.channel_id or new.author_id is distinct from old.author_id
      or new.created_at is distinct from old.created_at or new.reply_to is distinct from old.reply_to
      or new.attachment_path is distinct from old.attachment_path or new.attachment_name is distinct from old.attachment_name then
      raise exception 'Os metadados da mensagem não podem ser alterados';
    end if;
    if old.is_deleted and not new.is_deleted then raise exception 'Não é possível restaurar mensagem excluída'; end if;
    new.edited_at:=old.edited_at;
    if new.content is distinct from old.content then
      if old.is_deleted or (select auth.uid())<>old.author_id then raise exception 'Somente o autor pode editar a mensagem'; end if;
      new.edited_at:=now();
    end if;
    if new.pinned is distinct from old.pinned and not public.hax_v284_message_staff(old.id) then
      raise exception 'Somente a equipe pode fixar mensagens';
    end if;
    if new.is_deleted and not old.is_deleted then
      if (select auth.uid())<>old.author_id and not public.hax_v284_message_staff(old.id) then
        raise exception 'Sem permissão para remover mensagem';
      end if;
      new.content:='';
      new.pinned:=false;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists hax_v284_guard_message on public.hax_v284_messages;
create trigger hax_v284_guard_message before insert or update on public.hax_v284_messages
for each row execute function public.hax_v284_guard_message();

create or replace function public.hax_v284_join_invite(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.hax_v284_invites%rowtype; v_added integer;
begin
  if (select auth.uid()) is null then raise exception 'Faça login'; end if;
  select * into v from public.hax_v284_invites where code=lower(btrim(p_code)) for update;
  if not found or v.revoked or v.expires_at<=now() or (v.max_uses is not null and v.uses>=v.max_uses) then
    raise exception 'Convite inválido ou expirado';
  end if;
  insert into public.hax_v284_members(server_id,user_id,role)
  values(v.server_id,(select auth.uid()),'member') on conflict do nothing;
  get diagnostics v_added=row_count;
  if v_added=1 then update public.hax_v284_invites set uses=uses+1 where code=v.code; end if;
  return v.server_id;
end;
$$;
create or replace function public.hax_v284_revoke_invite(p_code text)
returns void language plpgsql security definer set search_path='' as $$
declare v_server uuid;
begin
  select server_id into v_server from public.hax_v284_invites where code=p_code;
  if v_server is null or not public.hax_v284_server_staff(v_server) then
    raise exception 'Sem permissão para revogar convite';
  end if;
  update public.hax_v284_invites set revoked=true where code=p_code;
end;
$$;
create or replace function public.hax_v284_set_role(p_server uuid,p_user uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare actor_role text; target_role text;
begin
  select role into actor_role from public.hax_v284_members where server_id=p_server and user_id=(select auth.uid());
  select role into target_role from public.hax_v284_members where server_id=p_server and user_id=p_user;
  if actor_role not in ('owner','admin') or target_role is null or target_role='owner'
    or p_role not in ('member','mod','admin') or (actor_role='admin' and (target_role='admin' or p_role='admin')) then
    raise exception 'Sem permissão para alterar o cargo';
  end if;
  update public.hax_v284_members set role=p_role where server_id=p_server and user_id=p_user;
end;
$$;

create or replace function public.hax_v284_kick_member(p_server uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor_role text; target_role text;
begin
  if p_user=(select auth.uid()) then raise exception 'Use a opção Sair para deixar o servidor'; end if;
  select role into actor_role from public.hax_v284_members where server_id=p_server and user_id=(select auth.uid());
  select role into target_role from public.hax_v284_members where server_id=p_server and user_id=p_user;
  if target_role is null or target_role='owner' or
    (actor_role='mod' and target_role<>'member') or
    (actor_role='admin' and target_role='admin') or actor_role not in ('owner','admin','mod') then
    raise exception 'Sem permissão para remover este membro';
  end if;
  delete from public.hax_v284_members where server_id=p_server and user_id=p_user;
end;
$$;
create or replace function public.hax_v284_can_read_file(p_path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_server text; v_channel text;
begin
  v_server:=split_part(p_path,'/',1); v_channel:=split_part(p_path,'/',2);
  if v_server !~ '^[a-f0-9-]{36}$' or v_channel !~ '^[a-f0-9-]{36}$' then return false; end if;
  return exists(select 1 from public.hax_v284_channels c where c.id=v_channel::uuid and c.server_id=v_server::uuid
    and public.hax_v284_channel_readable(c.id));
end;
$$;

alter table public.hax_v284_servers enable row level security;
alter table public.hax_v284_members enable row level security;
alter table public.hax_v284_channels enable row level security;
alter table public.hax_v284_messages enable row level security;
alter table public.hax_v284_reactions enable row level security;
alter table public.hax_v284_invites enable row level security;
alter table public.hax_v284_reads enable row level security;

create policy hax_v284_servers_read on public.hax_v284_servers for select to authenticated using (public.hax_v284_server_member(id));
create policy hax_v284_servers_add on public.hax_v284_servers for insert to authenticated with check(owner_id=(select auth.uid()));
create policy hax_v284_servers_edit on public.hax_v284_servers for update to authenticated using (owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy hax_v284_servers_delete on public.hax_v284_servers for delete to authenticated using(owner_id=(select auth.uid()));
create policy hax_v284_members_read on public.hax_v284_members for select to authenticated using(public.hax_v284_server_member(server_id));
create policy hax_v284_members_leave on public.hax_v284_members for delete to authenticated using(user_id=(select auth.uid()) and role<>'owner');
create policy hax_v284_channels_read on public.hax_v284_channels for select to authenticated using(public.hax_v284_channel_readable(id));
create policy hax_v284_channels_add on public.hax_v284_channels for insert to authenticated with check(public.hax_v284_server_staff(server_id));
create policy hax_v284_channels_edit on public.hax_v284_channels for update to authenticated using(public.hax_v284_server_staff(server_id)) with check(public.hax_v284_server_staff(server_id));
create policy hax_v284_channels_delete on public.hax_v284_channels for delete to authenticated using(public.hax_v284_server_staff(server_id));
create policy hax_v284_messages_read on public.hax_v284_messages for select to authenticated using(public.hax_v284_channel_readable(channel_id));
create policy hax_v284_messages_add on public.hax_v284_messages for insert to authenticated with check(author_id=(select auth.uid()) and public.hax_v284_channel_readable(channel_id));
create policy hax_v284_messages_change on public.hax_v284_messages for update to authenticated using(public.hax_v284_channel_readable(channel_id) and (author_id=(select auth.uid()) or public.hax_v284_message_staff(id))) with check(public.hax_v284_channel_readable(channel_id) and (author_id=(select auth.uid()) or public.hax_v284_message_staff(id)));
create policy hax_v284_reactions_read on public.hax_v284_reactions for select to authenticated using(public.hax_v284_message_readable(message_id));
create policy hax_v284_reactions_add on public.hax_v284_reactions for insert to authenticated with check(user_id=(select auth.uid()) and public.hax_v284_message_readable(message_id));
create policy hax_v284_reactions_del on public.hax_v284_reactions for delete to authenticated using(user_id=(select auth.uid()) and public.hax_v284_message_readable(message_id));
create policy hax_v284_invites_read on public.hax_v284_invites for select to authenticated using(public.hax_v284_server_staff(server_id));
create policy hax_v284_invites_add on public.hax_v284_invites for insert to authenticated with check(created_by=(select auth.uid()) and public.hax_v284_server_staff(server_id));
-- Convites só podem ser alterados pelas funções seguras de ingresso e revogação.
create policy hax_v284_reads_read on public.hax_v284_reads for select to authenticated using(user_id=(select auth.uid()) and public.hax_v284_channel_readable(channel_id));
create policy hax_v284_reads_add on public.hax_v284_reads for insert to authenticated with check(user_id=(select auth.uid()) and public.hax_v284_channel_readable(channel_id));
create policy hax_v284_reads_edit on public.hax_v284_reads for update to authenticated using(user_id=(select auth.uid()) and public.hax_v284_channel_readable(channel_id)) with check(user_id=(select auth.uid()) and public.hax_v284_channel_readable(channel_id));

-- O Storage é privado: a leitura só é autorizada a membros com acesso ao canal.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hax-v284-communication','hax-v284-communication',false,8388608,array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain'])
on conflict (id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
create policy hax_v284_storage_read on storage.objects for select to authenticated using(bucket_id='hax-v284-communication' and public.hax_v284_can_read_file(name));
create policy hax_v284_storage_add on storage.objects for insert to authenticated with check(
  bucket_id='hax-v284-communication' and split_part(name,'/',3)=(select auth.uid())::text
  and public.hax_v284_can_read_file(name)
);
create policy hax_v284_storage_delete on storage.objects for delete to authenticated using(
  bucket_id='hax-v284-communication' and split_part(name,'/',3)=(select auth.uid())::text
  and public.hax_v284_can_read_file(name)
);

-- Mensagens em tempo real (o cliente também possui atualização periódica de contingência).
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hax_v284_messages'
  ) then alter publication supabase_realtime add table public.hax_v284_messages; end if;
end $$;

grant execute on function public.hax_v284_join_invite(text) to authenticated;
grant execute on function public.hax_v284_set_role(uuid,uuid,text) to authenticated;
grant execute on function public.hax_v284_revoke_invite(text) to authenticated;
grant execute on function public.hax_v284_kick_member(uuid,uuid) to authenticated;
grant select,insert,update,delete on public.hax_v284_servers, public.hax_v284_members, public.hax_v284_channels, public.hax_v284_messages, public.hax_v284_reactions, public.hax_v284_invites, public.hax_v284_reads to authenticated;
grant execute on function public.hax_v284_server_member(uuid),public.hax_v284_server_staff(uuid),public.hax_v284_channel_readable(uuid),public.hax_v284_message_readable(uuid),public.hax_v284_message_staff(uuid),public.hax_v284_can_read_file(text) to authenticated;
commit;
