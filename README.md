# Horaire 9h nettes

Planning quotidien « 9h d'étude nettes » pour le B1 BIME (ULB, campus Erasme), calé sur l'heure de lever.
Une seule base de code pour toutes les plateformes :

| Appareil | Format | Où le trouver |
|---|---|---|
| iPhone | Artefact Claude (synchronisé avec ton compte) ou app web installable | ton lien d'artefact Claude, ou https://yassineelhdt-png.github.io/yas/ |
| Tablette Android (Honor MagicPad 4) | APK | [Releases → `Horaire-9h.apk`](https://github.com/yassineelhdt-png/yas/releases/latest/download/Horaire-9h.apk) |
| PC Windows | Installeur ou version portable | [Releases](https://github.com/yassineelhdt-png/yas/releases/latest) |

## Installer

**iPhone** — deux possibilités, à ouvrir dans **Safari** puis Partager → « Sur l'écran d'accueil » :
- ton **artefact Claude** « Horaire 9h nettes » (la même app, publiée avec `npm run build:artifact`) :
  aucun réglage GitHub, et tes données se synchronisent avec ton compte Claude ;
- le **site** GitHub Pages (après l'activation ci-dessous) : plein écran et utilisable sans réseau.

**Tablette Android** — sur la tablette, télécharge `Horaire-9h.apk` depuis la page *Releases*, ouvre-le et
autorise l'installation depuis le navigateur (« sources inconnues »). Les versions suivantes s'installent
par-dessus, sans perdre les données.

**PC Windows** — `Horaire-9h-Installation.exe` (raccourci dans le menu Démarrer) ou `Horaire-9h-Portable.exe`
(sans installation). L'app n'est pas signée : si Windows affiche « Windows a protégé votre ordinateur »,
clique sur *Informations complémentaires* → *Exécuter quand même*.
Autre option : ouvrir le site dans Chrome ou Edge et cliquer sur « Installer » dans la barre d'adresse.

### À faire une seule fois : activer le site (pour l'iPhone)

GitHub → dépôt `yas` → **Settings → Pages → Build and deployment → Source : « GitHub Actions »**,
puis onglet **Actions** → workflow « Site web » → *Re-run*. Le site est ensuite mis à jour à chaque modification.

## Données et appareils

Chaque appareil garde ses données (heures de lever, cases cochées, présences, réglages) dans l'app.
Pour les copier d'un appareil à l'autre : **Réglages → Sauvegarde & autres appareils** → *Copier la sauvegarde*,
puis coller le texte dans l'app de l'autre appareil → *Restaurer cette sauvegarde*.

Ouverte comme artefact Claude, l'app se synchronise automatiquement avec le compte Claude (comme la v1).

## Nouveautés de la v2

- **Heure de fin** (21:00 par défaut, Réglages → Journée) et champ « Je finis à » pour chaque jour :
  s'il y a de la marge, pauses et repas s'allongent pour finir pile à l'heure (au-delà : « Temps libre »
  après le dîner) ; s'il en manque, les repas puis les pauses raccourcissent, et en dernier recours
  l'objectif net baisse (avec une alerte). Le dîner a lieu pendant le programme quand il finit après 20h.
- **Lieux** : Maison, Erasme (8:00–20:45, 25 min), Play4Peace (9:00–23:00, 25 min), UZ (8:00–22:00, 50 min),
  horaires et trajets réglables. Lun–ven hors congés : Erasme par défaut ; le week-end : la maison ;
  choix du jour dans la carte « Où tu travailles ». Arrivée au plus tôt à l'ouverture.
- **Fin de journée à la maison** : une fois les séances finies, quand il reste environ 1h30 d'étude
  (Réglages → Lieux), retour à la maison : le trajet sert de pause, la fin (et le dîner) se fait à la maison.
  Au plus tard à la fermeture : départ, trajet, 20 min pour se poser, et la suite à la maison.
- **Horaires ronds et sessions d'au moins 50 min** : pauses et repas s'allongent par pas de 5 min ; plus de
  petit bout de session (deux sessions équilibrées à la place).
- **Objectifs de la semaine** (Réglages) : annales, théorie à rattraper, exercices… pour chaque semaine
  ou pour une semaine précise. En gros blocs de 2h d'un seul tenant (une annale de 4h = 2 × 2h), au plus
  deux par jour, jamais pendant les séances, avec une carte de progression (planifié / coché / ce qui manque)
  dans les vues Jour et Semaine.

- **Relecture au peigne fin** (skill `analyse` et agents dans `.claude/`) : cases cochées qui restent sur le bon
  créneau quand le plan se décale, synchro de l'artefact qui ne perd plus rien à la connexion, heures saisies
  au clavier enregistrées une fois finies, replanification pendant un trajet, contrastes et cibles tactiles,
  vue Semaine lisible sur téléphone.
- **« C'est fait »** directement dans la carte « En ce moment » (la séance en cours, ou celle que tu viens de
  finir pendant la pause) ; bilan **« Ta semaine »** (coché / prévu, jour par jour) dans la vue Semaine.
- La **préparation de la séance du lendemain** passe avant les cours reportés ; si elle ne tient pas, une alerte le dit.
- Carte **« En ce moment »** : le créneau en cours, le temps restant et ce qui suit.
- Barre de navigation en bas sur téléphone, onglets en haut sur tablette / PC ; le bouton retour ramène à la vue Jour.
- **Glisser** gauche / droite pour changer de jour ; raccourcis clavier sur PC (← →, T, 1‑4).
- Transitions fluides, rendu partiel (plus de page redessinée en entier), cases cochées animées.
- Thème clair / sombre / automatique, polices intégrées (plus besoin d'Internet).
- Semaine : ligne « maintenant », colonne des heures fixe quand on fait défiler.
- Sauvegarde / restauration des données.
- Réglages protégés : un champ vidé revient à la valeur par défaut au lieu de casser le planning.

Sans les ajouts de la v2 (heure de fin, lieux, sessions minimales, objectifs, horaires ronds), le moteur est **identique à la v1** : un test compare, jour par jour
et sur tout le quadrimestre, les plannings produits par la v2 et par l'app d'origine (`legacy/horaire-9h-v1.html`).

## Développement

```bash
npm install
npm run dev          # app web en local (http://localhost:5173)
npm test             # tests du moteur (dont la parité avec la v1)
npm run build        # build web → dist/
npm run desktop      # lancer l'app PC (Electron)
npm run android:apk  # APK (nécessite le SDK Android + Java 21)
npm run icons        # régénérer les icônes depuis assets/*.svg
npm run build:artifact  # version artefact Claude → dist-artifact/horaire-9h.html
```

À chaque push, GitHub Actions teste le code, fabrique l'APK et l'app Windows, les publie dans la
release « latest » (branche principale uniquement) et met le site à jour.

### Organisation

```
src/
  data/          horaire du quadrimestre (séances, locaux, congés, guidances)
  engine/        moteur de planification, sans interface (testé)
    time.js        heures, dates
    events.js      séances du jour, trajets
    simulate.js    déroulé de la journée (sessions, pauses, repas, sport)
    fit.js         calage sur l'heure de fin (pauses étirées / raccourcies, objectif réduit)
    places.js      lieux (horaires, trajets)
    goals.js       objectifs de la semaine
    tasks.js       quoi travailler dans chaque session
    plan.js        plan du jour / de la semaine (modes semaine, samedi, concours, congé)
  ui/            vues Jour, Semaine, Réglages, Méthode (lit-html)
  store.js       état, sauvegarde locale, synchro Claude, export / import
  styles/        CSS (couleurs, thèmes clair / sombre)
electron/        app PC
android/         projet Android (Capacitor)
tests/           tests du moteur
.claude/         skill « analyse » (relecture au peigne fin) et agents « annale » pour Claude Code
legacy/          app d'origine (v1), référence pour les tests de parité
```

### Passer au Q2

Copier `src/data/horaire-q1-2026.js`, remplacer les séances / congés / guidances, puis l'importer dans
`src/data/index.js`. Le test de parité compare avec la v1 et ne vaut que pour le Q1 : l'adapter ou le retirer
à ce moment-là.

### Signature Android

L'APK est signé avec `android/app/horaire9h.keystore` pour que chaque nouvelle version s'installe par-dessus
la précédente. Cette clé est publique dans le dépôt : elle convient à une installation personnelle, pas à une
publication sur le Play Store. Pour une clé privée, définir `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD` au moment du build.
