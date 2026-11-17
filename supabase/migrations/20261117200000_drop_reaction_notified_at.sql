-- Reaktioilmoitukset muistetaan reaction_notices-taulussa (20261116160000). Vanha sarake
-- jäi siirtymän ajaksi, ja push-funktio ei ole käyttänyt sitä versiosta 8 lähtien.
alter table public.reactions drop column notified_at;
