# WDESK CONTROL CENTER

Centre de contrôle indépendant pour les projets et infrastructures WDESK.

## Architecture et état actuel

- Application Next.js avec authentification Supabase par lien e-mail.
- API serveur Next.js qui transmet le jeton de session à une Edge Function.
- Edge Function `wdesk-control-api` déployée sur le projet Supabase Aéro Service TEST.
- Schéma PostgreSQL isolé : `wdesk_control`.
- Identité propriétaire préenregistrée : `wdesk87@gmail.com`.
- La liaison propriétaire n'est terminée qu'après connexion par e-mail vérifié et validation par l'Edge Function.

## Configuration Vercel

Ajouter ces variables pour Production, Preview et Development :

- `NEXT_PUBLIC_SUPABASE_URL` : URL du projet Aéro Service TEST.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : clé publishable du même projet.

Ces deux valeurs sont des paramètres publics destinés au client. **Ne jamais ajouter une clé `service_role` à Vercel sous un nom `NEXT_PUBLIC_*`, ni dans le dépôt.** La clé de service reste uniquement dans l'environnement sécurisé de l'Edge Function.

Configurer dans Supabase Auth les URL de redirection autorisées pour le domaine Vercel du centre, notamment `https://center-work.vercel.app/auth/callback`, ainsi que les URL de développement local si nécessaire.

## Première activation du propriétaire

1. Ouvrir le centre et saisir `wdesk87@gmail.com`.
2. Ouvrir le lien de connexion reçu par e-mail.
3. Le callback redirige vers `/activate-owner`.
4. L'Edge Function vérifie l'adresse confirmée contre l'inscription propriétaire préexistante, lie l'identité Auth et attribue le rôle propriétaire.
5. L'accès au tableau de bord est ensuite vérifié côté serveur à chaque requête protégée.

Un autre compte ne peut pas s'attribuer le rôle propriétaire simplement en créant une session Supabase.

## Développement local

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Sécurité et limites

- L'interface ne contient aucune clé privilégiée.
- Les opérations fournisseur (déploiements, SQL administratif, gestion de comptes externes) restent désactivées tant que leurs connecteurs et autorisations dédiés ne sont pas configurés.
- Aucune connexion à Aéro Service PROD n'est autorisée par défaut.
- Le projet Aéro Service TEST héberge provisoirement le registre et l'API du centre : sa disponibilité dépend donc encore de TEST.
- Le dépôt contient uniquement le code source et des noms de variables, jamais de secrets.

## Contrôles avant mise en production

- Vérifier le build Next.js et les redirections Auth.
- Vérifier la liaison de l'identité propriétaire.
- Tester les accès non authentifiés et les comptes non propriétaires.
- Vérifier que chaque opération administrative produit un événement d'audit.
- Mettre en place une base indépendante avant de retirer la dépendance temporaire à Aéro Service TEST.
