# Contribuer à RiadOS

## Flux de travail

1. Créer une branche depuis `main` : `feat/<sujet>`, `fix/<sujet>`, `docs/<sujet>`, `chore/<sujet>`.
2. Commiter en [Conventional Commits](https://www.conventionalcommits.org/fr/) ; commitlint le vérifie
   au moment du commit (`feat(booking): add room calendar`).
3. Ouvrir une pull request vers `main` en remplissant le template (checklists sécurité et performance).
4. La CI doit être verte : format, lint, typecheck, tests unitaires avec couverture, build, tests
   d'intégration, image Docker, CodeQL et Trivy.
5. Fusion en _squash merge_. `main` est protégée : pas de push direct, pull request et checks CI
   obligatoires. Le dépôt a un seul mainteneur, donc aucune approbation n'est exigée ; en équipe,
   la règle passe à une approbation d'un code owner (`CODEOWNERS`).

## Prérequis

- Node.js 22 (`.nvmrc`) et pnpm 10 via Corepack (`corepack enable`)
- Docker, pour PostgreSQL et Redis en local et pour les tests d'intégration

## Commandes

| Commande                | Rôle                                                 |
| ----------------------- | ---------------------------------------------------- |
| `pnpm dev`              | API et front en mode watch                           |
| `pnpm lint`             | ESLint avec règles typées, zéro avertissement toléré |
| `pnpm typecheck`        | TypeScript strict sur tous les packages              |
| `pnpm test`             | Tests unitaires (Vitest)                             |
| `pnpm test:coverage`    | Tests unitaires avec seuils de couverture (80 %)     |
| `pnpm test:integration` | Tests d'intégration Testcontainers (Docker requis)   |
| `pnpm format`           | Prettier                                             |

## Règles de code

- TypeScript strict, pas de `any` : les données externes sont validées par un schéma Zod.
- Logique métier dans `domain/` sans dépendance au framework, testée unitairement.
- Toute lecture ou écriture de données métier passe par `TenantDb.run` (Row-Level Security).
- Une décision d'architecture difficile à inverser fait l'objet d'un ADR dans `docs/adr/`.

## Revue de code

Le relecteur vérifie, en plus de l'exactitude fonctionnelle :

- **Sécurité** : validation des entrées, contrôle d'accès par rôle et par tenant, secrets, fuites
  d'information dans les erreurs et les logs.
- **Performance** : requêtes N+1, index, pagination, travail synchrone qui devrait être asynchrone.
- **Lisibilité** : noms explicites, fonctions courtes, tests qui décrivent le comportement attendu.
