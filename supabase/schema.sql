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
    judge_name text not null default 'Judge 1',
    poise smallint,
    presence smallint,
    qa smallint,
    criteria jsonb not null default '{}'::jsonb,
    remarks text not null default '',
    total integer not null check (total >= 0),
    submitted_at timestamptz not null default now(),
    unique (candidate_id, theme, judge_name)
);

create table if not exists public.themes (
    id text primary key,
    name text not null unique,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.theme_criteria (
    id uuid primary key default gen_random_uuid(),
    theme_id text not null references public.themes(id) on delete cascade,
    name text not null,
    max_score smallint not null default 10 check (max_score between 1 and 100),
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    unique (theme_id, name)
);

create table if not exists public.judges (
    id text primary key,
    name text not null unique,
    access_code text not null unique,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.scores add column if not exists criteria jsonb not null default '{}'::jsonb;
alter table public.scores add column if not exists judge_name text not null default 'Judge 1';
alter table public.scores add column if not exists judge_id text references public.judges(id) on delete set null;
alter table public.scores alter column poise drop not null;
alter table public.scores alter column presence drop not null;
alter table public.scores alter column qa drop not null;
alter table public.scores alter column total type integer;
alter table public.scores drop constraint if exists scores_poise_check;
alter table public.scores drop constraint if exists scores_presence_check;
alter table public.scores drop constraint if exists scores_qa_check;
alter table public.scores drop constraint if exists scores_total_check;
alter table public.scores drop constraint if exists scores_candidate_id_theme_key;
alter table public.scores drop constraint if exists scores_candidate_theme_judge_key;
alter table public.scores add constraint scores_total_check check (total >= 0);
alter table public.scores drop constraint if exists scores_candidate_theme_judge_id_key;
alter table public.scores add constraint scores_candidate_theme_judge_id_key unique (candidate_id, theme, judge_id);

insert into public.themes (id, name, sort_order)
values
    ('Casual Wear', 'Casual Wear', 1),
    ('Formal Wear', 'Formal Wear', 2),
    ('Talent Portion', 'Talent Portion', 3),
    ('Final Q&A', 'Final Q&A', 4)
on conflict (id) do nothing;

insert into public.theme_criteria (theme_id, name, max_score, sort_order)
select theme.id, criterion.name, 10, criterion.sort_order
from public.themes theme
cross join (values ('Poise & Bearing', 1), ('Stage Presence', 2), ('Q&A', 3)) criterion(name, sort_order)
on conflict (theme_id, name) do nothing;

insert into public.themes (id, name, sort_order)
select distinct source.theme_id, source.theme_id, 999
from (
    select current_theme as theme_id from public.active_stage where current_theme is not null
    union
    select theme from public.scores where theme is not null
) source
where not exists (
    select 1 from public.themes existing where existing.id = source.theme_id
)
on conflict (id) do nothing;

alter table public.active_stage drop constraint if exists active_stage_current_theme_fkey;
alter table public.active_stage add constraint active_stage_current_theme_fkey
    foreign key (current_theme) references public.themes(id) on delete restrict;
alter table public.scores drop constraint if exists scores_theme_fkey;
alter table public.scores add constraint scores_theme_fkey
    foreign key (theme) references public.themes(id) on delete restrict;

insert into public.active_stage (id, active_candidate_id, current_theme)
values (true, null, 'Casual Wear')
on conflict (id) do nothing;

alter table public.candidates enable row level security;
alter table public.active_stage enable row level security;
alter table public.scores enable row level security;
alter table public.themes enable row level security;
alter table public.theme_criteria enable row level security;
alter table public.judges enable row level security;

grant select, insert, update, delete on table
    public.candidates, public.active_stage, public.scores, public.themes, public.theme_criteria, public.judges
to anon, authenticated;

drop policy if exists themes_public on public.themes;
create policy themes_public on public.themes
    for all to anon, authenticated using (true) with check (true);
drop policy if exists theme_criteria_public on public.theme_criteria;
create policy theme_criteria_public on public.theme_criteria
    for all to anon, authenticated using (true) with check (true);
drop policy if exists judges_public on public.judges;
create policy judges_public on public.judges
    for all to anon, authenticated using (true) with check (true);

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

create or replace function public.authenticate_judge(input_code text)
returns table (id text, name text)
language sql
security definer
set search_path = public
as $$
        select judges.id, judges.name
        from public.judges
        where judges.access_code = upper(trim(input_code))
            and judges.active = true
        limit 1;
$$;

grant execute on function public.authenticate_judge(text) to anon, authenticated;

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
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'themes'
    ) then
        execute 'alter publication supabase_realtime add table public.themes';
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'theme_criteria'
    ) then
        execute 'alter publication supabase_realtime add table public.theme_criteria';
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'judges'
    ) then
        execute 'alter publication supabase_realtime add table public.judges';
    end if;
end
$$;
