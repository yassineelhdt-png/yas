# Mon suivi

Journal santé quotidien : compléments (matin, midi, 16h, soir), eau (verres, objectif en litres), sommeil,
check-ins (humeur, énergie, concentration, stress, douleur, faim), ce que je ressens (douleurs, sensations, effets
secondaires), repas avec aliments et macros (protéines, glucides, lipides, calories) et notes.

Navigation en bas (sur le côté sur grand écran) : **Accueil** (la journée, avec six anneaux de résumé),
**Calendrier** (semaine, mois, année), **Sport**, **Santé** (profil, IMC, courbe du poids, prochaine visite, 7 derniers jours,
prises de sang visite par visite) et **Réglages** (profil santé, objectifs du jour, visite médicale, sport,
compléments, mes aliments, Claude, sauvegarde et données).

**Profils** (Réglages → *Profils*, ou la pastille en haut à droite) : un journal par personne (moi, ma mère…).
Chaque profil a ses compléments, repas, sport, visites et réglages ; on passe de l'un à l'autre en un appui.
Un nouveau profil démarre vide. Avec un compte Claude, la liste des profils suit le compte d'un appareil à l'autre.

**Chrono** (onglet Sport) : chronomètre avec tours (sprints…), ou intervalles effort / récup × tours (préréglages
Sprints, Corde, Tabata) avec bips à 3, 2, 1 et vibration aux changements. Il se note dans la journée, ou dans la
séance en direct si elle est en cours (une série par tour).

**Séance en direct** (onglet Sport) : « Commencer maintenant » (ou la séance prévue) lance le chrono ; pour chaque
exercice, les séries se notent en répétitions (charge, répétitions en réserve) ou en durée (avec un chrono), et le
repos démarre tout seul après chaque série (1, 1 min 30, 2 ou 3 min, + 15 s, passer), avec vibration et son. L'écran
reste allumé, un bandeau rappelle la séance sur les autres onglets, et la séance en cours survit à une fermeture de
l'app. « Terminer » l'enregistre dans la journée avec le détail des séries, que Claude reçoit.

**Sport** : objectif de 5 séances légères de 30 à 45 min par semaine (réglable), avec la semaine en 7 pastilles, la
séance prévue du jour (« C'est fait » la note en un appui), les pas du jour (objectif 8 000), les séances et les
activités du quotidien qui comptent aussi (marche, ménage, déménagement…) avec durée, intensité, détails et dépense
estimée (MET × poids × durée), et un graphique des séances sur 8 semaines. Réglages → *Sport* : objectifs, séances
types (cardio doux, renfo maison, marche rapide, corde à sauter, mobilité) et programme lundi → dimanche.

**Cures** : un complément peut se prendre en cure, avec des semaines de prise puis des semaines de pause, en boucle
(Réglages → *Compléments* → « Prendre en cure »). Pendant la pause, il sort de la liste du jour et une ligne
indique la date de reprise ; la veille d'un début, d'une pause ou d'une reprise, un rappel s'affiche sur l'accueil
(et une notification à 19:00 dans l'app Android). L'omberacetam est réglé sur 6 semaines de prise puis 4 de pause
à partir du 10 octobre 2026 (notice du Noopept : cure de 1,5 à 3 mois, puis 1 mois de pause avant la suivante).

**Visite médicale toutes les 4 semaines** (première le lundi 28 septembre 2026, réglable) : pesée, prise de sang
(valeurs avec repères habituels), avis du médecin, et bilan des 28 jours d'avant à envoyer à Claude. Rappel sur la page
du jour la semaine d'avant, notification la veille à 19:00 et le matin à 7:30 dans l'app Android.

**Faire le point avec Claude** : chaque journée (ou semaine) devient un texte structuré, prêt à coller dans un
projet Claude. L'app marche sans réseau ; le soir (à partir de 18 h), l'accueil rappelle les journées pas encore
envoyées et les envoie en un seul texte. Chaque journée envoyée porte la mention « Envoyée le … ». Selon l'endroit
où l'app tourne :

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

- **Séance en cours** et **chrono** : sur l'appareil seulement (`mon-suivi-live-v1`, `mon-suivi-chrono-v1`).
- **Profils** : liste dans `mon-suivi-profiles-v1` (et `data/users/<id>/profiles` avec un compte). Le profil principal
  garde les emplacements ci-dessous ; un autre profil ajoute `@<profil>` aux clés de l'appareil et utilise la
  collection `data/users/<id>/profiles/<profil>` sur le compte.
- **Compte Claude** : `data/users/<id>/settings` (liste, objectifs, profil santé, visite, sport, mes aliments) et un
  document par mois, `data/users/<id>/mAAAA-MM`
  (`{ days: { "AAAA-MM-JJ": { taken, water, steps, sport, wake, bed, checkins, symptoms, meals, notes, visit, claude, sent } } }`).
  Une séance faite en direct garde ses séries dans `sport[].exos` (`{ name, mode, sets: [{ reps, kg, rir } | { sec }] }`).
  Un complément en cure porte `cure: { start, on, off }` (premier jour, semaines de prise, semaines de pause).
  Seuls les champs modifiés sont envoyés, pour ne pas écraser ce qu'un autre appareil écrit en même temps.
- **Copie sur l'appareil** (`localStorage`, clé `mon-suivi-cloud-v1`) : affichage immédiat au chargement et
  modifications pas encore confirmées par le compte, renvoyées au prochain chargement ou au retour du réseau.
- **Sans compte** (apps Android et Windows, navigateur) : tout reste sur l'appareil, clé `mon-suivi-v1`.

Les valeurs nutritionnelles intégrées sont des moyennes pour 100 g (tables CIQUAL / USDA, glucides hors fibres) :
à ajuster avec l'étiquette, ou à enregistrer dans « Mes aliments ».
