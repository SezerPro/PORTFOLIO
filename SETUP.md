# Setup avis clients (Supabase + Resend + Vercel)

## 1) Supabase
1. Cree un projet Supabase.
2. Dans SQL Editor, execute le fichier `supabase_schema.sql`.
3. Ajoute ton email admin:
   insert into public.admins (email) values ('sezer.dogan.pro@gmail.com');
4. Recupere:
   - Project URL
   - anon public key
   - service_role key

## 2) Resend (email automatique)
1. Cree un compte Resend.
2. Genere une API key.
3. Configure une adresse d'envoi verifiee.

## 3) Variables d'environnement (Vercel)
Ajoute ces variables dans Vercel:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- RESEND_API_KEY
- RESEND_FROM_EMAIL (ex: "Sezer Dogan <contact@ton-domaine.com>")
- ADMIN_EMAILS (ex: "sezer.dogan.pro@gmail.com")

## 4) Config front-end
Dans `config.js`, remplace:
- supabaseUrl
- supabaseAnonKey
- publicSiteUrl (optionnel, ex: https://ton-site.com)
- apiBase (laisser vide sur Vercel)

## 5) Pages
- `commenter.html` : page privee pour laisser un avis (lien unique).
- `admin.html` : admin pour generer les liens et publier les avis.

## 6) Test local
En local, les appels `api/*` ne fonctionnent pas sans un serveur. Teste
directement apres deploiement sur Vercel.

## 7) Supabase CLI (mode cloud only, sans Docker)
Le projet est deja lie au projet Supabase `gbwmibibrfcolxsskonj`.

Prerequis:
- Supabase CLI installe
- Session CLI connectee (`supabase login`)
- `SUPABASE_DB_PASSWORD` renseigne dans `supabase/.env.local`

Commandes utiles:
1. Verifier le projet lie:
   `supabase projects list`
2. Verifier l'etat des migrations:
   `supabase migration list`
3. Creer une nouvelle migration:
   `supabase migration new <nom_migration>`
4. Appliquer les migrations locales au projet distant:
   `supabase db push`
5. Recuperer schema distant vers migration locale (si changements faits via SQL Editor):
   `supabase db pull`

Notes:
- En mode cloud only, `supabase start` n'est pas necessaire (et demande Docker).
- Evite les changements manuels en prod sans migration pour garder un historique propre.

## 8) Wrapper PowerShell pour charger .env.local explicitement
Pour forcer un comportement deterministe dans le shell Windows, utilise:

- `.\scripts\supabase-with-env.ps1 migration list`
- `.\scripts\supabase-with-env.ps1 db push`
- `.\scripts\supabase-with-env.ps1 db pull`

Le script charge d'abord `supabase/.env.local`, puis execute la commande Supabase.

## 9) Raccourcis npm (optionnel)
Des scripts npm sont disponibles pour eviter les commandes longues:

- `npm run supa:list`
- `npm run supa:push`
- `npm run supa:pull`

Commande generique (avec arguments):
- `npm run supa -- migration new <nom_migration>`
- `npm run supa -- db push`

## 10) Controle des couts (indexes + retention)
Une migration ajoute:
- des index utiles pour limiter les scans inutiles
- une fonction de purge `public.purge_portfolio_tech_data()`
- un cron journalier `portfolio-daily-retention` si `pg_cron` est disponible

Appliquer les migrations:
- `npm run supa:push`

Verifier la migration:
- `npm run supa:list`

Tester la purge manuellement:
- Dans SQL Editor:
  `select * from public.purge_portfolio_tech_data();`

Verifier le cron (SQL Editor):
- `select jobid, jobname, schedule, active from cron.job where jobname = 'portfolio-daily-retention';`
