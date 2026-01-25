create extension if not exists "pgcrypto";

create table if not exists public.admins (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    created_at timestamptz default now()
);

create table if not exists public.comment_tokens (
    id uuid primary key default gen_random_uuid(),
    token text not null unique,
    client_name text not null,
    client_email text not null,
    language text default 'fr',
    created_at timestamptz default now(),
    expires_at timestamptz not null,
    used boolean default false,
    used_at timestamptz
);

create table if not exists public.testimonials (
    id uuid primary key default gen_random_uuid(),
    token_id uuid references public.comment_tokens(id) on delete cascade,
    client_name text not null,
    comment text not null,
    language text default 'fr',
    status text not null default 'pending' check (status in ('pending', 'approved')),
    created_at timestamptz default now(),
    approved_at timestamptz
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select exists (
        select 1 from public.admins where email = auth.email()
    );
$$;

alter table public.admins enable row level security;
alter table public.comment_tokens enable row level security;
alter table public.testimonials enable row level security;

create policy "Admins can read self"
    on public.admins
    for select
    to authenticated
    using (auth.email() = email);

create policy "Admins manage tokens"
    on public.comment_tokens
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "Public read approved testimonials"
    on public.testimonials
    for select
    to public
    using (status = 'approved');

create policy "Admins manage testimonials"
    on public.testimonials
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
