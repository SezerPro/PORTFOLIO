drop extension if exists "pg_net";


  create table "public"."admins" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."admins" enable row level security;


  create table "public"."comment_tokens" (
    "id" uuid not null default gen_random_uuid(),
    "token" text not null,
    "client_name" text not null,
    "client_email" text not null,
    "language" text default 'fr'::text,
    "created_at" timestamp with time zone default now(),
    "expires_at" timestamp with time zone not null,
    "used" boolean default false,
    "used_at" timestamp with time zone
      );


alter table "public"."comment_tokens" enable row level security;


  create table "public"."testimonials" (
    "id" uuid not null default gen_random_uuid(),
    "token_id" uuid,
    "client_name" text not null,
    "comment" text not null,
    "language" text default 'fr'::text,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone default now(),
    "approved_at" timestamp with time zone
      );


alter table "public"."testimonials" enable row level security;

CREATE UNIQUE INDEX admins_email_key ON public.admins USING btree (email);

CREATE UNIQUE INDEX admins_pkey ON public.admins USING btree (id);

CREATE UNIQUE INDEX comment_tokens_pkey ON public.comment_tokens USING btree (id);

CREATE UNIQUE INDEX comment_tokens_token_key ON public.comment_tokens USING btree (token);

CREATE UNIQUE INDEX testimonials_pkey ON public.testimonials USING btree (id);

CREATE UNIQUE INDEX testimonials_token_id_unique ON public.testimonials USING btree (token_id) WHERE (token_id IS NOT NULL);

alter table "public"."admins" add constraint "admins_pkey" PRIMARY KEY using index "admins_pkey";

alter table "public"."comment_tokens" add constraint "comment_tokens_pkey" PRIMARY KEY using index "comment_tokens_pkey";

alter table "public"."testimonials" add constraint "testimonials_pkey" PRIMARY KEY using index "testimonials_pkey";

alter table "public"."admins" add constraint "admins_email_key" UNIQUE using index "admins_email_key";

alter table "public"."comment_tokens" add constraint "comment_tokens_token_key" UNIQUE using index "comment_tokens_token_key";

alter table "public"."testimonials" add constraint "testimonials_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text]))) not valid;

alter table "public"."testimonials" validate constraint "testimonials_status_check";

alter table "public"."testimonials" add constraint "testimonials_token_id_fkey" FOREIGN KEY (token_id) REFERENCES public.comment_tokens(id) ON DELETE CASCADE not valid;

alter table "public"."testimonials" validate constraint "testimonials_token_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
    select exists (
        select 1 from public.admins where email = auth.email()
    );
$function$
;

grant delete on table "public"."admins" to "anon";

grant insert on table "public"."admins" to "anon";

grant references on table "public"."admins" to "anon";

grant select on table "public"."admins" to "anon";

grant trigger on table "public"."admins" to "anon";

grant truncate on table "public"."admins" to "anon";

grant update on table "public"."admins" to "anon";

grant delete on table "public"."admins" to "authenticated";

grant insert on table "public"."admins" to "authenticated";

grant references on table "public"."admins" to "authenticated";

grant select on table "public"."admins" to "authenticated";

grant trigger on table "public"."admins" to "authenticated";

grant truncate on table "public"."admins" to "authenticated";

grant update on table "public"."admins" to "authenticated";

grant delete on table "public"."admins" to "service_role";

grant insert on table "public"."admins" to "service_role";

grant references on table "public"."admins" to "service_role";

grant select on table "public"."admins" to "service_role";

grant trigger on table "public"."admins" to "service_role";

grant truncate on table "public"."admins" to "service_role";

grant update on table "public"."admins" to "service_role";

grant delete on table "public"."comment_tokens" to "anon";

grant insert on table "public"."comment_tokens" to "anon";

grant references on table "public"."comment_tokens" to "anon";

grant select on table "public"."comment_tokens" to "anon";

grant trigger on table "public"."comment_tokens" to "anon";

grant truncate on table "public"."comment_tokens" to "anon";

grant update on table "public"."comment_tokens" to "anon";

grant delete on table "public"."comment_tokens" to "authenticated";

grant insert on table "public"."comment_tokens" to "authenticated";

grant references on table "public"."comment_tokens" to "authenticated";

grant select on table "public"."comment_tokens" to "authenticated";

grant trigger on table "public"."comment_tokens" to "authenticated";

grant truncate on table "public"."comment_tokens" to "authenticated";

grant update on table "public"."comment_tokens" to "authenticated";

grant delete on table "public"."comment_tokens" to "service_role";

grant insert on table "public"."comment_tokens" to "service_role";

grant references on table "public"."comment_tokens" to "service_role";

grant select on table "public"."comment_tokens" to "service_role";

grant trigger on table "public"."comment_tokens" to "service_role";

grant truncate on table "public"."comment_tokens" to "service_role";

grant update on table "public"."comment_tokens" to "service_role";

grant delete on table "public"."testimonials" to "anon";

grant insert on table "public"."testimonials" to "anon";

grant references on table "public"."testimonials" to "anon";

grant select on table "public"."testimonials" to "anon";

grant trigger on table "public"."testimonials" to "anon";

grant truncate on table "public"."testimonials" to "anon";

grant update on table "public"."testimonials" to "anon";

grant delete on table "public"."testimonials" to "authenticated";

grant insert on table "public"."testimonials" to "authenticated";

grant references on table "public"."testimonials" to "authenticated";

grant select on table "public"."testimonials" to "authenticated";

grant trigger on table "public"."testimonials" to "authenticated";

grant truncate on table "public"."testimonials" to "authenticated";

grant update on table "public"."testimonials" to "authenticated";

grant delete on table "public"."testimonials" to "service_role";

grant insert on table "public"."testimonials" to "service_role";

grant references on table "public"."testimonials" to "service_role";

grant select on table "public"."testimonials" to "service_role";

grant trigger on table "public"."testimonials" to "service_role";

grant truncate on table "public"."testimonials" to "service_role";

grant update on table "public"."testimonials" to "service_role";


  create policy "Admins can read self"
  on "public"."admins"
  as permissive
  for select
  to authenticated
using ((auth.email() = email));



  create policy "Admins manage tokens"
  on "public"."comment_tokens"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "Admins manage testimonials"
  on "public"."testimonials"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "Public read approved testimonials"
  on "public"."testimonials"
  as permissive
  for select
  to public
using ((status = 'approved'::text));



