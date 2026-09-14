-- Applied to ColarTest. Safe to re-run only on a fresh project.

create table if not exists public.test_sessions (
  id uuid primary key,
  participant_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  champion_color text,
  champion_hex text,
  total_steps int,
  user_agent text
);

create table if not exists public.test_choices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions(id) on delete cascade,
  participant_name text not null,
  step_index int not null,
  total_steps int not null,
  round_name text not null,
  left_color text not null,
  right_color text not null,
  left_hex text not null,
  right_hex text not null,
  choice int not null check (choice in (1, 2)),
  chosen_color text not null,
  remaining_steps int not null,
  is_final boolean not null default false,
  created_at timestamptz not null default now()
);
