# WDESK CONTROL CENTER

Centre de contrôle indépendant pour les projets et infrastructures WDESK.

## État actuel

Cette première version fournit une interface de pilotage responsive et une fondation de données isolée dans le schéma PostgreSQL `wdesk_control` du projet Supabase Aéro Service TEST.

### Important

- L'interface est une fondation visuelle : les modules fournisseurs ne sont pas encore connectés.
- Le compte propriétaire `wdesk87@gmail.com` est inscrit dans le registre, mais doit encore être lié à une identité Supabase Auth vérifiée.
- Aucune clé `service_role` ne doit être placée dans le navigateur ou dans une variable `NEXT_PUBLIC_*`.
- Ne jamais connecter la production Aéro Service avant validation explicite et mise en place des protections.
- Le projet TEST héberge provisoirement la base du centre : sa disponibilité dépend donc de ce projet.

## Développement local

```bash
npm install
npm run dev
```

## Variables d'environnement

À configurer côté serveur uniquement après mise en place des routes sécurisées :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Aucune action administrative réelle ne doit être exposée sans authentification, autorisation serveur, journalisation et confirmation des opérations sensibles.
