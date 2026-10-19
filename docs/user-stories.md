# User stories

Priorisation MoSCoW. Chaque story est livrée avec ses tests et passe la checklist de revue de code.

## Epic 1 — Compte et accès

**US-01 · Créer mon établissement** — _Must_

> En tant que propriétaire, je veux créer le compte de mon riad pour commencer à gérer mes chambres.

- Étant donné un formulaire avec le nom du riad, mon nom, mon e-mail et un mot de passe d'au moins
  12 caractères, quand je le valide, alors l'établissement et mon compte propriétaire sont créés et je
  suis connecté.
- Un e-mail déjà utilisé est refusé sans révéler à quel établissement il appartient.

**US-02 · Me connecter en sécurité** — _Must_

> En tant que membre du personnel, je veux me connecter et rester connecté pendant ma journée de travail.

- Le jeton d'accès expire après 15 minutes et il est renouvelé de façon transparente.
- Le refresh token est stocké dans un cookie `httpOnly`, `Secure`, `SameSite=Strict`.
- La réutilisation d'un refresh token déjà consommé révoque toute la session (détection de vol).

**US-03 · Gérer mon équipe** — _Should_

> En tant que propriétaire, je veux inviter la réception et le ménage avec des droits limités.

## Epic 2 — Réservations (bounded context Booking)

**US-10 · Gérer mes chambres** — _Must_

> En tant que propriétaire, je veux déclarer mes chambres avec leur capacité et leur tarif de base.

- Le nom d'une chambre est unique dans l'établissement.
- Seul le propriétaire peut créer ou modifier une chambre.

**US-11 · Voir les disponibilités** — _Must_

> En tant que réceptionniste, je veux voir sur un calendrier quelles chambres sont libres sur les
> 14 prochains jours.

**US-12 · Créer une réservation sans risque de surréservation** — _Must_

> En tant que réceptionniste, je veux enregistrer une réservation et avoir la garantie qu'aucune autre
> réservation ne chevauche les mêmes nuits.

- Deux réservations concurrentes sur la même chambre et les mêmes nuits : une seule réussit, l'autre
  reçoit une erreur `409 Conflict`.
- Le départ d'un client et l'arrivée d'un autre le même jour sont autorisés.
- Le nombre de personnes ne peut pas dépasser la capacité de la chambre.
- Le montant est calculé par le serveur à partir du tarif de la chambre.

**US-13 · Annuler une réservation** — _Must_

> En tant que réceptionniste, je veux annuler une réservation pour libérer la chambre.

**US-14 · Déplacer une réservation par glisser-déposer** — _Could_

## Epic 3 — Facturation (bounded context Billing)

**US-20 · Générer la facture au départ** — _Should_

> En tant que réceptionniste, je veux qu'une facture PDF numérotée soit générée au départ du client.

- La génération se fait dans un worker séparé : l'API répond immédiatement.
- La numérotation est continue par établissement et par année (`2026-000123`).

**US-21 · Encaisser un acompte en ligne** — _Could_

## Epic 4 — Ménage (bounded context Housekeeping)

**US-30 · Recevoir ma liste de chambres à nettoyer** — _Should_

> En tant qu'agent de ménage, je veux voir les chambres libérées ce matin, même sans réseau.

**US-31 · Signaler une chambre prête** — _Should_
