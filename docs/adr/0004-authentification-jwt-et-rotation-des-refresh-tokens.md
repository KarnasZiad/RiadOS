# ADR 0004 — Authentification JWT et rotation des refresh tokens

- **Statut** : acceptée
- **Date** : 2026-10-19

## Contexte

L'application web est une SPA. Le personnel reste connecté toute la journée sur un poste partagé à
la réception. Il faut limiter l'impact d'un vol de jeton (XSS, poste non verrouillé).

## Décision

- **Jeton d'accès** JWT HS256 de 15 minutes, gardé **en mémoire** dans la SPA (jamais dans
  `localStorage`), envoyé dans l'en-tête `Authorization`.
- **Refresh token** opaque de 256 bits, envoyé dans un cookie `httpOnly; Secure; SameSite=Strict;
Path=/api/auth`, stocké en base sous forme de **hash SHA-256** uniquement.
- **Rotation** : chaque rafraîchissement consomme le refresh token et en émet un nouveau dans la même
  _famille_.
- **Détection de réutilisation** : présenter un refresh token déjà consommé révoque toute la famille.
  Le voleur et l'utilisateur légitime sont déconnectés ; l'utilisateur se reconnecte, pas le voleur.
- Mots de passe hachés en **Argon2id** (paramètres OWASP : 19 Mio, 2 itérations, parallélisme 1).

## Conséquences

- ✅ Un jeton d'accès volé n'est utilisable que 15 minutes.
- ✅ Un refresh token volé est détecté à sa première réutilisation.
- ✅ Une fuite de la base ne révèle aucun refresh token utilisable.
- ⚠️ La rotation impose une écriture en base à chaque rafraîchissement (une toutes les 15 minutes par
  utilisateur actif, négligeable).
- ⚠️ Deux onglets qui rafraîchissent en même temps peuvent déclencher une fausse détection de
  réutilisation : la SPA mutualise les rafraîchissements concurrents en une seule requête.

## Alternatives écartées

- **Sessions serveur seules** : valables, mais l'API sert aussi de futurs clients (PWA ménage, mobile).
- **JWT longue durée en `localStorage`** : exposé à toute XSS, non révocable.
