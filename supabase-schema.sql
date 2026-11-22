-- =====================================================================
-- 마니또 사이트 DB 스키마 (Supabase SQL Editor에 통째로 붙여넣고 Run)
-- 여러 번 실행해도 안전하게 작성됨 (데이터 테이블은 유지, 함수는 갱신)
-- 보안 구조
--   * 데이터 테이블은 API에 노출되지 않는 app 스키마에 둔다
--   * 사이트는 public 스키마의 RPC 함수만 호출할 수 있다
--   * 모든 함수는 개인 링크 토큰으로 본인을 확인한다
--   * 매칭 결과(target_id)는 본인 것만, 정답 공개 후에는 전체가 보인다
--   * 대표(방장)도 공개 전에는 매칭 결과를 볼 수 없다
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

-- ---------- 테이블 ----------
create table if not exists app.missions (
  id     int primary key,
  text   text not null,
  style  text not null check (style in ('대면','비대면','공통')),
  active boolean not null default true
);

create table if not exists app.rooms (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  mode           text not null check (mode in ('mission','gift')),
  start_date     date,
  end_date       date,
  mission_count  int,
  mission_style  text,
  gift_date      date,
  budget         text,
  status         text not null default 'waiting'
                 check (status in ('waiting','active','guessing','revealed')),
  host_member_id uuid,
  guess_deadline date,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  revealed_at    timestamptz
);

create table if not exists app.members (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references app.rooms(id) on delete cascade,
  name       text not null,
  token      text not null unique,
  joined_at  timestamptz,
  target_id  uuid,
  wishes     text[] not null default '{}',
  guess_id   uuid,
  guessed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (room_id, name)
);

create table if not exists app.room_missions (
  room_id    uuid not null references app.rooms(id) on delete cascade,
  seq        int not null,
  mission_id int not null references app.missions(id),
  open_date  date not null,
  primary key (room_id, seq)
);

create table if not exists app.mission_done (
  member_id uuid not null references app.members(id) on delete cascade,
  room_id   uuid not null references app.rooms(id) on delete cascade,
  seq       int not null,
  done_at   timestamptz not null default now(),
  primary key (member_id, seq)
);

alter table app.missions      enable row level security;
alter table app.rooms         enable row level security;
alter table app.members       enable row level security;
alter table app.room_missions enable row level security;
alter table app.mission_done  enable row level security;
revoke all on all tables in schema app from public, anon, authenticated;

-- ---------- 미션 DB 50개 ----------
insert into app.missions (id, text, style) values
 (1,'마니또 책상(자리)에 응원 쪽지 남기기','대면'),
 (2,'마니또 자리 주변 몰래 정리해주기','대면'),
 (3,'마니또가 자주 쓰는 물건 하나 몰래 닦아두기','대면'),
 (4,'마니또 자리에 손그림 포스트잇 붙이기','대면'),
 (5,'마니또 컵에 물 채워주기','대면'),
 (6,'마니또 장점 세 가지를 쪽지에 적어 두기','대면'),
 (7,'대화로 마니또가 좋아하는 것 하나 알아내기','대면'),
 (8,'마니또 자리에 종이접기 작품 두기','대면'),
 (9,'마니또가 바쁠 때 작은 일 하나 도와주기','대면'),
 (10,'다른 사람 앞에서 마니또 칭찬하기','대면'),
 (11,'마니또 이름으로 삼행시 지어 쪽지로 전달','대면'),
 (12,'마니또가 해준 일에 고맙다고 말하기','대면'),
 (13,'마니또 별명 지어 쪽지로 남기기','대면'),
 (14,'마니또 자리에 종이로 만든 크리스마스 장식 두기','대면'),
 (15,'마니또에게 행운 메시지 카드 몰래 전달','대면'),
 (16,'마니또 모르게 다른 사람에게 마니또 칭찬하기','대면'),
 (17,'마니또가 찾는 물건 먼저 챙겨주기','대면'),
 (18,'마니또 자리에 "오늘도 화이팅" 메모 남기기','대면'),
 (19,'마니또에게 짧은 손편지 쓰기','대면'),
 (20,'마니또가 좋아하는 색 종이로 쪽지 쓰기','대면'),
 (21,'마니또 자리에 수수께끼 쪽지 남기기','대면'),
 (22,'마니또에게 칭찬 스티커 붙여주기','대면'),
 (23,'마니또가 지쳐 보이면 먼저 말 걸기','대면'),
 (24,'마니또와 같은 색 옷 입고 오기','대면'),
 (25,'마니또 자리에 오늘의 운세 쪽지 두기','대면'),
 (26,'마니또 발표·보고 후 박수 쳐주기','대면'),
 (27,'마니또 이름 적은 크리스마스 카드 몰래 두기','대면'),
 (28,'마니또 자리에 눈사람 그림 남기기','대면'),
 (29,'마니또에게 "오늘 수고했어" 말하기','대면'),
 (30,'마니또에게 따뜻한 말로 하루 마무리 인사하기','대면'),
 (31,'단톡방에 마니또가 좋아할 만한 노래 한 곡 공유하기','비대면'),
 (32,'단톡방에 오늘의 크리스마스 사진 한 장 올리기','비대면'),
 (33,'다른 친구를 통해 마니또에게 안부 전하기','비대면'),
 (34,'마니또에게 웃긴 짤 하나 보내기','비대면'),
 (35,'마니또 SNS 게시물에 따뜻한 댓글 달기','비대면'),
 (36,'마니또 이름으로 응원 짤 만들어 보내기','비대면'),
 (37,'마니또를 그린 그림을 다른 친구 통해 전달하기','비대면'),
 (38,'단톡방 칭찬 릴레이에서 마니또 칭찬하기','비대면'),
 (39,'마니또를 생각하며 만든 플레이리스트 공유하기','비대면'),
 (40,'마니또에게 "오늘 추워, 따뜻하게 입어" 보내기','비대면'),
 (41,'단톡방에 마니또에게 하고 싶은 말 이름 없이 남기기','비대면'),
 (42,'마니또에게 크리스마스 소원 물어보기','비대면'),
 (43,'마니또에 대해 새로운 사실 하나 알아내기','공통'),
 (44,'마니또 장점 다섯 가지 메모해두기','공통'),
 (45,'정답 공개 날 줄 크리스마스 카드 미리 쓰기','공통'),
 (46,'마니또를 헷갈리게 할 가짜 힌트 남기기','공통'),
 (47,'마니또에게 진짜 힌트 하나 남기기','공통'),
 (48,'마니또 위시리스트 중 하나 실행하기','공통'),
 (49,'마니또 위시리스트 중 다른 하나 더 실행하기','공통'),
 (50,'마지막 힌트: 정체 공개 전 마지막 힌트 남기기','공통')
on conflict (id) do update set text = excluded.text, style = excluded.style;

-- ---------- 내부 도우미 함수 (app 스키마, API 비노출) ----------
create or replace function app.today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

create or replace function app.new_token() returns text
language sql volatile as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_')
$$;

create or replace function app.member_by_token(p_token text) returns app.members
language plpgsql stable as $$
declare m app.members;
begin
  select * into m from app.members where token = p_token;
  if not found then raise exception 'INVALID_LINK'; end if;
  return m;
end $$;

create or replace function app.host_by_token(p_token text) returns app.members
language plpgsql stable as $$
declare m app.members;
begin
  m := app.member_by_token(p_token);
  if not exists (select 1 from app.rooms where id = m.room_id and host_member_id = m.id) then
    raise exception 'NOT_HOST';
  end if;
  return m;
end $$;

-- 날짜가 지나면 상태를 자동으로 넘긴다
create or replace function app.refresh_room(p_room uuid) returns void
language plpgsql as $$
declare r app.rooms;
begin
  select * into r from app.rooms where id = p_room for update;
  if not found or r.mode <> 'mission' then return; end if;
  if r.status = 'active' and app.today() > r.end_date then
    r.status := 'guessing';
    r.guess_deadline := r.end_date + 3;
    update app.rooms set status = 'guessing', guess_deadline = r.guess_deadline where id = p_room;
  end if;
  if r.status = 'guessing' and app.today() > r.guess_deadline then
    update app.rooms set status = 'revealed', revealed_at = now() where id = p_room;
  end if;
end $$;

-- 오래된 방 정리 (정답 공개 30일 후, 선물 교환일 30일 후, 시작 안 한 방 60일 후)
create or replace function app.cleanup() returns void
language sql as $$
  delete from app.rooms
   where (status = 'revealed' and revealed_at < now() - interval '30 days')
      or (mode = 'gift' and gift_date < app.today() - 30)
      or (status = 'waiting' and created_at < now() - interval '60 days');
$$;

revoke all on all functions in schema app from public, anon, authenticated;

-- ---------- 사이트에서 호출하는 RPC (public) ----------

-- 방 만들기: 대표가 첫 참여자로 들어가고 대표의 개인 링크 토큰을 돌려준다
create or replace function public.create_room(p jsonb) returns jsonb
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  v_room uuid; v_host text; v_names text[]; v_name text; v_n int;
  v_mode text := p->>'mode'; v_host_id uuid; v_token text;
  v_start date; v_end date; v_count int; v_style text; v_gift date; v_budget text;
begin
  perform app.cleanup();
  v_host := btrim(coalesce(p->>'host_name',''));
  if v_host = '' then raise exception 'HOST_NAME_REQUIRED'; end if;
  if btrim(coalesce(p->>'name','')) = '' then raise exception 'ROOM_NAME_REQUIRED'; end if;
  v_names := array(
    select btrim(x) from jsonb_array_elements_text(coalesce(p->'names','[]'::jsonb)) x
     where btrim(x) <> '' and btrim(x) <> v_host);
  v_names := array_prepend(v_host, v_names);
  if exists (select 1 from unnest(v_names) x group by x having count(*) > 1) then
    raise exception 'DUPLICATE_NAME';
  end if;
  if exists (select 1 from unnest(v_names) x where char_length(x) > 20) then
    raise exception 'NAME_TOO_LONG';
  end if;
  v_n := cardinality(v_names);
  if v_n < 3 then raise exception 'MIN_3'; end if;
  if v_n > 30 then raise exception 'MAX_30'; end if;

  if v_mode = 'mission' then
    v_start := (p->>'start_date')::date;
    v_end   := (p->>'end_date')::date;
    v_count := (p->>'mission_count')::int;
    v_style := p->>'mission_style';
    if v_start is null or v_end is null or v_end < v_start then raise exception 'BAD_DATES'; end if;
    if v_count is null or v_count < 1 or v_count > 10 then raise exception 'BAD_MISSION_COUNT'; end if;
    if v_style not in ('대면','비대면') then raise exception 'BAD_MISSION_STYLE'; end if;
  elsif v_mode = 'gift' then
    v_gift := (p->>'gift_date')::date;
    v_budget := left(btrim(coalesce(p->>'budget','')), 20);
    if v_gift is null then raise exception 'BAD_DATES'; end if;
  else
    raise exception 'BAD_MODE';
  end if;

  insert into app.rooms (name, mode, start_date, end_date, mission_count, mission_style, gift_date, budget)
  values (left(btrim(p->>'name'), 40), v_mode, v_start, v_end, v_count, v_style, v_gift, nullif(v_budget,''))
  returning id into v_room;

  foreach v_name in array v_names loop
    insert into app.members (room_id, name, token) values (v_room, v_name, app.new_token());
  end loop;

  select id, token into v_host_id, v_token from app.members where room_id = v_room and name = v_host;
  update app.rooms set host_member_id = v_host_id where id = v_room;
  update app.members set joined_at = now() where id = v_host_id;
  return jsonb_build_object('room_id', v_room, 'token', v_token);
end $$;

-- 링크로 참여
create or replace function public.join_room(p_token text) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare m app.members;
begin
  m := app.member_by_token(p_token);
  update app.members set joined_at = coalesce(joined_at, now()) where id = m.id;
end $$;

-- 내 화면 데이터
create or replace function public.my_view(p_token text) returns jsonb
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  m app.members; r app.rooms; t app.members;
  v_members jsonb; v_target jsonb := null; v_missions jsonb := '[]'; v_reveal jsonb := null;
  v_guessed int; v_total int; v_today date := app.today();
begin
  m := app.member_by_token(p_token);
  perform app.refresh_room(m.room_id);
  select * into r from app.rooms where id = m.room_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'joined', x.joined_at is not null)
                            order by x.created_at), '[]')
    into v_members from app.members x where x.room_id = r.id;

  if r.status <> 'waiting' and m.target_id is not null then
    select * into t from app.members where id = m.target_id;
    v_target := jsonb_build_object('name', t.name,
                  'wishes', case when r.mode = 'mission' then to_jsonb(t.wishes) else '[]'::jsonb end);
  end if;

  if r.mode = 'mission' and r.status <> 'waiting' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'seq', rm.seq, 'open_date', rm.open_date,
             'opened', rm.open_date <= v_today,
             'text', case when rm.open_date <= v_today then ms.text end,
             'done', exists (select 1 from app.mission_done d where d.member_id = m.id and d.seq = rm.seq))
           order by rm.seq), '[]')
      into v_missions
      from app.room_missions rm join app.missions ms on ms.id = rm.mission_id
     where rm.room_id = r.id;
  end if;

  select count(*) filter (where guess_id is not null), count(*) into v_guessed, v_total
    from app.members where room_id = r.id;

  if r.status = 'revealed' then
    select jsonb_build_object(
      'my_manito', (select g.name from app.members g where g.room_id = r.id and g.target_id = m.id),
      'my_guess',  (select g.name from app.members g where g.id = m.guess_id),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
                 'giver', gv.name, 'receiver', rc.name,
                 'hit', rc.guess_id is not null and rc.guess_id = gv.id) order by gv.created_at), '[]'))
      into v_reveal
      from app.members gv join app.members rc on rc.id = gv.target_id
     where gv.room_id = r.id;
  end if;

  return jsonb_build_object(
    'today', v_today,
    'room', jsonb_build_object('id', r.id, 'name', r.name, 'mode', r.mode, 'status', r.status,
              'start_date', r.start_date, 'end_date', r.end_date, 'mission_count', r.mission_count,
              'mission_style', r.mission_style, 'gift_date', r.gift_date, 'budget', r.budget,
              'guess_deadline', r.guess_deadline,
              'host_name', (select name from app.members where id = r.host_member_id)),
    'me', jsonb_build_object('id', m.id, 'name', m.name, 'joined', m.joined_at is not null,
              'wishes', to_jsonb(m.wishes), 'guess_id', m.guess_id,
              'is_host', r.host_member_id = m.id),
    'members', v_members,
    'target', v_target,
    'missions', v_missions,
    'guess', jsonb_build_object('submitted', v_guessed, 'total', v_total),
    'reveal', v_reveal);
end $$;

-- 위시리스트 저장 (최대 3개, 각 60자)
create or replace function public.save_wishes(p_token text, p_wishes text[]) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare m app.members; r app.rooms;
begin
  m := app.member_by_token(p_token);
  perform app.refresh_room(m.room_id);
  select * into r from app.rooms where id = m.room_id;
  if r.mode <> 'mission' or r.status not in ('waiting','active') then raise exception 'NOT_EDITABLE'; end if;
  update app.members
     set wishes = array(select left(btrim(w), 60) from unnest(coalesce(p_wishes,'{}')) w
                         where btrim(w) <> '' limit 3)
   where id = m.id;
end $$;

-- 미션 완료 체크
create or replace function public.set_mission_done(p_token text, p_seq int, p_done boolean) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare m app.members; r app.rooms;
begin
  m := app.member_by_token(p_token);
  perform app.refresh_room(m.room_id);
  select * into r from app.rooms where id = m.room_id;
  if r.status <> 'active' then raise exception 'NOT_ACTIVE'; end if;
  if not exists (select 1 from app.room_missions where room_id = r.id and seq = p_seq and open_date <= app.today()) then
    raise exception 'MISSION_LOCKED';
  end if;
  if p_done then
    insert into app.mission_done (member_id, room_id, seq) values (m.id, r.id, p_seq) on conflict do nothing;
  else
    delete from app.mission_done where member_id = m.id and seq = p_seq;
  end if;
end $$;

-- 예상 마니또 제출. 전원 제출하면 바로 정답 공개
create or replace function public.submit_guess(p_token text, p_guess uuid) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare m app.members; r app.rooms;
begin
  m := app.member_by_token(p_token);
  perform app.refresh_room(m.room_id);
  select * into r from app.rooms where id = m.room_id for update;
  if r.status <> 'guessing' then raise exception 'NOT_GUESSING'; end if;
  if p_guess = m.id or not exists (select 1 from app.members where id = p_guess and room_id = r.id) then
    raise exception 'BAD_GUESS';
  end if;
  update app.members set guess_id = p_guess, guessed_at = now() where id = m.id;
  if not exists (select 1 from app.members where room_id = r.id and guess_id is null) then
    update app.rooms set status = 'revealed', revealed_at = now() where id = r.id;
  end if;
end $$;

-- 대표: 명단·링크 관리 화면 (매칭 결과는 포함하지 않음)
create or replace function public.host_overview(p_token text) returns jsonb
language plpgsql security definer set search_path = app, public, extensions as $$
declare m app.members; r app.rooms; v jsonb;
begin
  m := app.host_by_token(p_token);
  perform app.refresh_room(m.room_id);
  select * into r from app.rooms where id = m.room_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'name', x.name, 'token', x.token,
           'joined', x.joined_at is not null,
           'wish_done', cardinality(x.wishes) > 0,
           'guessed', x.guess_id is not null,
           'is_host', x.id = r.host_member_id) order by x.created_at), '[]')
    into v from app.members x where x.room_id = r.id;
  return jsonb_build_object('status', r.status, 'members', v);
end $$;

-- 대표: 매칭 시작 (참여한 사람만, 나 자신 제외 완전 랜덤, 서로 마니또 허용)
create or replace function public.start_room(p_token text) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare
  m app.members; r app.rooms; ids uuid[]; perm uuid[]; n int; ok boolean; i int;
  picks int[]; k int; days int;
begin
  m := app.host_by_token(p_token);
  select * into r from app.rooms where id = m.room_id for update;
  if r.status <> 'waiting' then raise exception 'ALREADY_STARTED'; end if;
  if (select count(*) from app.members where room_id = r.id and joined_at is not null) < 3 then
    raise exception 'MIN_3_JOINED';
  end if;
  delete from app.members where room_id = r.id and joined_at is null;
  ids := array(select id from app.members where room_id = r.id order by created_at);
  n := cardinality(ids);
  loop
    perm := array(select x from unnest(ids) x order by random());
    ok := true;
    for i in 1..n loop
      if perm[i] = ids[i] then ok := false; exit; end if;
    end loop;
    exit when ok;
  end loop;
  for i in 1..n loop
    update app.members set target_id = perm[i] where id = ids[i];
  end loop;

  if r.mode = 'mission' then
    picks := array(select id from app.missions
                    where active and style in (r.mission_style, '공통')
                    order by random() limit r.mission_count);
    days := r.end_date - r.start_date + 1;
    for k in 1..cardinality(picks) loop
      insert into app.room_missions (room_id, seq, mission_id, open_date)
      values (r.id, k, picks[k], r.start_date + ((k - 1) * days / cardinality(picks)));
    end loop;
  end if;
  update app.rooms set status = 'active', started_at = now() where id = r.id;
end $$;

-- 대표: 개인 링크 재발급 (이전 링크는 바로 무효)
create or replace function public.reissue_link(p_token text, p_member uuid) returns text
language plpgsql security definer set search_path = app, public, extensions as $$
declare m app.members; v text := app.new_token();
begin
  m := app.host_by_token(p_token);
  update app.members set token = v where id = p_member and room_id = m.room_id;
  if not found then raise exception 'BAD_MEMBER'; end if;
  return v;
end $$;

-- 대표: 마니또 기간 지금 끝내기 (정답 맞히기 단계로, 제출 마감 3일)
create or replace function public.finish_now(p_token text) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare m app.members;
begin
  m := app.host_by_token(p_token);
  update app.rooms set status = 'guessing', end_date = least(end_date, app.today()),
                       guess_deadline = app.today() + 3
   where id = m.room_id and mode = 'mission' and status = 'active';
  if not found then raise exception 'NOT_ACTIVE'; end if;
end $$;

-- 대표: 강제 정답 공개
create or replace function public.force_reveal(p_token text) returns void
language plpgsql security definer set search_path = app, public, extensions as $$
declare m app.members;
begin
  m := app.host_by_token(p_token);
  update app.rooms set status = 'revealed', revealed_at = now()
   where id = m.room_id and mode = 'mission' and status in ('active','guessing');
  if not found then raise exception 'NOT_REVEALABLE'; end if;
end $$;

-- 사이트(anon)에는 RPC 실행 권한만 준다
revoke all on function public.create_room(jsonb), public.join_room(text), public.my_view(text),
  public.save_wishes(text, text[]), public.set_mission_done(text, int, boolean),
  public.submit_guess(text, uuid), public.host_overview(text), public.start_room(text),
  public.reissue_link(text, uuid), public.finish_now(text), public.force_reveal(text)
  from public;
grant execute on function public.create_room(jsonb), public.join_room(text), public.my_view(text),
  public.save_wishes(text, text[]), public.set_mission_done(text, int, boolean),
  public.submit_guess(text, uuid), public.host_overview(text), public.start_room(text),
  public.reissue_link(text, uuid), public.finish_now(text), public.force_reveal(text)
  to anon, authenticated;
