# Contrôle des douches de sécurité — site terrain

SPA statique (Vite + React). **Aucune base Netlify, aucun serveur, aucune
fonction Netlify, aucune clé `service_role`.**

- **Données** : Supabase, appelé directement avec l'URL du projet et la clé
  `anon` (RPC uniquement, pas d'accès direct aux tables).
- **Photos** : Cloudflare R2 via un petit Worker. Le bucket reste privé ;
  l'egress R2 est gratuit.

## Variables d'environnement

```env
# Obligatoires (Supabase → Project Settings → API)
VITE_SUPABASE_URL=https://ayshwltvfmrlnkswpjld.supabase.co
VITE_SUPABASE_ANON_KEY=...

# Photos (URL du Worker Cloudflare, sans slash final)
VITE_PHOTOS_ENDPOINT=https://douches-photos.<compte>.workers.dev
VITE_PHOTOS_TOKEN=...
```

Sans `VITE_PHOTOS_ENDPOINT`, le formulaire fonctionne normalement **sans
photos** et affiche un message dans la section Photos.

## Déploiement Netlify

1. Build command : `npm run build` — Publish directory : `dist`.
2. Ajouter les variables **avant** le build (*Site settings → Environment
   variables*).
3. Déployer. Après toute modification des variables :
   *Deploys → Trigger deploy → Clear cache and deploy site*.

Les variables Vite sont lues **au moment du build**. Si elles manquent, le site
affiche « Le site n'est pas encore relié à Supabase ».

## Développement local

```bash
npm install
cp .env.example .env
npm run dev
```

## Photos : Cloudflare R2 + Worker

La troisième page accepte **3 photos maximum**, compressées dans le navigateur
(1600 px, JPEG ~250 Ko). Une photo de ~4 Mo descend à ~250 Ko, ce qui limite
fortement le stockage.

Le navigateur n'a **aucune clé R2**. Il envoie l'image au Worker, qui écrit dans
le bucket R2 et renvoie l'URL publique du Worker.

### 1. Créer le bucket et déployer le Worker

```bash
cd worker
npx wrangler login
npx wrangler r2 bucket create douches-photos
npx wrangler secret put APP_TOKEN      # choisir une chaîne aléatoire
npx wrangler deploy
```

Notez l'URL affichée : `https://douches-photos.<compte>.workers.dev`.

Pour restreindre les envois à votre domaine Netlify, remplacez dans
`worker/wrangler.toml` :

```toml
[vars]
ALLOWED_ORIGIN = "https://votre-site.netlify.app"
```

puis `npx wrangler deploy` à nouveau.

### 2. Relier le site au Worker

Dans Netlify :

```env
VITE_PHOTOS_ENDPOINT=https://douches-photos.<compte>.workers.dev
VITE_PHOTOS_TOKEN=<la valeur choisie pour APP_TOKEN>
```

Puis *Clear cache and deploy site*. Vérification :

```bash
curl https://douches-photos.<compte>.workers.dev/health
# {"ok":true,"service":"douches-photos","bucket":"ok"}
```

### 3. Base Supabase

Coller une fois `supabase/PHOTOS.sql` dans **Supabase → SQL Editor → Run** :
il ajoute les colonnes `photos`, `operationnelle` et `localisation`, puis la
version 10 paramètres de `inserer_rapport` (photos + accueil).

**Ce script est obligatoire avant de déployer cette version** : la page
d'accueil transmet systématiquement l'état de l'installation. Sans lui,
l'envoi renvoie une erreur de fonction introuvable.

### Coût

- R2 : 10 Go gratuits, puis 0,015 $/Go/mois, **egress gratuit**.
- Worker : 100 000 requêtes/jour gratuites.
- À 500 contrôles/jour avec 2 photos de 100 Ko, on reste sous 3 Go/mois.

## Côté Supabase

Le formulaire appelle uniquement :

- `rpc/inserer_rapport(...)` pour transmettre un contrôle (avec ou sans photos) ;
- `rpc/referentiel_lieux()` pour rafraîchir la liste des emplacements
  (repli automatique sur la liste embarquée si l'appel échoue).

Aucune table n'est lue ni écrite directement par le navigateur. Si le projet est
recréé, exécuter `SETUP.sql` puis `PHOTOS.sql` dans le **SQL Editor**.

## Routes

- `/rapport/accueil`
- `/rapport/secteur`
- `/rapport/identification`
- `/rapport/verification`

La redirection Netlify `/* → /index.html` gère les accès directs et le
rafraîchissement.
