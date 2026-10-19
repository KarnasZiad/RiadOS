# Cahier des charges — RiadOS

## 1. Contexte

Marrakech compte plus d'un millier de riads et de maisons d'hôtes, la plupart de 4 à 15 chambres.
Leur gestion repose encore souvent sur un tableur, un agenda papier et les extranets de Booking.com
et d'Airbnb consultés séparément. Conséquences observées : surréservations en haute saison, factures
saisies à la main, aucune visibilité sur l'état des chambres pour l'équipe de ménage.

RiadOS est un **PMS (Property Management System) en SaaS multi-tenant** : un seul déploiement sert
tous les établissements, chacun étant isolé des autres.

## 2. Objectifs

| Objectif                                     | Indicateur de succès                                    |
| -------------------------------------------- | ------------------------------------------------------- |
| Supprimer les surréservations                | Aucun chevauchement possible, garanti par la base       |
| Réduire le temps de saisie d'une réservation | Moins d'une minute depuis le calendrier                 |
| Facturer sans ressaisie                      | Facture PDF générée automatiquement au départ du client |
| Coordonner le ménage                         | Statut de chaque chambre visible en temps réel          |

## 3. Acteurs

| Rôle             | Description                                  | Droits principaux                                 |
| ---------------- | -------------------------------------------- | ------------------------------------------------- |
| **Propriétaire** | Gérant du riad, crée le compte établissement | Tout : chambres, tarifs, personnel, facturation   |
| **Réception**    | Accueil des clients                          | Réservations, arrivées et départs, fiches clients |
| **Ménage**       | Personnel d'entretien                        | Tâches de ménage, statut des chambres             |
| _Systèmes tiers_ | Booking.com, Airbnb (iCal), Stripe, CMI      | Synchronisation des disponibilités, paiements     |

## 4. Périmètre

### MVP (v1)

- Inscription d'un établissement (tenant) et de son propriétaire.
- Authentification JWT avec rotation des refresh tokens ; rôles propriétaire, réception et ménage.
- Gestion des chambres (capacité, tarif de base).
- Calendrier des disponibilités et création de réservations sans surréservation possible.
- Liste des réservations paginée par curseur, annulation.

### v2

- Facturation : factures PDF générées par un worker BullMQ, paiement Stripe en mode test avec un
  adaptateur prévu pour le CMI.
- Housekeeping : tâches de ménage générées au départ du client, application PWA hors-ligne.
- Glisser-déposer dans le calendrier.

### Extensions

- Channel manager : synchronisation iCal avec Airbnb et Booking.com.
- Tarification dynamique selon la saison et le taux d'occupation.
- Interface FR, EN et AR avec mise en page de droite à gauche.

### Hors périmètre

- Comptabilité générale, paie du personnel, point de vente du restaurant.

## 5. Exigences fonctionnelles

| ID    | Exigence                                                                              | Priorité |
| ----- | ------------------------------------------------------------------------------------- | -------- |
| EF-01 | Un établissement ne voit jamais les données d'un autre établissement                  | Must     |
| EF-02 | Une chambre ne peut pas être réservée deux fois sur des nuits qui se chevauchent      | Must     |
| EF-03 | Le prix d'un séjour est calculé par le serveur, jamais accepté tel quel du client     | Must     |
| EF-04 | Les droits dépendent du rôle : seul le propriétaire gère les chambres et le personnel | Must     |
| EF-05 | Le calendrier affiche toutes les chambres sur une période glissante de 14 jours       | Must     |
| EF-06 | Une réservation annulée libère immédiatement les nuits correspondantes                | Must     |
| EF-07 | Une facture PDF est générée au départ du client                                       | Should   |
| EF-08 | Les disponibilités sont exportées en iCal pour Airbnb et Booking.com                  | Could    |

## 6. Exigences non fonctionnelles

| Catégorie       | Exigence                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Sécurité        | OWASP Top 10, mots de passe en Argon2id, JWT courts (15 min), refresh token en cookie httpOnly avec rotation |
| Sécurité        | Validation de toutes les entrées (Zod), en-têtes HTTP durcis (Helmet), limitation de débit                   |
| Confidentialité | Données des clients conformes à la loi 09-08 (CNDP) : minimisation, droit d'accès                            |
| Performance     | p95 inférieur à 200 ms en lecture pour 50 chambres et 10 000 réservations                                    |
| Performance     | Index composites `(tenant_id, date)`, pagination par curseur (pas d'`OFFSET`)                                |
| Disponibilité   | Healthchecks de la base et de Redis, redémarrage automatique des conteneurs                                  |
| Observabilité   | Logs JSON structurés (Pino) avec identifiant de requête                                                      |
| Qualité         | TypeScript strict, couverture de tests supérieure à 80 %, revue obligatoire avant fusion                     |

## 7. Contraintes

- Stack imposée : React et TypeScript côté front, Node.js (NestJS) côté API, PostgreSQL et Redis.
- Hébergement économique : un VPS avec Docker Compose doit suffire pour les premiers clients.
- Monnaie par défaut : dirham marocain (MAD) ; fuseau horaire `Africa/Casablanca`.

## 8. Jalons

| Jalon | Contenu                                                 |
| ----- | ------------------------------------------------------- |
| J1    | Socle technique, CI/CD, authentification, multi-tenancy |
| J2    | Chambres, calendrier, réservations sans surréservation  |
| J3    | Facturation PDF et paiement                             |
| J4    | Housekeeping et PWA                                     |
| J5    | Channel manager, i18n FR/EN/AR, mise en production      |
