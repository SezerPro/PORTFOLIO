-- Cost-control migration for portfolio workload:
-- 1) Add query indexes used by admin/public pages.
-- 2) Add retention function to purge technical stale rows.
-- 3) Schedule daily purge when pg_cron is available.

create index if not exists comment_tokens_expires_at_idx
    on public.comment_tokens (expires_at);

create index if not exists comment_tokens_unused_expires_at_idx
    on public.comment_tokens (expires_at)
    where used = false;

create index if not exists testimonials_status_created_at_idx
    on public.testimonials (status, created_at desc);

create index if not exists testimonials_created_at_idx
    on public.testimonials (created_at desc);

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
