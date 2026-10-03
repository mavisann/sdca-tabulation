create table if not exists public.candidates (
    id text primary key,
    name text not null,
    program text not null default '',
    image text not null
);

create table if not exists public.active_stage (
    id boolean primary key default true check (id is true),
    active_candidate_id text references public.candidates(id) on delete set null,
    current_theme text not null default 'Casual Wear',
    updated_at timestamptz not null default now()
);

create table if not exists public.scores (
    id uuid primary key default gen_random_uuid(),
    candidate_id text not null references public.candidates(id) on delete cascade,
    theme text not null,
    poise smallint not null check (poise between 1 and 10),
    presence smallint not null check (presence between 1 and 10),
    qa smallint not null check (qa between 1 and 10),
    remarks text not null default '',
    total smallint not null check (total between 3 and 30),
    submitted_at timestamptz not null default now(),
    unique (candidate_id, theme)
);

insert into public.active_stage (id, active_candidate_id, current_theme)
values (true, null, 'Casual Wear')
on conflict (id) do nothing;

alter table public.candidates enable row level security;
alter table public.active_stage enable row level security;
alter table public.scores enable row level security;

grant select, insert, update, delete on table
    public.candidates, public.active_stage, public.scores
to anon, authenticated;

drop policy if exists candidates_select_public on public.candidates;
create policy candidates_select_public on public.candidates
    for select to anon, authenticated using (true);
drop policy if exists candidates_insert_public on public.candidates;
create policy candidates_insert_public on public.candidates
    for insert to anon, authenticated with check (true);
drop policy if exists candidates_update_public on public.candidates;
create policy candidates_update_public on public.candidates
    for update to anon, authenticated using (true) with check (true);
drop policy if exists candidates_delete_public on public.candidates;
create policy candidates_delete_public on public.candidates
    for delete to anon, authenticated using (true);

drop policy if exists active_stage_select_public on public.active_stage;
create policy active_stage_select_public on public.active_stage
    for select to anon, authenticated using (true);
drop policy if exists active_stage_insert_public on public.active_stage;
create policy active_stage_insert_public on public.active_stage
    for insert to anon, authenticated with check (true);
drop policy if exists active_stage_update_public on public.active_stage;
create policy active_stage_update_public on public.active_stage
    for update to anon, authenticated using (true) with check (true);
drop policy if exists active_stage_delete_public on public.active_stage;
create policy active_stage_delete_public on public.active_stage
    for delete to anon, authenticated using (true);

drop policy if exists scores_select_public on public.scores;
create policy scores_select_public on public.scores
    for select to anon, authenticated using (true);
drop policy if exists scores_insert_public on public.scores;
create policy scores_insert_public on public.scores
    for insert to anon, authenticated with check (true);
drop policy if exists scores_update_public on public.scores;
create policy scores_update_public on public.scores
    for update to anon, authenticated using (true) with check (true);
drop policy if exists scores_delete_public on public.scores;
create policy scores_delete_public on public.scores
    for delete to anon, authenticated using (true);

do $$
begin
    if not exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
    ) then
        raise exception 'The supabase_realtime publication does not exist.';
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'candidates'
    ) then
        execute 'alter publication supabase_realtime add table public.candidates';
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'active_stage'
    ) then
        execute 'alter publication supabase_realtime add table public.active_stage';
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'scores'
    ) then
        execute 'alter publication supabase_realtime add table public.scores';
    end if;
end
$$;
