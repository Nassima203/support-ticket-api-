# Support Ticket API

## C'est quoi ?

Une API qui permet de gérer des tickets de support : quand un client a un problème, il ouvre un ticket, et l'équipe support le traite jusqu'à sa résolution.

Il n'y a pas d'interface graphique. On utilise l'API en lui envoyant des requêtes, par exemple avec la commande `curl` ou l'outil Postman.

## Ce qu'elle sait faire

1. **Créer un ticket** avec un titre, une description et l'email de la personne
2. **Lister tous les tickets**, du plus récent au plus ancien, ou seulement ceux d'un statut
3. **Afficher un ticket** à partir de son numéro
4. **Changer le statut** d'un ticket

## Les statuts d'un ticket

Un ticket passe par 4 étapes :

| Statut | Signification |
| --- | --- |
| `OPEN` | Le ticket vient d'être créé, personne ne s'en occupe encore |
| `IN_PROGRESS` | Quelqu'un du support travaille dessus |
| `RESOLVED` | Une solution a été trouvée |
| `CLOSED` | Le ticket est terminé |

Tout nouveau ticket commence en `OPEN`.

## Les outils utilisés

| Outil | À quoi il sert |
| --- | --- |
| Node.js | Faire tourner le code JavaScript sur l'ordinateur |
| Express | Créer le serveur et les routes de l'API |
| TypeScript | Écrire du JavaScript plus sûr, avec des types |
| PostgreSQL | Stocker les tickets dans une base de données |
| Docker | Lancer PostgreSQL sans l'installer sur l'ordinateur |
| Prisma | Lire et écrire dans la base depuis le code |

## Les routes

| Action | Méthode | Adresse |
| --- | --- | --- |
| Créer un ticket | `POST` | `/tickets` |
| Lister les tickets | `GET` | `/tickets` |
| Lister les tickets d'un statut | `GET` | `/tickets?status=OPEN` |
| Afficher un ticket | `GET` | `/tickets/1` |
| Changer le statut | `PATCH` | `/tickets/1/status` |

## Les réponses de l'API

Chaque réponse contient un code qui indique si tout s'est bien passé :

| Code | Signification |
| --- | --- |
| `200` | Tout s'est bien passé |
| `201` | Le ticket a bien été créé |
| `400` | Les données envoyées ne sont pas valides (champ manquant, statut inconnu…) |
| `404` | Le ticket demandé n'existe pas |
| `500` | Erreur inattendue du serveur |

En cas d'erreur, l'API explique le problème : `{ "error": "Ticket introuvable" }`

## Lancer le projet

Il faut avoir installé **Node.js** et **Docker Desktop**.

```bash
# 1. Récupérer le projet
git clone https://github.com/Nassima203/support-ticket-api-.git
cd support-ticket-api-

# 2. Installer les librairies
npm install

# 3. Créer le fichier de configuration
cp .env.example .env

# 4. Démarrer la base de données
docker compose up -d

# 5. Créer la table des tickets
npx prisma migrate dev

# 6. Démarrer l'API
npm run dev
```

L'API est alors disponible sur `http://localhost:3000`.

## Exemples

**Créer un ticket**

```bash
curl -X POST http://localhost:3000/tickets -H "Content-Type: application/json" -d '{"title":"Impossible de me connecter","description":"Erreur sur la page de connexion","authorEmail":"client@mail.com"}'
```

**Voir tous les tickets**

```bash
curl http://localhost:3000/tickets
```

**Passer le ticket 1 en cours de traitement**

```bash
curl -X PATCH http://localhost:3000/tickets/1/status -H "Content-Type: application/json" -d '{"status":"IN_PROGRESS"}'
```