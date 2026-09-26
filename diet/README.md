# Mon suivi

Journal santé quotidien : compléments (matin, midi, 16h, soir), sommeil, check-ins (humeur, énergie,
concentration, stress, douleur, faim), ce que je ressens (douleurs, sensations, effets secondaires), repas avec
aliments et macros (protéines, glucides, lipides, calories) et notes. Vues Jour, Semaine, Année et Réglages.

**Visite médicale toutes les 4 semaines** (première le lundi 28 septembre 2026, réglable) : pesée, prise de sang
(valeurs avec repères habituels), avis du médecin, et bilan des 28 jours d'avant à envoyer à Claude. Rappel sur la page
du jour la semaine d'avant, notification la veille à 19:00 et le matin à 7:30 dans l'app Android.

**Faire le point avec Claude** : chaque journée (ou semaine) devient un texte structuré, prêt à coller dans un
projet Claude. Selon l'endroit où l'app tourne :

| Où | Envoyer à Claude | Données |
|---|---|---|
| Artefact Claude (iPhone, tablette, PC via claude.ai) | « Demander à Claude » répond dans la page (photo de prise de sang possible), la réponse est gardée avec la journée | synchronisées avec le compte Claude |
| App Android (APK) | « Envoyer à Claude » ouvre le menu de partage : choisir l'app Claude | sur la tablette |
| App Windows | « Copier pour Claude », puis « Ouvrir mon projet Claude » | sur le PC |

Réglages → *Tes données* : sauvegarde complète (fichier ou texte), une journée (texte pour Claude en `.md`, ou
sauvegarde de ce jour seul en `.json`), restauration depuis un fichier ou un texte collé (avec confirmation), tableau
`.csv`. Sur Android, les fichiers passent par le menu de partage (Fichiers, Drive, Claude…).

## Installer

La release [`mon-suivi`](https://github.com/yassineelhdt-png/yas/releases/tag/mon-suivi) est refaite à chaque
modification de `diet/` (workflow « Mon suivi ») :

- **Tablette Android** : [`Mon-suivi.apk`](https://github.com/yassineelhdt-png/yas/releases/download/mon-suivi/Mon-suivi.apk),
  à ouvrir sur la tablette (autoriser les « sources inconnues »). Les mises à jour s'installent par-dessus.
- **PC Windows** : `Mon-suivi-Installation.exe` ou `Mon-suivi-Portable.exe`. Si Windows affiche « Windows a protégé
  votre ordinateur » : *Informations complémentaires* → *Exécuter quand même*.

## Fichiers

- `mon-suivi.html` : l'app entière, source de l'artefact Claude « Mon suivi » (capacités `db`, `user`,
  `downloads`, `sample`). Pas de `<!doctype>` ni de `<head>` : l'artefact les ajoute à la publication.
- `app/` : les apps Android (Capacitor, `com.yas.monsuivi` ; plugins partage, fichiers, notifications) et Windows (Electron).
  `npm run www` fabrique `app/www/index.html` à partir de `mon-suivi.html` (polices embarquées, hors ligne) ;
  `npm run android:apk`, `npm run desktop`, `npm run icons` (depuis `assets/icon.svg`).
  L'APK est signé avec `app/android/app/monsuivi.keystore` (clé publique dans le dépôt : usage perso, pas le
  Play Store ; variables `ANDROID_KEYSTORE_*` pour une clé privée).

## Données

- **Compte Claude** : `data/users/<id>/settings` (liste, objectifs, mes aliments, profil) et un document par mois,
  `data/users/<id>/mAAAA-MM` (`{ days: { "AAAA-MM-JJ": { taken, wake, bed, checkins, symptoms, meals, notes, visit, claude } } }`).
  Seuls les champs modifiés sont envoyés, pour ne pas écraser ce qu'un autre appareil écrit en même temps.
- **Copie sur l'appareil** (`localStorage`, clé `mon-suivi-cloud-v1`) : affichage immédiat au chargement et
  modifications pas encore confirmées par le compte, renvoyées au prochain chargement ou au retour du réseau.
- **Sans compte** (apps Android et Windows, navigateur) : tout reste sur l'appareil, clé `mon-suivi-v1`.

Les valeurs nutritionnelles intégrées sont des moyennes pour 100 g (tables CIQUAL / USDA, glucides hors fibres) :
à ajuster avec l'étiquette, ou à enregistrer dans « Mes aliments ».
