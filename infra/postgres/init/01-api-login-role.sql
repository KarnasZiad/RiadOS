-- Local development only (docker compose). Runs once, when the data volume is created.
--
-- riados_app carries the table privileges (granted by the first migration). riados_api is the
-- login role of the API: it is neither a superuser nor the owner of the tables, so Row-Level
-- Security applies to every query it runs. In production these roles are provisioned by
-- infrastructure code with a generated password.
CREATE ROLE riados_app NOLOGIN;
CREATE ROLE riados_api LOGIN PASSWORD 'riados_api' IN ROLE riados_app;
