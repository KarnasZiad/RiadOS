## Objectif

<!-- Quel problème cette PR résout-elle ? Lien vers la user story ou l'issue (ex. US-12, #42). -->

## Changements

-

## Comment tester

<!-- Étapes reproductibles pour le relecteur. -->

## Checklist de l'auteur

- [ ] Le titre suit les Conventional Commits (`feat(booking): ...`)
- [ ] Tests ajoutés ou mis à jour ; `pnpm test` et `pnpm lint` passent en local
- [ ] Documentation et ADR mis à jour si une décision d'architecture change

## Checklist sécurité

- [ ] Toutes les entrées externes sont validées (schéma Zod)
- [ ] Les accès aux données métier passent par `TenantDb.run` (RLS)
- [ ] Les nouvelles routes ont les bons `@Roles()` ; aucune route `@Public()` non justifiée
- [ ] Aucun secret, jeton ou donnée personnelle dans le code, les logs ou les tests
- [ ] Les erreurs renvoyées au client ne divulguent pas d'information interne

## Checklist performance

- [ ] Pas de requête N+1 ; les nouvelles requêtes sont couvertes par un index
- [ ] Les listes sont paginées (curseur) et bornées (`limit` maximal)
- [ ] Pas de traitement lourd dans la requête HTTP (worker BullMQ si nécessaire)
