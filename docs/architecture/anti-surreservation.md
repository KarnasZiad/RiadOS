# Anti-surréservation

Une surréservation coûte cher à un riad : relogement du client, commission perdue, mauvais avis.
RiadOS empile trois mécanismes, du plus rapide au plus sûr.

| Niveau | Mécanisme                                        | Rôle                                                      |
| ------ | ------------------------------------------------ | --------------------------------------------------------- |
| 1      | Verrou distribué Redis par chambre               | Sérialise les demandes concurrentes, échoue vite          |
| 2      | Transaction `SERIALIZABLE` avec relecture        | Détecte un conflit même si le verrou a expiré             |
| 3      | Contrainte d'exclusion PostgreSQL (`btree_gist`) | Garantie absolue, quelle que soit l'origine de l'écriture |

## Niveau 1 — Verrou Redis

```text
SET riados:lock:room:<roomId> <token aléatoire> NX PX 5000
```

- `NX` : le verrou n'est posé que s'il n'existe pas.
- `PX 5000` : il expire seul si le processus plante.
- La libération passe par un script Lua qui ne supprime la clé que si elle contient encore notre
  token : on ne libère jamais le verrou d'un autre processus.

Un verrou Redis simple n'est pas suffisant à lui seul (pause GC, expiration pendant le traitement,
bascule de réplica). Il sert à réduire la contention, pas à garantir la cohérence.

## Niveau 2 — Transaction SERIALIZABLE

Dans la transaction, l'API relit les réservations qui chevauchent la période demandée avant
d'insérer. En isolation `SERIALIZABLE`, si deux transactions lisent puis écrivent de manière
incompatible, PostgreSQL annule l'une d'elles (`40001 serialization_failure`, code Prisma `P2034`).
L'API rejoue alors la transaction jusqu'à trois fois avec un délai aléatoire.

## Niveau 3 — Contrainte d'exclusion

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status <> 'CANCELLED');
```

- `'[)'` : l'intervalle inclut la date d'arrivée et exclut la date de départ. Un départ le 12 et une
  arrivée le 12 dans la même chambre ne se chevauchent pas.
- La clause `WHERE` ignore les réservations annulées.
- Même une écriture qui contourne l'API (script, synchronisation iCal défaillante) est refusée.

## Déroulé d'une réservation

```mermaid
sequenceDiagram
  participant R as Réception A
  participant R2 as Réception B
  participant API
  participant Redis
  participant PG as PostgreSQL

  R->>API: POST /reservations (chambre 3, 10 → 12)
  R2->>API: POST /reservations (chambre 3, 11 → 13)
  API->>Redis: SET lock:room:3 NX PX 5000
  Redis-->>API: OK (A obtient le verrou)
  API->>Redis: SET lock:room:3 NX PX 5000
  Redis-->>API: nil (B attend et réessaie)
  API->>PG: BEGIN SERIALIZABLE ; SELECT chevauchements ; INSERT
  PG-->>API: COMMIT
  API->>Redis: Lua : DEL si token identique
  API-->>R: 201 Created
  API->>Redis: SET lock:room:3 NX PX 5000
  Redis-->>API: OK (B obtient le verrou)
  API->>PG: BEGIN SERIALIZABLE ; SELECT chevauchements
  PG-->>API: 1 chevauchement
  API-->>R2: 409 Conflict
```

## Tests

- Tests unitaires : calcul des nuits, détection de chevauchement, verrou (store en mémoire).
- Test d'intégration (Testcontainers) : plusieurs réservations concurrentes sur la même chambre et
  les mêmes dates, dont une seule doit aboutir ; insertion directe en SQL refusée par la contrainte.
