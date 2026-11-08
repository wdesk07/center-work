# WDESK — séparation TEST / PRODUCTION

## Architecture et séparation
- WDESK Control Center s'authentifie uniquement sur le projet WDESK TEST `nuijzdqnhjzcnqpfqvvl`.
- L'inventaire Aéro Service est lu par `GET /api/production`, qui reste strictement en lecture seule.
- Les commandes sont exclusivement envoyées à `POST /api/production/mutations`; aucune table, requête SQL ou cible de projet n'est fournie par le navigateur.
- Les URLs sont épinglées : WDESK TEST `nuijzdqnhjzcnqpfqvvl`, Aéro Service PRODUCTION `tsyhuuqtbcdpolhmmeri`.
- Le navigateur ne reçoit jamais la clé service-role.

## Vérification propriétaire
Chaque requête mutation vérifie :
1. Une session active WDESK TEST.
2. L'identité `wdesk87@gmail.com` via la fonction propriétaire WDESK TEST.
3. Le profil Aéro Service PRODUCTION correspondant, actif, avec les deux rôles `DIRECTOR` et `PRE_ADMIN`.
4. Le même acteur est revérifié dans la fonction SQL transactionnelle de production.
5. La fonction SQL est exécutable par `service_role` uniquement ; ni `authenticated` ni `public` ne disposent de l'exécution.

La fonction pose temporairement l'identité vérifiée dans le contexte de transaction afin que les fonctions et déclencheurs métier existants voient le véritable acteur. Cette identité n'est jamais acceptée depuis le navigateur.

## Opérations activées dans le périmètre allowlist
- Création / modification des formations, groupes, horaires et règles de pénalité.
- Création / révocation des suspensions de cours.
- Correction manuelle d'un pointage avec événement `correction` et audit.
- Décision sur une justification d'absence via la fonction métier existante.
- Décision sur une demande QR via la fonction métier existante, y compris création du pointage par les déclencheurs existants.
- Validation / refus d'un paiement en attente via les garde-fous existants ; le reçu et la régularisation sont générés par les déclencheurs de production.
- Modification des champs de profil non sensibles (identité affichée, téléphone, WhatsApp, adresse), suspension / réactivation du profil applicatif et attribution / retrait de rôles standards.
- Invitation d'un nouveau compte par e-mail via Supabase Auth Admin ; le profil est créé par le déclencheur existant, puis un rôle standard est attribué. Les rôles `DIRECTOR` et `PRE_ADMIN` sont exclus de l'invitation et des modifications ordinaires.

Toutes les mutations exigent un motif, une confirmation explicite et un identifiant de requête. Les actions transactionnelles sont consignées dans `audit_logs` avec l'ancien et le nouvel état. Les opérations financières restent soumises aux gardes de paiement, à l'immuabilité des montants et à la validation de pénalité correspondante.

## Variables Vercel requises
Côté serveur uniquement, d'abord dans Preview :
- `AERO_PRODUCTION_SUPABASE_URL=https://tsyhuuqtbcdpolhmmeri.supabase.co`
- `AERO_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` : clé secrète Aéro Service PRODUCTION.

Ne jamais utiliser de préfixe `NEXT_PUBLIC_` pour la clé secrète. Ne jamais ajouter cette clé dans le code, un fichier .env commité, le navigateur ou un log.

## Limites et contrôles restant à faire
- Aucune mise en production Vercel publique n'est autorisée par ce travail ; la validation continue sur Preview.
- La gestion Auth se limite à l'invitation et à la gestion des rôles/statuts applicatifs. La suppression de comptes, les changements d'e-mail et les resets de mot de passe ne sont pas exposés.
- Les opérations d'attribution ou de retrait des rôles `DIRECTOR` et `PRE_ADMIN` sont volontairement verrouillées.
- Les validations QR et financières ont été testées dans des transactions annulées ; les demandes en attente réelles étaient absentes au moment des essais.
- Le parcours d'invitation e-mail doit encore être validé avec une adresse de test autorisée et une session propriétaire réellement connectée.
- Les opérations de création/modification, corrections, décisions de justification, QR (approbation et rejet), validation/refus de paiement, attribution/retrait de rôle et mise à jour de profil ont été testées avec rollback ; aucune donnée réelle n'a été conservée par ces tests. La fonction de décision de justification a également été alignée sur la valeur de statut `excused_absence` autorisée par la contrainte de la table `attendance`.

## Vérifications
1. Sans variables PROD : réponse 503.
2. Sans session WDESK : réponse 401.
3. Session non propriétaire : réponse 403.
4. Propriétaire confirmé dans TEST et PROD : inventaire limité en lecture et accès aux commandes allowlist.
5. Vérifier chaque opération en Preview avec un compte de test, puis relire `audit_logs`.
6. Ne promouvoir aucune Preview en production sans accord explicite et vérification READY.
