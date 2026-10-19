# ADR 0003 — Anti-surréservation en trois niveaux

- **Statut** : acceptée
- **Date** : 2026-10-19

## Contexte

Deux réceptionnistes, ou une réceptionniste et une synchronisation iCal, peuvent réserver la même
chambre au même moment. Le cahier des charges exige qu'aucun chevauchement ne soit possible (EF-02).

## Décision

1. **Verrou distribué Redis** par chambre (`SET NX PX`, libération par script Lua avec token).
2. **Transaction `SERIALIZABLE`** qui relit les chevauchements avant d'insérer, rejouée jusqu'à trois
   fois en cas d'erreur de sérialisation.
3. **Contrainte d'exclusion** PostgreSQL sur `(room_id, daterange(check_in, check_out, '[)'))`.

Le détail est décrit dans [anti-surreservation.md](../architecture/anti-surreservation.md).

## Conséquences

- ✅ La contrainte d'exclusion est la source de vérité : la cohérence ne dépend ni de Redis ni du code.
- ✅ Le verrou évite que les transactions concurrentes s'annulent mutuellement en boucle ; l'utilisateur
  reçoit vite une réponse claire (`409`).
- ⚠️ Dépendance à l'extension `btree_gist`, disponible sur RDS, Neon et l'image Docker officielle.
- ⚠️ Prisma ne connaît pas les contraintes d'exclusion : elles vivent dans le SQL de migration et
  sont couvertes par un test d'intégration.

## Alternatives écartées

- **Verrou Redis seul** : non sûr en cas d'expiration pendant le traitement (pas de fencing token).
- **`SELECT ... FOR UPDATE`** : ne verrouille que des lignes existantes ; une réservation qui n'existe
  pas encore ne peut pas être verrouillée.
- **Table « nuitées » avec une ligne par chambre et par nuit et une contrainte d'unicité** : efficace,
  mais elle multiplie les écritures et complique les modifications de séjour.
