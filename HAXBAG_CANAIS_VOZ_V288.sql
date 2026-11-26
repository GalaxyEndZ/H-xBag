-- HäxBag V288 · Canais de voz em tempo real (WebRTC + Supabase Presence/Broadcast).
-- PRÉ-REQUISITOS: SQL de Comunicação V284 e correção RLS V286 já executados.
-- Execute este arquivo inteiro no SQL Editor do Supabase como proprietário do projeto.
-- Mantém todos os canais e mensagens existentes, sem mexer em dados de RPG/Social.
begin;

alter table public.hax_v284_channels
  add column if not exists kind text not null default 'text';
update public.hax_v284_channels set kind='text' where kind is null;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='hax_v288_channel_kind' and conrelid='public.hax_v284_channels'::regclass) then
    alter table public.hax_v284_channels
      add constraint hax_v288_channel_kind check (kind in ('text','voice'));
  end if;
end $$;

-- Histórico de texto não pode ser convertido para canal de voz.
create or replace function public.hax_v288_guard_kind()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.kind is distinct from new.kind and exists(
    select 1 from public.hax_v284_messages where channel_id=old.id
  ) then
    raise exception 'Um canal com mensagens não pode trocar de tipo';
  end if;
  return new;
end;
$$;
drop trigger if exists hax_v288_guard_kind on public.hax_v284_channels;
create trigger hax_v288_guard_kind before update of kind on public.hax_v284_channels
  for each row execute function public.hax_v288_guard_kind();

-- Segurança também nas mensagens: canais de voz não aceitam texto via API direta.
drop policy if exists hax_v288_message_text_only on public.hax_v284_messages;
create policy hax_v288_message_text_only on public.hax_v284_messages
  as restrictive for insert to authenticated
  with check(exists(select 1 from public.hax_v284_channels c where c.id=channel_id and c.kind='text'));

-- Só membros com acesso ao canal podem transmitir sinalização ou presença.
-- Valida o tópico inteiro, evitando entrada em canais de outros servidores.
create or replace function public.hax_v288_can_use_voice_topic(p_topic text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  v_server text;
  v_channel text;
begin
  if (select auth.uid()) is null or p_topic is null or
     p_topic !~ '^hax-v288-voice:[0-9a-f-]{36}:[0-9a-f-]{36}$' then
    return false;
  end if;
  v_server := split_part(p_topic,':',2);
  v_channel := split_part(p_topic,':',3);
  return exists (
    select 1 from public.hax_v284_channels c
    where c.id=v_channel::uuid and c.server_id=v_server::uuid and c.kind='voice'
      and public.hax_v284_channel_readable(c.id)
  );
exception when invalid_text_representation then return false;
end;
$$;
revoke all on function public.hax_v288_can_use_voice_topic(text) from public,anon;
grant execute on function public.hax_v288_can_use_voice_topic(text) to authenticated;

-- Policies para canais realtime privados. NÃO habilitar política aberta por tópico.
drop policy if exists hax_v288_voice_receive on realtime.messages;
create policy hax_v288_voice_receive on realtime.messages
  for select to authenticated
  using (public.hax_v288_can_use_voice_topic(realtime.topic()));
drop policy if exists hax_v288_voice_transmit on realtime.messages;
create policy hax_v288_voice_transmit on realtime.messages
  for insert to authenticated
  with check (public.hax_v288_can_use_voice_topic(realtime.topic()));

-- Mesmo se existir alguma política permissiva genérica de Realtime no projeto,
-- restringe estes tópicos privados aos membros autorizados.
drop policy if exists hax_v288_voice_guard_read on realtime.messages;
create policy hax_v288_voice_guard_read on realtime.messages
  as restrictive for select to authenticated
  using (realtime.topic() not like 'hax-v288-voice:%' or public.hax_v288_can_use_voice_topic(realtime.topic()));
drop policy if exists hax_v288_voice_guard_write on realtime.messages;
create policy hax_v288_voice_guard_write on realtime.messages
  as restrictive for insert to authenticated
  with check (realtime.topic() not like 'hax-v288-voice:%' or public.hax_v288_can_use_voice_topic(realtime.topic()));

grant select,insert on realtime.messages to authenticated;
commit;
