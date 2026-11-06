# Support Ticket API

## Sommaire

1. [C'est quoi ce projet ?](#cest-quoi-ce-projet-)
2. [Ce que l'API sait faire](#ce-que-lapi-sait-faire)
3. [Les 4 rôles](#les-4-rôles)
4. [Le parcours d'un utilisateur, du début à la fin](#le-parcours-dun-utilisateur-du-début-à-la-fin)
5. [Lancer le projet sur son ordinateur](#lancer-le-projet-sur-son-ordinateur)
6. [Utiliser l'API](#utiliser-lapi)
7. [Les réponses de l'API](#les-réponses-de-lapi)
8. [La sécurité, expliquée simplement](#la-sécurité-expliquée-simplement)
9. [Le journal d'audit](#le-journal-daudit)
10. [Comment le code est organisé](#comment-le-code-est-organisé)
11. [Les tests et la vérification automatique](#les-tests-et-la-vérification-automatique)
12. [Les outils utilisés](#les-outils-utilisés)
13. [Ce qui a été construit, étape par étape](#ce-qui-a-été-construit-étape-par-étape)

---

## C'est quoi ce projet ?

Une **API** pour gérer des **tickets de support**.

Un ticket, c'est une demande d'aide. Par exemple : « Je n'arrive pas à me connecter ». Le client crée le ticket, puis l'équipe support le traite jusqu'à ce que le problème soit réglé.

Il n'y a pas d'interface graphique. On utilise l'API en lui envoyant des requêtes, avec **Postman**, la commande `curl`, ou la page de documentation **Swagger** fournie avec le projet.

Points importants :
- **Pas d'inscription libre.** Seul un administrateur peut créer un compte. La personne reçoit ensuite une invitation par email.
- **Chaque personne a un rôle** (client, agent, admin…) qui décide de ce qu'elle a le droit de faire.
- **Les actions importantes sont enregistrées** dans un journal, pour savoir qui a fait quoi et quand.

---

## Ce que l'API sait faire

### Les tickets
- Créer un ticket avec un titre et une description.
- Voir la liste des tickets, avec :
  - un **filtre** par statut (par exemple seulement les tickets ouverts) ;
  - une **recherche** par mot dans le titre ou la description ;
  - un **découpage en pages** (20 tickets par page par défaut) ;
  - un **tri** par date, statut ou titre.
- Voir un ticket précis.
- Changer le statut d'un ticket. Un ticket passe par 4 étapes :

| Statut | Signification |
| --- | --- |
| `OPEN` | Le ticket vient d'être créé, personne ne s'en occupe encore |
| `IN_PROGRESS` | Quelqu'un du support travaille dessus |
| `RESOLVED` | Une solution a été trouvée |
| `CLOSED` | Le ticket est terminé |

### Les comptes
- Créer un compte et envoyer une **invitation par email**.
- Renvoyer une invitation si la personne ne l'a pas reçue ou si elle a expiré.
- Voir la liste des comptes, avec un filtre par rôle ou par état (actif ou désactivé).
- **Désactiver** un compte (la personne ne peut plus rien faire) puis le **réactiver**.
- **Changer le rôle** d'un compte.

### La connexion
- Se connecter avec son email et son mot de passe.
- Rester connecté sans retaper son mot de passe toutes les 15 minutes.
- Se déconnecter.
- Voir son propre compte.

### Le mot de passe
- Choisir son mot de passe en acceptant l'invitation.
- **Mot de passe oublié :** recevoir un lien par email pour en choisir un nouveau.

### Le suivi et la qualité
- Un **journal d'audit** qui garde une trace des actions sensibles.
- Une **documentation interactive** (Swagger) pour tester l'API dans le navigateur.
- **141 tests automatiques** qui vérifient que tout marche, lancés à chaque envoi du code sur GitHub.

---

## Les 4 rôles

Du plus puissant au moins puissant :

| Rôle | Qui c'est | Ce qu'il peut faire |
| --- | --- | --- |
| `SUPER_ADMIN` | Le responsable de l'application | Tout faire, gérer tous les comptes (sauf un autre SUPER_ADMIN), lire le journal d'audit |
| `ADMIN` | Un administrateur | Voir et traiter tous les tickets, gérer les comptes **AGENT** et **USER** |
| `AGENT` | Un membre du support | Voir tous les tickets et changer leur statut |
| `USER` | Un client | Créer des tickets et voir **uniquement les siens** |

Quelques règles en plus :
- Le **SUPER_ADMIN** est créé une seule fois, par une commande au démarrage du projet (`npm run db:seed`). Personne ne peut devenir SUPER_ADMIN par l'API.
- Un **ADMIN** ne peut pas créer un autre ADMIN, ni toucher au compte d'un autre ADMIN.
- **Personne ne peut modifier son propre compte** (se désactiver ou changer son rôle). Ça évite de se bloquer par erreur.

---

## Le parcours d'un utilisateur, du début à la fin

1. **Le SUPER_ADMIN se connecte** avec le compte créé au démarrage du projet.
2. **Il crée un compte** pour un agent, par exemple `nina@example.com`. Le compte n'a pas encore de mot de passe.
3. **Nina reçoit un email** avec un lien d'invitation, valable 48 heures.
4. **Nina choisit son mot de passe** grâce à ce lien. Le lien ne marche qu'une seule fois.
5. **Nina se connecte.** L'API lui donne deux « jetons » (voir [La sécurité](#la-sécurité-expliquée-simplement)) :
   - un **access token**, qui prouve qui elle est à chaque requête, valable 15 minutes ;
   - un **refresh token**, qui sert à obtenir un nouvel access token sans retaper son mot de passe, valable 7 jours.
6. **Un client crée un ticket.** Nina le voit dans la liste et le passe en `IN_PROGRESS`, puis en `RESOLVED`.
7. **Nina oublie son mot de passe ?** Elle en demande un nouveau et reçoit un lien valable 1 heure.
8. **Nina quitte l'équipe ?** Un admin désactive son compte : elle est bloquée immédiatement, et l'action est notée dans le journal d'audit.

---

## Lancer le projet sur son ordinateur

### Ce qu'il faut installer
- **Node.js** (pour faire tourner le code)
- **Docker Desktop** (pour lancer la base de données sans l'installer)

### Les étapes

```bash
# 1. Récupérer le projet
git clone https://github.com/Nassima203/support-ticket-api-.git
cd support-ticket-api-

# 2. Installer les librairies
npm install

# 3. Créer le fichier de configuration (à remplir ensuite, voir le tableau plus bas)
cp .env.example .env

# 4. Démarrer la base de données PostgreSQL
docker compose up -d

# 5. Créer les tables dans la base
npm run db:migrate

# 6. Créer le compte SUPER_ADMIN
npm run db:seed

# 7. Démarrer l'API
npm run dev
```

C'est prêt :
- l'API répond sur **http://localhost:3000** ;
- la documentation interactive est sur **http://localhost:3000/docs**.

### Le fichier de configuration (.env)

Ce fichier contient les réglages et les secrets du projet. **Il ne doit jamais être envoyé sur GitHub.**

| Variable | À quoi elle sert | Exemple |
| --- | --- | --- |
| `DATABASE_URL` | L'adresse de la base de données | déjà rempli dans `.env.example` |
| `PORT` | Le port de l'API | `3000` |
| `JWT_ACCESS_SECRET` | Le secret qui sert à signer les jetons de connexion | générer avec `openssl rand -hex 32` |
| `ACCESS_TOKEN_TTL` | Durée de vie d'un access token | `15m` |
| `REFRESH_TOKEN_DAYS` | Durée de vie d'un refresh token, en jours | `7` |
| `RESEND_API_KEY` | La clé du service d'emails Resend | vide = les emails s'affichent dans le terminal |
| `EMAIL_FROM` | L'adresse qui envoie les emails | `onboarding@resend.dev` |
| `APP_URL` | Le début des liens envoyés par email | `http://localhost:3000` |
| `RATE_LIMIT_MAX` | Nombre de requêtes autorisées par 15 minutes et par adresse IP | `300` |
| `SUPER_ADMIN_EMAIL` | L'email du compte SUPER_ADMIN | ton email |
| `SUPER_ADMIN_PASSWORD` | Son mot de passe (au moins 8 caractères) | à choisir |

**Astuce :** pour tester sans vraie boîte mail, laisse `RESEND_API_KEY` vide. Le contenu des emails, avec les liens d'invitation et de réinitialisation, s'affichera dans le terminal où tourne l'API.

### Les commandes utiles

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm run dev` | Démarre l'API et la relance à chaque modification du code |
| `npm run build` puis `npm start` | Prépare puis lance la version de production |
| `npm test` | Lance les 141 tests |
| `npm run typecheck` | Vérifie qu'il n'y a pas d'erreur de type dans le code |
| `npm run db:migrate` | Met à jour les tables de la base |
| `npm run db:seed` | Crée le compte SUPER_ADMIN |
| `npm run db:studio` | Ouvre une page web pour voir le contenu de la base |
| `npm run email:test -- ton@email.com` | Envoie un email de test |

---

## Utiliser l'API

### Le plus simple : Swagger

Ouvre **http://localhost:3000/docs** dans ton navigateur. Chaque route y est expliquée, avec des exemples, et tu peux l'essayer directement.

1. Ouvre `POST /auth/login`, clique sur **Try it out**, entre l'email et le mot de passe du SUPER_ADMIN, puis **Execute**.
2. Copie la valeur de `accessToken` dans la réponse.
3. Clique sur le bouton **Authorize** en haut de la page et colle le jeton.
4. Tu peux maintenant essayer toutes les routes.

La même documentation existe sous forme de fichier : [docs/openapi.yaml](docs/openapi.yaml). On peut l'importer dans Postman.

### La liste des routes

« Public » veut dire sans connexion. « Connecté » veut dire avec l'en-tête `Authorization: Bearer <accessToken>`.

**Connexion et mot de passe**

| Méthode | Adresse | Accès | Ce qu'elle fait |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Public | Se connecter |
| `POST` | `/auth/refresh` | Public | Obtenir de nouveaux jetons |
| `POST` | `/auth/logout` | Public | Se déconnecter |
| `POST` | `/auth/accept-invitation` | Public | Choisir son mot de passe avec le lien d'invitation |
| `POST` | `/auth/forgot-password` | Public | Demander un lien « mot de passe oublié » |
| `POST` | `/auth/reset-password` | Public | Choisir un nouveau mot de passe avec ce lien |
| `GET` | `/auth/me` | Connecté | Voir son propre compte |

**Tickets**

| Méthode | Adresse | Accès | Ce qu'elle fait |
| --- | --- | --- | --- |
| `POST` | `/tickets` | Connecté | Créer un ticket |
| `GET` | `/tickets` | Connecté | Lister les tickets (un USER ne voit que les siens) |
| `GET` | `/tickets/:id` | Connecté | Voir un ticket |
| `PATCH` | `/tickets/:id/status` | AGENT, ADMIN, SUPER_ADMIN | Changer le statut |

**Comptes**

| Méthode | Adresse | Accès | Ce qu'elle fait |
| --- | --- | --- | --- |
| `POST` | `/users` | ADMIN, SUPER_ADMIN | Créer un compte et envoyer l'invitation |
| `GET` | `/users` | ADMIN, SUPER_ADMIN | Lister les comptes |
| `POST` | `/users/:id/resend-invitation` | ADMIN, SUPER_ADMIN | Renvoyer une invitation |
| `PATCH` | `/users/:id/status` | ADMIN, SUPER_ADMIN | Désactiver ou réactiver un compte |
| `PATCH` | `/users/:id/role` | ADMIN, SUPER_ADMIN | Changer le rôle d'un compte |

**Journal d'audit**

| Méthode | Adresse | Accès | Ce qu'elle fait |
| --- | --- | --- | --- |
| `GET` | `/audit-logs` | SUPER_ADMIN | Lire le journal des actions sensibles |

### Les listes : filtres, pages et tri

On ajoute des options à la fin de l'adresse, après un `?` :

```
GET /tickets?status=OPEN                     → seulement les tickets ouverts
GET /tickets?search=connexion                → les tickets qui parlent de "connexion"
GET /tickets?page=2&limit=10                 → la 2e page, 10 tickets par page
GET /tickets?sortBy=title&order=asc          → triés par titre, de A à Z
GET /users?role=AGENT&isActive=true          → les agents actifs
GET /audit-logs?action=ROLE_CHANGED          → seulement les changements de rôle
```

Les listes répondent toujours avec la même forme : les éléments de la page dans `data`, et de quoi naviguer dans `pagination`.

```json
{
  "data": [ { "id": 1, "title": "Impossible de me connecter", "status": "OPEN" } ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### Un exemple complet avec curl

```bash
# 1. Le SUPER_ADMIN se connecte : il récupère un accessToken
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ton-mot-de-passe"}'

# 2. Il crée un compte AGENT : une invitation part par email
curl -X POST http://localhost:3000/users -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" \
  -d '{"email":"nina@example.com","name":"Nina","role":"AGENT"}'

# 3. Nina choisit son mot de passe avec le jeton reçu dans le lien
curl -X POST http://localhost:3000/auth/accept-invitation -H "Content-Type: application/json" \
  -d '{"token":"<jeton du lien>","password":"MotDePasse123"}'

# 4. Un ticket passe en cours de traitement
curl -X PATCH http://localhost:3000/tickets/1/status -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'
```

---

## Les réponses de l'API

Chaque réponse a un **code** qui dit si tout s'est bien passé.

| Code | Ce que ça veut dire |
| --- | --- |
| `200` | Tout s'est bien passé |
| `201` | L'élément a bien été créé |
| `204` | C'est fait, il n'y a rien à renvoyer (par exemple après une déconnexion) |
| `400` | Les données envoyées ne sont pas bonnes (champ manquant, mauvais format, lien expiré…) |
| `401` | Tu n'es pas connecté, ton jeton n'est plus valable, ou ton compte est désactivé |
| `403` | Tu es connecté, mais ton rôle ne te permet pas de faire ça |
| `404` | L'élément demandé n'existe pas |
| `409` | Conflit : par exemple, un compte existe déjà avec cet email |
| `413` | Ce que tu envoies est trop gros (plus de 100 ko) |
| `429` | Trop de requêtes en peu de temps, il faut attendre |
| `500` | Erreur inattendue du serveur |

En cas d'erreur, l'API explique toujours le problème de la même façon :

```json
{ "error": "Ticket introuvable" }
```

---

## La sécurité, expliquée simplement

Chaque protection répond à un risque précis.

### Les mots de passe ne sont jamais enregistrés en clair
**Le risque :** si quelqu'un vole la base de données, il lit tous les mots de passe.
**La solution :** on enregistre seulement une « empreinte » du mot de passe, calculée avec **bcrypt**. On peut vérifier un mot de passe avec cette empreinte, mais on ne peut pas retrouver le mot de passe à partir d'elle. Un mot de passe doit faire entre 8 et 72 caractères.

### Les liens envoyés par email sont protégés
**Le risque :** quelqu'un qui lit la base pourrait utiliser un lien d'invitation ou de réinitialisation.
**La solution :** ces liens contiennent un jeton aléatoire, et la base ne garde que son empreinte. Chaque lien a une durée limitée (48 h pour une invitation, 1 h pour un mot de passe oublié) et **ne marche qu'une seule fois**. Une nouvelle demande annule l'ancien lien.

### Deux jetons pour rester connecté
- L'**access token** (un JWT) est présenté à chaque requête. Il ne dure que **15 minutes** : s'il est volé, il ne sert pas longtemps.
- Le **refresh token** dure 7 jours et sert à obtenir un nouvel access token.
- **Rotation :** à chaque utilisation, le refresh token est remplacé par un nouveau. Si un ancien refresh token est réutilisé, c'est qu'il a probablement été volé : **toutes les sessions du compte sont fermées** par sécurité.

### Les changements prennent effet tout de suite
À chaque requête, l'API vérifie dans la base que le compte existe, qu'il est actif et quel est son rôle. Un compte désactivé est donc bloqué immédiatement, et un changement de rôle s'applique tout de suite, sans attendre la fin du jeton.

### Les sessions sont fermées quand il le faut
Quand on change son mot de passe avec « mot de passe oublié », ou quand un compte est désactivé, **toutes ses sessions ouvertes sont fermées**. Un éventuel voleur de session est déconnecté.

### L'API ne donne pas d'indices
- À la connexion, le message est le même pour « email inconnu » et « mauvais mot de passe ».
- « Mot de passe oublié » répond toujours la même chose, que le compte existe ou non.
- Un client qui demande le ticket de quelqu'un d'autre reçoit « introuvable » (404), pas « interdit ». On ne lui révèle même pas que ce ticket existe.

Comme ça, personne ne peut deviner quels emails ont un compte.

### Limiter les tentatives
**Le risque :** un robot essaie des milliers de mots de passe, ou envoie des milliers de requêtes.
**La solution :** par adresse IP et par période de 15 minutes, l'API autorise au maximum :
- **5** tentatives de connexion ratées ;
- **5** demandes « mot de passe oublié » ;
- **300** requêtes au total.

Au-delà, elle répond `429` et il faut attendre.

### Toutes les données sont vérifiées
Chaque donnée reçue est contrôlée avec la librairie **zod** avant d'être utilisée : bon type, champs obligatoires présents, longueur maximale, format de l'email… Par exemple, un titre de ticket fait au plus 150 caractères. Les emails sont mis en minuscules et sans espaces, pour que `Nina@Mail.com ` et `nina@mail.com` soient le même compte.

### Pas d'injection SQL
Toutes les requêtes à la base passent par **Prisma**, qui sépare toujours les données de la requête. Un texte malveillant ne peut pas être exécuté comme du code SQL.

---

## Le journal d'audit

Le journal d'audit garde une trace des **actions sensibles** : qui a fait quoi, sur quel compte, et quand.

| Action enregistrée | Quand |
| --- | --- |
| `USER_CREATED` | Un admin crée un compte |
| `USER_DEACTIVATED` | Un compte est désactivé |
| `USER_REACTIVATED` | Un compte est réactivé |
| `ROLE_CHANGED` | Le rôle d'un compte change (l'ancien et le nouveau rôle sont notés) |
| `PASSWORD_RESET` | Quelqu'un change son mot de passe avec « mot de passe oublié » |

- L'action et sa ligne dans le journal sont enregistrées **ensemble** : impossible d'avoir l'une sans l'autre.
- Le journal ne peut être ni modifié ni supprimé par l'API.
- Seul le **SUPER_ADMIN** peut le lire, avec `GET /audit-logs`, parce qu'il montre aussi les actions des ADMIN.

---

## Comment le code est organisé

### Les dossiers

```
src/
├── modules/          ← une partie par fonctionnalité
│   ├── auth/           (connexion, invitations, mot de passe)
│   ├── tickets/        (les tickets)
│   ├── users/          (les comptes)
│   └── audit/          (le journal d'audit)
├── middlewares/      ← les contrôles faits avant chaque route (connexion, rôle, limites, erreurs)
├── lib/              ← les outils partagés (base, jetons, mots de passe, emails, validation, pages)
├── config/           ← la lecture du fichier .env
├── docs/             ← le chargement de la documentation Swagger
└── types/            ← les types TypeScript partagés
prisma/               ← la structure de la base, ses migrations, le compte SUPER_ADMIN
docs/openapi.yaml     ← la documentation de l'API
tests/                ← les tests automatiques
.github/workflows/    ← la vérification automatique sur GitHub
```

### Chaque module a 4 fichiers

Exemple avec les tickets :

| Fichier | Son travail | Ce qu'il ne fait jamais |
| --- | --- | --- |
| `tickets.routes.ts` | Dire quelle adresse appelle quelle fonction, et quels contrôles passer avant | Contenir de la logique |
| `tickets.schemas.ts` | Décrire à quoi doivent ressembler les données reçues | — |
| `tickets.controller.ts` | Lire la requête, vérifier les données, appeler le service, renvoyer la réponse | Parler à la base de données |
| `tickets.service.ts` | Appliquer les règles (droits, ticket introuvable…) et lire ou écrire dans la base | Connaître la requête ou la réponse HTTP |

Chaque fichier a un seul rôle. Le code est donc plus facile à lire, à tester et à modifier.

### Comment une erreur est gérée

Quand un service rencontre un problème, il « lance » une erreur avec son code :

```typescript
throw new HttpError(404, "Ticket introuvable");
```

Un seul middleware, `errorHandler`, rattrape toutes les erreurs et les transforme en réponse `{ "error": "..." }`. Il n'y a donc pas de code de réponse d'erreur répété partout.

### Les tables de la base de données

| Table | Ce qu'elle contient |
| --- | --- |
| `users` | Les comptes : email, nom, rôle, actif ou non, empreinte du mot de passe |
| `tickets` | Les tickets : titre, description, statut, auteur |
| `invitations` | Les liens d'invitation envoyés |
| `refresh_tokens` | Les sessions de connexion |
| `password_reset_tokens` | Les liens « mot de passe oublié » |
| `audit_logs` | Le journal d'audit |

---

## Les tests et la vérification automatique

### Les tests

```bash
npm test
```

Le projet a **141 tests automatiques** (avec les outils Vitest et Supertest). Ils se lancent en une commande et vérifient en environ 25 secondes que tout fonctionne.

- **44 tests unitaires** vérifient de petites fonctions isolées : les jetons, les droits par rôle, les règles de validation, le calcul des pages.
- **97 tests d'intégration** envoient de vraies requêtes à l'API, comme le ferait Postman. Ils vérifient :
  - la connexion, les jetons et la déconnexion ;
  - les invitations et le mot de passe oublié ;
  - qu'un client ne voit que ses tickets, et que seul le support peut changer un statut ;
  - la gestion des comptes et les limites de chaque rôle ;
  - le journal d'audit ;
  - les erreurs et les limites de tentatives ;
  - que chaque route de la documentation Swagger existe vraiment dans le code.

Les tests utilisent **leur propre base de données**, `support_tickets_test`, pour ne jamais toucher aux vraies données. Il faut la créer une fois :

```bash
docker exec support-ticket-v2-db createdb -U postgres support_tickets_test
```

Par sécurité, les tests refusent de vider une base dont le nom ne finit pas par `_test`. Aucun vrai email n'est envoyé pendant les tests.

### La vérification automatique (CI)

À chaque fois que du code est envoyé sur GitHub, **GitHub Actions** lance automatiquement une base de données, vérifie les types et exécute les 141 tests. Si quelque chose casse, on le voit tout de suite dans l'onglet **Actions** du dépôt.

Le fichier qui décrit cette vérification : [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Les outils utilisés

| Outil | À quoi il sert |
| --- | --- |
| **Node.js** | Faire tourner le code JavaScript |
| **TypeScript** | Écrire du JavaScript plus sûr, avec des types |
| **Express** | Créer le serveur et les routes de l'API |
| **PostgreSQL** | La base de données |
| **Docker** | Lancer PostgreSQL sans l'installer |
| **Prisma** | Lire et écrire dans la base depuis le code |
| **bcryptjs** | Protéger les mots de passe |
| **jsonwebtoken** | Créer et vérifier les jetons de connexion (JWT) |
| **zod** | Vérifier les données reçues |
| **express-rate-limit** | Limiter le nombre de requêtes |
| **Resend** | Envoyer les emails |
| **Swagger UI** | Afficher la documentation interactive |
| **Vitest + Supertest** | Écrire et lancer les tests |
| **GitHub Actions** | Lancer les tests automatiquement |

---

## Ce qui a été construit, étape par étape

### Partie 1 : la base du projet
1. Mise en place du projet : TypeScript, Docker, Prisma et la table des tickets.
2. Un serveur Express avec 4 routes pour les tickets : créer, lister, afficher, changer le statut.

### Partie 2 : les comptes, la connexion et les rôles
3. Ajout des comptes, des 4 rôles et des tables pour les jetons.
4. Création automatique du compte SUPER_ADMIN.
5. Envoi d'emails avec Resend.
6. Connexion par email et mot de passe, avec un jeton JWT.
7. Refresh token avec rotation, et déconnexion.
8. Droits par rôle sur les tickets.
9. Création de comptes par un admin, avec invitation par email.
10. Mot de passe oublié, et emails toujours écrits de la même façon.
11. Désactivation, réactivation et changement de rôle d'un compte.

### Partie 3 : la qualité, la sécurité et la documentation
12. Réorganisation du code en routes, contrôleurs et services, avec une gestion des erreurs centralisée.
13. Vérification de toutes les données reçues avec zod.
14. Filtres, recherche, pages et tri sur les listes.
15. Limite générale du nombre de requêtes, et taille maximale des données envoyées.
16. Journal d'audit des actions sensibles.
17. 141 tests automatiques.
18. Vérification automatique sur GitHub à chaque envoi du code.
19. Documentation Swagger / OpenAPI, et ce README.

**Résultat :** toutes les consignes des parties 2 et 3 sont faites.
