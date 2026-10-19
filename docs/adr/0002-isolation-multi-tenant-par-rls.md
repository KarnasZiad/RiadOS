# ADR 0002 — Isolation multi-tenant par Row-Level Security

- **Statut** : acceptée
- **Date** : 2026-10-19

## Contexte

RiadOS héberge plusieurs riads dans un même déploiement. Une fuite de données entre établissements
(fiches clients, chiffre d'affaires) serait rédhibitoire. Trois modèles existent :

| Modèle                         | Isolation                              | Coût d'exploitation | Migrations         |
| ------------------------------ | -------------------------------------- | ------------------- | ------------------ |
| Une base par tenant            | Forte                                  | Élevé               | N bases à migrer   |
| Un schéma par tenant           | Forte                                  | Moyen               | N schémas à migrer |
| Tables partagées + `tenant_id` | Faible si elle repose sur le code seul | Faible              | Une migration      |

## Décision

Tables partagées avec `tenant_id`, **protégées par la Row-Level Security de PostgreSQL** :

- politique `tenant_isolation` sur chaque table métier, avec `ENABLE` et `FORCE ROW LEVEL SECURITY` ;
- tenant transmis par `set_config('app.tenant_id', ..., true)` au début de chaque transaction ;
- API connectée avec un rôle qui n'est ni superutilisateur ni propriétaire des tables.

## Conséquences

- ✅ Un oubli de filtre dans le code ne fuit aucune donnée : la base renvoie zéro ligne.
- ✅ Une seule base à sauvegarder, migrer et surveiller.
- ⚠️ Toute requête métier doit passer dans une transaction (`TenantDb.run`) pour porter le contexte.
- ⚠️ Les tests d'intégration doivent tourner avec le rôle applicatif, sinon ils ne testent rien.
- ⚠️ Un tenant très volumineux impacte les autres ; une migration vers une base dédiée reste possible
  pour un gros client, car le `tenant_id` est déjà présent partout.

## Alternatives écartées

- **Une base par tenant** : sur-dimensionné pour des riads de 4 à 15 chambres.
- **Filtrage applicatif seul** : trop dépendant de la rigueur de chaque développeur.
