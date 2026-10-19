# ADR 0001 — Enregistrer les décisions d'architecture

- **Statut** : acceptée
- **Date** : 2026-10-19

## Contexte

Les choix structurants d'un projet (découpage, base de données, sécurité) sont souvent oubliés ou
remis en cause faute de trace écrite expliquant pourquoi ils ont été faits.

## Décision

Chaque décision structurante est consignée dans un ADR au format de Michael Nygard : contexte,
décision, conséquences et alternatives écartées. Les ADR sont numérotés, versionnés avec le code et
relus dans la pull request qui introduit la décision. Un ADR accepté n'est pas modifié : une nouvelle
décision le remplace (`Statut : remplacée par ADR 00XX`).

## Conséquences

- Un nouveau développeur comprend l'historique sans dépendre de la mémoire de l'équipe.
- Rédiger un ADR prend environ 30 minutes ; c'est réservé aux décisions difficiles à inverser.
