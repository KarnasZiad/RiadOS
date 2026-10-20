# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir d'issue publique. Utilisez le formulaire privé de GitHub :
[Security → Report a vulnerability](https://github.com/KarnasZiad/RiadOS/security/advisories/new).

Indiquez la version ou le commit concerné, les étapes pour reproduire et l'impact estimé. L'objectif
est d'accuser réception sous 72 heures.

## Mesures en place

| Domaine           | Mesure                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| Isolation         | Row-Level Security PostgreSQL par tenant, rôle applicatif sans privilège d'admin     |
| Authentification  | Argon2id, JWT de 15 minutes, refresh tokens hachés avec rotation et détection de vol |
| Entrées           | Validation Zod de chaque corps, requête et paramètre                                 |
| HTTP              | Helmet (CSP, HSTS…), CORS restreint, limitation de débit renforcée sur la connexion  |
| Logs              | En-têtes `Authorization` et cookies masqués                                          |
| Chaîne logicielle | Actions GitHub épinglées par SHA, Dependabot, CodeQL, Trivy, revue des dépendances   |
