# ADR 0005 — Politique de versions des dépendances

- **Statut** : acceptée
- **Date** : 2026-10-19

## Contexte

La fiche projet mentionne React 18. En octobre 2026, plusieurs dépendances ont publié des versions
majeures récentes dont l'écosystème n'a pas encore suivi. Il faut choisir entre « le plus récent » et
« le plus sûr ».

## Décision

On retient la dernière version majeure **supportée par tout l'écosystème du projet**, et on
documente les écarts :

| Dépendance | Version retenue | Raison                                                                               |
| ---------- | --------------- | ------------------------------------------------------------------------------------ |
| Node.js    | 22 LTS          | LTS jusqu'en avril 2027                                                              |
| TypeScript | 5.9             | typescript-eslint ne supporte pas encore TypeScript 7                                |
| ESLint     | 10              | ESLint 9 n'est plus supporté                                                         |
| React      | 19              | React 18 ne reçoit plus de nouvelles versions ; l'API utilisée est identique         |
| Vite       | 8               | Version courante, requise par `@vitejs/plugin-react` 6                               |
| NestJS     | 11              | NestJS 12 impose ESM (`type: module`) ; migration ESM planifiée dans une PR dédiée   |
| Prisma     | 6               | Prisma 7 change le client généré et impose les driver adapters ; migration planifiée |
| PostgreSQL | 17              | Version supportée par RDS et Neon                                                    |

Les versions sont figées par `pnpm-lock.yaml`. Dependabot propose chaque semaine les mises à jour,
qui passent par la CI comme n'importe quelle pull request.

## Conséquences

- ✅ Aucune dépendance non supportée ni avertissement de compatibilité dans la CI.
- ⚠️ Deux montées de version majeures (NestJS 12, Prisma 7) restent à planifier ; elles feront chacune
  l'objet d'une pull request dédiée.
