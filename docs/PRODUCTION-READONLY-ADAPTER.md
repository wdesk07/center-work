# WDESK — séparation TEST / PRODUCTION

## Règle de sécurité
- Le panneau WDESK et son registre propriétaire restent authentifiés sur le projet WDESK TEST `nuijzdqnhjzcnqpfqvvl`.
- Les données Aéro Service PRODUCTION sont lues par une route serveur dédiée `GET /api/production`.
- Cette route vérifie d'abord la session puis le propriétaire auprès de la fonction `wdesk-owner-commands` de WDESK TEST.
- Elle utilise ensuite les identifiants serveur PRODUCTION, jamais exposés au navigateur.
- Le projet PRODUCTION attendu est épinglé au ref `tsyhuuqtbcdpolhmmeri`.
- La route n'accepte aucune écriture : `POST` renvoie 405. Pas de commande arbitraire, SQL, Auth Admin ni mutation.

## Variables Vercel requises
Configurer côté serveur uniquement, pour l'environnement Preview en premier :
- `AERO_PRODUCTION_SUPABASE_URL=https://tsyhuuqtbcdpolhmmeri.supabase.co`
- `AERO_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` : clé secrète du projet Aéro Service PRODUCTION.

Ne jamais utiliser de préfixe `NEXT_PUBLIC_` pour la clé secrète. Ne jamais ajouter cette clé dans le code, un fichier .env commité, le navigateur ou un log.

## Portée de l'aperçu lecture seule
La route expose des listes plafonnées de profils, apprenants, personnel, formateurs, formations, groupes, inscriptions, présences, événements, séances, horaires, rôles, permissions, règles/pénalités, paiements, appareils borne, demandes QR, jours d'activité, suspensions, paramètres et audit. Les identifiants Auth, secrets des appareils et jetons ne sont pas retournés.

## Limites assumées
- Ce premier adaptateur n'active aucune commande de modification en production.
- La clé service-role a des privilèges techniques étendus : elle est confinée au serveur Vercel et le code de cette route est strictement en lecture seule. Avant toute ouverture des commandes, remplacer cette lecture par un rôle DB dédié à privilèges SELECT uniquement et des fonctions de mutation séparées avec journalisation transactionnelle.
- La vérification propriétaire dépend du registre WDESK TEST; la production n'héberge pas de copie du registre propriétaire.
- Si un tableau ou champ attendu est absent, l'inventaire échoue fermé avec une erreur, sans tenter de réparer ou modifier le schéma.

## Tests à effectuer avant toute activation
1. Sans variables de production : réponse 503 `production_readonly_not_configured`.
2. Sans session WDESK : réponse 401.
3. Session non propriétaire : réponse 403.
4. Propriétaire vérifié : inventaire `environment=production`, `writable=false`, ref exact.
5. Toute requête POST : réponse 405.
6. Vérifier dans les journaux qu'aucune requête d'écriture ne part vers le projet de production.
