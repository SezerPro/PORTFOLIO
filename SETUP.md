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
