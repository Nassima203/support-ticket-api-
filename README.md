# Support Ticket API

API REST de gestion de tickets de support. Un client ouvre un ticket, l'équipe support le traite jusqu'à sa résolution.

Les comptes sont créés par un administrateur et activés par invitation email : il n'y a pas d'inscription publique. Chaque compte a un rôle qui décide de ce qu'il peut faire.

**Stack :** Node.js, Express 5, TypeScript, PostgreSQL, Prisma, JWT, zod, Resend, Vitest.

## Fonctionnalités

- **Tickets** : créer, lister (filtre, recherche, pagination, tri), afficher, changer le statut
- **Comptes sur invitation** : un admin crée le compte, la personne reçoit un lien et choisit son mot de passe
- **Connexion JWT** : access token de 15 minutes, refresh token de 7 jours avec rotation, déconnexion
- **4 rôles** : `SUPER_ADMIN`, `ADMIN`, `AGENT`, `USER`, avec des droits par route
- **Mot de passe oublié** : lien par email, valable 1 heure, utilisable une seule fois
- **Désactivation et changement de rôle** d'un compte, avec effet immédiat
- **Journal d'audit** des actions sensibles
- **Sécurité** : validation de toutes les données, limites de requêtes, erreurs au même format
- **Documentation Swagger** sur `/docs`
- **141 tests automatisés** et une CI GitHub Actions

## Lancer le projet

Il faut **Node.js** et **Docker Desktop**.

```bash
# 1. Récupérer le projet et installer les librairies
git clone https://github.com/Nassima203/support-ticket-api-.git
cd support-ticket-api-
npm install

# 2. Créer le fichier de configuration, puis le remplir (voir plus bas)
cp .env.example .env

# 3. Démarrer PostgreSQL
docker compose up -d

# 4. Créer les tables
npm run db:migrate

# 5. Créer le compte SUPER_ADMIN (à partir de SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD)
npm run db:seed

# 6. Démarrer l'API
npm run dev
```

L'API tourne sur `http://localhost:3000` et la documentation interactive sur **http://localhost:3000/docs**.

### Configuration (.env)

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Connexion à PostgreSQL |
| `PORT` | Port de l'API (3000 par défaut) |
| `JWT_ACCESS_SECRET` | Secret de signature des JWT, à générer avec `openssl rand -hex 32` |
| `ACCESS_TOKEN_TTL` | Durée d'un access token (`15m`) |
| `REFRESH_TOKEN_DAYS` | Durée d'un refresh token en jours (`7`) |
| `RESEND_API_KEY` | Clé Resend. Vide : les emails sont affichés dans le terminal au lieu d'être envoyés |
| `EMAIL_FROM` | Expéditeur des emails |
| `APP_URL` | Début des liens envoyés par email |
| `RATE_LIMIT_MAX` | Nombre de requêtes autorisées par 15 minutes et par IP (300) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Compte créé par `npm run db:seed` |

### Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Démarre l'API et la relance à chaque modification |
| `npm run build` puis `npm start` | Compile puis lance la version de production |
| `npm test` | Lance les 141 tests |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run db:migrate` | Applique les migrations Prisma |
| `npm run db:seed` | Crée le compte SUPER_ADMIN |
| `npm run db:studio` | Ouvre une interface pour voir la base |
| `npm run email:test -- ton@email.com` | Vérifie l'envoi d'emails |

## Les rôles

| Rôle | Ce qu'il peut faire |
| --- | --- |
| `USER` | Créer des tickets, voir **seulement les siens** |
| `AGENT` | Voir tous les tickets, changer leur statut |
| `ADMIN` | Comme AGENT, et gérer les comptes **AGENT et USER** |
| `SUPER_ADMIN` | Tout, gérer tous les comptes sauf un autre SUPER_ADMIN, voir le journal d'audit |

Le rôle `SUPER_ADMIN` n'est créé que par le seed, jamais par l'API. Personne ne peut désactiver son propre compte ni changer son propre rôle.

## Les routes

Le détail de chaque route (corps, réponses, exemples) est dans Swagger : `/docs`, ou le fichier [docs/openapi.yaml](docs/openapi.yaml).

| Méthode | Adresse | Accès |
| --- | --- | --- |
| `POST` | `/auth/login` | Public |
| `POST` | `/auth/refresh` | Public |
| `POST` | `/auth/logout` | Public |
| `POST` | `/auth/accept-invitation` | Public |
| `POST` | `/auth/forgot-password` | Public |
| `POST` | `/auth/reset-password` | Public |
| `GET` | `/auth/me` | Connecté |
| `POST` | `/tickets` | Connecté |
| `GET` | `/tickets` | Connecté |
| `GET` | `/tickets/:id` | Connecté |
| `PATCH` | `/tickets/:id/status` | AGENT, ADMIN, SUPER_ADMIN |
| `POST` | `/users` | ADMIN, SUPER_ADMIN |
| `GET` | `/users` | ADMIN, SUPER_ADMIN |
| `POST` | `/users/:id/resend-invitation` | ADMIN, SUPER_ADMIN |
| `PATCH` | `/users/:id/status` | ADMIN, SUPER_ADMIN |
| `PATCH` | `/users/:id/role` | ADMIN, SUPER_ADMIN |
| `GET` | `/audit-logs` | SUPER_ADMIN |

Les routes « Connecté » demandent l'en-tête `Authorization: Bearer <accessToken>`.

### Listes : filtres, pagination et tri

Les listes renvoient `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }`.

```
GET /tickets?status=OPEN&search=connexion&page=1&limit=20&sortBy=createdAt&order=desc
GET /users?role=AGENT&isActive=true&page=1&limit=20
GET /audit-logs?action=ROLE_CHANGED&targetUserId=4
```

`limit` va de 1 à 100 (20 par défaut). `sortBy` accepte `createdAt`, `updatedAt`, `status` et `title`.

### Exemple : du compte au ticket

```bash
# Le SUPER_ADMIN se connecte
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ton-mot-de-passe"}'

# Il crée un compte AGENT : une invitation est envoyée par email
curl -X POST http://localhost:3000/users -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" \
  -d '{"email":"agent@example.com","name":"Nina","role":"AGENT"}'

# L'agent choisit son mot de passe avec le jeton du lien reçu
curl -X POST http://localhost:3000/auth/accept-invitation -H "Content-Type: application/json" \
  -d '{"token":"<jeton du lien>","password":"MotDePasse123"}'

# Un ticket passe en cours de traitement
curl -X PATCH http://localhost:3000/tickets/1/status -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'
```

## Les réponses et les erreurs

Les erreurs ont toujours le format `{ "error": "message" }`.

| Code | Signification |
| --- | --- |
| `200` / `201` / `204` | Succès / créé / succès sans contenu |
| `400` | Données invalides, JSON illisible, lien expiré |
| `401` | Non connecté, jeton invalide, compte désactivé, mauvais identifiants |
| `403` | Rôle insuffisant |
| `404` | Introuvable (un USER reçoit aussi 404 pour le ticket d'un autre) |
| `409` | Email déjà utilisé |
| `413` | Corps de requête de plus de 100 ko |
| `429` | Trop de requêtes |
| `500` | Erreur imprévue (le détail reste dans le terminal) |

## Sécurité

- Mots de passe hashés avec bcrypt, entre 8 et 72 caractères.
- Les jetons d'invitation, de réinitialisation et de session sont stockés en empreinte SHA-256, jamais en clair.
- **Rotation du refresh token :** un jeton déjà utilisé qui revient ferme toutes les sessions du compte.
- Le compte est relu en base à chaque requête : une désactivation ou un changement de rôle prend effet immédiatement.
- Réinitialiser son mot de passe ou être désactivé ferme toutes les sessions.
- Les réponses ne révèlent jamais si un email a un compte, ni si le ticket d'un autre existe.
- **Limites de requêtes :** 300 requêtes par 15 minutes sur toute l'API, 5 connexions ratées et 5 demandes de réinitialisation par 15 minutes, par IP.
- Toutes les données entrantes sont validées avec zod.
- Prisma utilise des requêtes paramétrées, ce qui évite l'injection SQL.

## Journal d'audit

Chaque action sensible est enregistrée dans la même transaction que l'action elle-même. Ces actions sont la création de compte (`USER_CREATED`), la désactivation (`USER_DEACTIVATED`), la réactivation (`USER_REACTIVATED`), le changement de rôle (`ROLE_CHANGED`, avec l'ancien et le nouveau rôle) et la réinitialisation de mot de passe (`PASSWORD_RESET`).

Seul le SUPER_ADMIN peut consulter le journal, avec `GET /audit-logs`.

## Organisation du code

```
src/
├── modules/          ← un dossier par fonctionnalité : auth, tickets, users, audit
│   └── tickets/
│       ├── tickets.routes.ts       ← l'adresse et ses middlewares
│       ├── tickets.controller.ts   ← lit la requête, valide, répond
│       ├── tickets.service.ts      ← les règles métier et Prisma
│       └── tickets.schemas.ts      ← les schémas zod
├── middlewares/      ← authenticate, authorize, rate-limit, errors
├── lib/              ← prisma, jetons, mots de passe, emails, validation, pagination
├── docs/             ← chargement du contrat OpenAPI
└── types/
prisma/               ← schéma, migrations, seed
docs/openapi.yaml     ← la documentation de l'API
tests/                ← tests unitaires et d'intégration
```

| Couche | Son rôle | Ce qu'elle ne fait jamais |
| --- | --- | --- |
| Routes | Associer une adresse à ses middlewares et à son contrôleur | Contenir de la logique |
| Contrôleur | Lire `req`, valider avec zod (400), appeler le service, envoyer `res` | Parler à la base |
| Service | Appliquer les règles métier (403, 404, 409…) et utiliser Prisma | Connaître `req` ou `res` |

Un service qui rencontre un problème lève `throw new HttpError(404, "Ticket introuvable")`. Le middleware `errorHandler` transforme cette erreur en réponse JSON.

## Tests

```bash
npm test
```

Il y a 141 tests, avec Vitest et Supertest :
- **44 tests unitaires** : jetons, droits par rôle, schémas de validation, pagination ;
- **97 tests d'intégration** : ils passent par les vraies routes et couvrent la connexion, les invitations, le mot de passe oublié, les règles d'accès aux tickets, la gestion des comptes, l'audit, les erreurs, les limites de requêtes et la cohérence de la documentation.

Les tests utilisent une base séparée, `support_tickets_test`, qui doit exister sur le même PostgreSQL :

```bash
docker exec support-ticket-v2-db createdb -U postgres support_tickets_test
```

Les tables de cette base sont vidées entre les tests. Par sécurité, les tests refusent de vider une base dont le nom ne finit pas par `_test`. Aucun vrai email n'est envoyé pendant les tests.

La CI GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) lance le type-check et tous les tests à chaque push.
