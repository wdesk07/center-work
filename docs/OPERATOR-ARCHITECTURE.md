# WDESK Operator — architecture et règles de sécurité

## Objectif
Permettre au propriétaire de piloter les projets en langage naturel, sans écrire de code ni manipuler les consoles fournisseurs.

## Mode initial
- Route UI : /operator
- Authentification : session Supabase existante, vérifiée côté serveur par /api/control.
- Capacités actives dans cette première étape : consultations en lecture seule du registre projets, diagnostics agrégés, incidents et journal d'audit.
- Les demandes reconnues sont routées vers les données réellement retournées par l'API. Les demandes inconnues sont explicitement déclarées non prises en charge.
- Aucun faux résultat, aucune mutation, aucune réparation automatique dans cette étape.

## Architecture cible
1. Interface conversationnelle en français.
2. Classificateur/agent côté serveur avec sortie structurée : intent, projet cible, environnement, risque, outils nécessaires, justification.
3. Registre de capacités et permissions par outil (read / propose / execute).
4. Plan d'action explicable, avec prévisualisation du diff et estimation des impacts.
5. Approbation explicite du propriétaire pour toute écriture, migration, déploiement, suppression, changement d'accès ou opération financière.
6. Exécution côté serveur avec secrets isolés, privilèges minimaux, idempotence et délais contrôlés.
7. Vérification post-action indépendante et journal d'audit immuable.
8. Arrêt sûr et retour arrière lorsque la vérification échoue.

## Politique de sécurité
- TEST par défaut ; PROD nécessite une confirmation explicite séparée.
- Ne jamais mélanger projets, clés, bases, déploiements ou comptes entre environnements.
- Jamais exposer de secret dans le navigateur, le chat ou les logs.
- Les demandes ambiguës ou à risque sont clarifiées, jamais devinées.
- Aucun changement destructif ou irréversible sans approbation spécifique.
- Une opération n'est annoncée comme réussie qu'après vérification effective.

## Intégration IA
Le code de l'assistant IA n'est pas activé dans cette version. L'intégration d'un fournisseur (par exemple Vercel AI Gateway) attend une autorisation explicite et une configuration serveur sécurisée. Aucun coût externe n'est engagé par ce mode initial.
