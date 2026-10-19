# Modèle de données

Schéma géré par Prisma (`apps/api/prisma/schema.prisma`). Les éléments que Prisma ne sait pas
exprimer (RLS, contrainte d'exclusion, rôles) sont ajoutés en SQL dans la migration initiale.

```mermaid
erDiagram
  tenants ||--o{ users : emploie
  tenants ||--o{ rooms : possede
  tenants ||--o{ guests : accueille
  tenants ||--o{ reservations : enregistre
  users ||--o{ refresh_tokens : detient
  rooms ||--o{ reservations : concerne
  guests ||--o{ reservations : effectue

  tenants {
    uuid id PK
    text name
    text slug UK
    char3 currency
    text timezone
  }
  users {
    uuid id PK
    uuid tenant_id FK
    text email UK
    text password_hash
    enum role "OWNER | RECEPTION | HOUSEKEEPING"
  }
  refresh_tokens {
    uuid id PK
    uuid user_id FK
    uuid family_id
    text token_hash UK
    timestamptz expires_at
    timestamptz revoked_at
  }
  rooms {
    uuid id PK
    uuid tenant_id FK
    text name
    int capacity
    int base_rate_cents
    bool is_active
  }
  guests {
    uuid id PK
    uuid tenant_id FK
    text full_name
    text email
    text phone
  }
  reservations {
    uuid id PK
    uuid tenant_id FK
    uuid room_id FK
    uuid guest_id FK
    date check_in
    date check_out
    enum status
    int total_cents
  }
```

## Index

| Table            | Index                              | Requête servie                                 |
| ---------------- | ---------------------------------- | ---------------------------------------------- |
| `reservations`   | `(tenant_id, check_in, id)`        | Liste paginée par curseur sur une période      |
| `reservations`   | `(tenant_id, room_id, check_in)`   | Disponibilités d'une chambre                   |
| `reservations`   | GiST `(room_id, daterange)`        | Contrainte d'exclusion anti-chevauchement      |
| `rooms`          | unique `(tenant_id, name)`         | Unicité du nom d'une chambre par établissement |
| `guests`         | `(tenant_id, full_name)`           | Recherche d'un client                          |
| `refresh_tokens` | unique `token_hash`, `(family_id)` | Rotation et révocation d'une famille de jetons |

## Conventions

- Clés primaires UUID : pas d'identifiant séquentiel devinable exposé dans les URL.
- Montants en centimes (`int`) : pas d'erreur d'arrondi des flottants.
- Dates de séjour en `date` (sans heure) : une nuit est une date, indépendante du fuseau horaire.
- Horodatages en `timestamptz`.
