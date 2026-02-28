-- Active l'extension PostgreSQL qui permet notamment de générer des UUID
-- aléatoires avec gen_random_uuid().
create extension if not exists "pgcrypto";

-- Table des administrateurs autorisés à accéder au back-office.
-- L'authentification (lien magique) est gérée par Supabase Auth.
create table if not exists public.admins (
    -- Identifiant unique généré automatiquement.
    id uuid primary key default gen_random_uuid(),
    -- Email admin (unique pour éviter les doublons).
    email text not null unique,
    -- Date de création de la ligne.
    created_at timestamptz default now()
);

-- Table des liens d'invitation uniques envoyés aux clients pour déposer un avis.
create table if not exists public.comment_tokens (
    -- Identifiant technique du token.
    id uuid primary key default gen_random_uuid(),
    -- Token unique présent dans l'URL (ex: commenter.html?token=...).
    token text not null unique,
    -- Nom du client (pour préremplissage / traçabilité).
    client_name text not null,
    -- Email du client (utile pour l'envoi du lien).
    client_email text not null,
    -- Langue utilisée pour l'email / formulaire (fr, en, tr...).
    language text default 'fr',
    -- Date de création du token.
    created_at timestamptz default now(),
    -- Date d'expiration: après cette date, le lien n'est plus valide.
    expires_at timestamptz not null,
    -- Le token a-t-il déjà été utilisé ?
    used boolean default false,
    -- Date réelle d'utilisation du token.
    used_at timestamptz
);

-- Table des avis clients reçus depuis le formulaire public.
create table if not exists public.testimonials (
    -- Identifiant unique de l'avis.
    id uuid primary key default gen_random_uuid(),
    -- Référence au token ayant servi à déposer l'avis.
    -- on delete cascade = si on supprime le token, l'avis lié est supprimé.
    token_id uuid references public.comment_tokens(id) on delete cascade,
    -- Nom affiché avec l'avis.
    client_name text not null,
    -- Contenu du commentaire.
    comment text not null,
    -- Langue de l'avis.
    language text default 'fr',
    -- Statut de modération: "pending" (en attente) ou "approved" (publié).
    status text not null default 'pending' check (status in ('pending', 'approved')),
    -- Date de création de l'avis.
    created_at timestamptz default now(),
    -- Date de validation (quand l'admin publie l'avis).
    approved_at timestamptz
);

-- Empêche plusieurs avis pour un même token (protection anti-doublon).
-- Index partiel: s'applique seulement si token_id n'est pas null.
create unique index if not exists testimonials_token_id_unique
    on public.testimonials(token_id)
    where token_id is not null;

-- Fonction utilitaire appelée dans les policies RLS.
-- Elle retourne true si l'utilisateur connecté a son email dans public.admins.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select exists (
        select 1 from public.admins where email = auth.email()
    );
$$;

-- Active Row Level Security (RLS) sur les tables.
-- Une fois activée, l'accès passe par les policies définies plus bas.
alter table public.admins enable row level security;
alter table public.comment_tokens enable row level security;
alter table public.testimonials enable row level security;

-- Rend le script ré-exécutable: si la policy existe déjà, on la supprime.
-- Cette policy autorise un utilisateur connecté à lire uniquement sa propre
-- ligne dans la table admins (comparaison sur l'email).
drop policy if exists "Admins can read self" on public.admins;
create policy "Admins can read self"
    on public.admins
    for select
    to authenticated
    using (auth.email() = email);

-- Seuls les admins peuvent gérer (select/insert/update/delete) les tokens.
-- USING = quelles lignes on peut lire/modifier
-- WITH CHECK = quelles lignes on a le droit d'insérer / écrire
drop policy if exists "Admins manage tokens" on public.comment_tokens;
create policy "Admins manage tokens"
    on public.comment_tokens
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Tout le monde (public) peut lire seulement les avis approuvés.
-- Les avis "pending" restent invisibles sur le site public.
drop policy if exists "Public read approved testimonials" on public.testimonials;
create policy "Public read approved testimonials"
    on public.testimonials
    for select
    to public
    using (status = 'approved');

-- Seuls les admins peuvent gérer les avis (modération / publication).
drop policy if exists "Admins manage testimonials" on public.testimonials;
create policy "Admins manage testimonials"
    on public.testimonials
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Cost-control indexes for common queries (admin moderation + public listing)
create index if not exists comment_tokens_expires_at_idx
    on public.comment_tokens (expires_at);

create index if not exists comment_tokens_unused_expires_at_idx
    on public.comment_tokens (expires_at)
    where used = false;

create index if not exists testimonials_status_created_at_idx
    on public.testimonials (status, created_at desc);

create index if not exists testimonials_created_at_idx
    on public.testimonials (created_at desc);

-- Purge helper to keep technical data small over time.
-- Safe for portfolio use: keeps approved testimonials, removes only:
-- 1) expired and unused tokens (older than 30 days after expiration)
-- 2) very old pending testimonials (older than 180 days)
create or replace function public.purge_portfolio_tech_data(
    p_delete_expired_unused_tokens_after interval default interval '30 days',
    p_delete_old_pending_testimonials_after interval default interval '180 days'
)
returns table (
    deleted_tokens bigint,
    deleted_pending_testimonials bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_deleted_tokens bigint := 0;
    v_deleted_pending bigint := 0;
begin
    with deleted as (
        delete from public.comment_tokens
        where used = false
          and expires_at < now() - p_delete_expired_unused_tokens_after
        returning 1
    )
    select count(*) into v_deleted_tokens from deleted;

    with deleted as (
        delete from public.testimonials
        where status = 'pending'
          and created_at < now() - p_delete_old_pending_testimonials_after
        returning 1
    )
    select count(*) into v_deleted_pending from deleted;

    return query
    select v_deleted_tokens, v_deleted_pending;
end;
$$;

revoke all on function public.purge_portfolio_tech_data(interval, interval) from public;
revoke all on function public.purge_portfolio_tech_data(interval, interval) from anon;
revoke all on function public.purge_portfolio_tech_data(interval, interval) from authenticated;
grant execute on function public.purge_portfolio_tech_data(interval, interval) to service_role;

comment on function public.purge_portfolio_tech_data(interval, interval)
is 'Deletes old unused expired tokens and very old pending testimonials to reduce storage and query load.';

-- Optional daily scheduler (works only when pg_cron extension is available).
do $$
begin
    begin
        create extension if not exists pg_cron;
    exception
        when others then
            raise notice 'pg_cron not available in this environment: %', sqlerrm;
            return;
    end;

    begin
        if not exists (
            select 1
            from cron.job
            where jobname = 'portfolio-daily-retention'
        ) then
            perform cron.schedule(
                'portfolio-daily-retention',
                '17 3 * * *',
                'select public.purge_portfolio_tech_data();'
            );
        end if;
    exception
        when undefined_table then
            raise notice 'cron.job table unavailable, skipping schedule.';
    end;
end
$$;
