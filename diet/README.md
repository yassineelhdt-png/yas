# Mon suivi

Suivi quotidien : compléments (matin, midi, 16h, soir), sommeil, check-ins (humeur, énergie, concentration, faim),
repas et notes. Vues Jour, Semaine, Année et Réglages.

`mon-suivi.html` est la source de l'artefact Claude « Mon suivi » (capacités `db`, `user`, `downloads`).
Le fichier ne contient pas de `<!doctype>` ni de `<head>` : l'artefact les ajoute à la publication.

## Données

- **Compte Claude** : `data/users/<id>/settings` (la liste) et un document par mois, `data/users/<id>/mAAAA-MM`
  (`{ days: { "AAAA-MM-JJ": { taken, wake, bed, checkins, meals, notes } } }`). Seuls les champs modifiés
  sont envoyés, pour ne pas écraser ce qu'un autre appareil écrit en même temps.
- **Copie sur l'appareil** (`localStorage`, clé `mon-suivi-cloud-v1`) : affichage immédiat au chargement et
  modifications pas encore confirmées par le compte, renvoyées au prochain chargement ou au retour du réseau.
- **Sans compte** (page ouverte hors de Claude) : tout reste dans le navigateur, clé `mon-suivi-v1`.

La sauvegarde JSON (Réglages → Faire une sauvegarde) garde le même format que la première version.
