// Vue « Méthode » : comment le plan est construit.
import { html } from "lit-html";
import * as E from "../engine/index.js";
import { S, state } from "../store.js";
import { MOISC } from "./format.js";

export function methodView() {
  const st = S();
  const cyc = [];
  for (let i = 0, d = st.ethiqueAnchor; i < 8; i++, d = E.addDays(d, 7 * st.ethiqueEvery)) {
    const x = E.pd(d);
    cyc.push(x.getDate() + " " + MOISC[x.getMonth()]);
  }
  return html`
    <article class="method">
      <h1>Comment le plan est construit</h1>
      <p>Tu entres l'heure à laquelle tu t'es levé. Après ${st.prep} min de préparation, l'app remplit la journée jusqu'à ${st.targetH}h d'étude nettes, en calant les séances fixes à leur heure.</p>

      <h2>Heure de fin</h2>
      <ul>
        <li>Le programme se termine à ${st.endAt || "l'heure où l'objectif est atteint"}${st.endAt ? " (Réglages → Journée), ou à l'heure que tu écris dans « Je finis à » pour un jour donné" : ""}.</li>
        <li>S'il y a de la marge, les pauses et les repas s'allongent par pas de 5 min (pause jusqu'à 30 min, grande pause jusqu'à 1h, repas jusqu'à 1h15) : les heures restent rondes. Au-delà, un créneau « Temps libre » s'ajoute, en général autour du dîner.</li>
        <li>S'il manque du temps (tu commences tard), l'objectif net baisse pour finir à l'heure, et l'app te dit combien d'heures tu fais.</li>
        <li>Quand le programme finit après 20h, le dîner a lieu pendant le programme.</li>
        <li>Le sport se fait à la maison, juste après la fin du programme.</li>
      </ul>

      <h2>Lieux</h2>
      <ul>
        <li>Erasme (${st.erasmeOpen}–${st.erasmeClose}, ${st.travel} min de trajet), Play4Peace (${st.p4pOpen}–${st.p4pClose}, ${st.p4pTravel} min), UZ (${st.uzOpen}–${st.uzClose}, ${st.uzTravel} min) ou la maison : à choisir chaque jour dans « Où tu travailles ».</li>
        <li>Tu arrives au plus tôt à l'ouverture ; si le lieu ouvre tard, tu commences à la maison puis tu pars.</li>
        <li>${+st.homeTail > 0
          ? "Tu ne restes pas forcément jusqu'à la fin : une fois les séances finies, quand il reste environ " + E.hdur(+st.homeTail) + " d'étude, tu rentres. Le trajet sert de pause, et tu finis à la maison (le dîner aussi, s'il tombe là)."
          : "Tu restes sur place jusqu'à la fin du programme (Réglages → Lieux → Fin de journée à la maison : 0)."}</li>
        <li>Au plus tard à la fermeture : départ, trajet, ${st.prep} min pour te poser, et tu continues à la maison.</li>
        <li>À Erasme, tu restes sur place entre les cours ; depuis un autre lieu, les séances ont leurs trajets.</li>
      </ul>

      <h2>Objectifs de la semaine</h2>
      <ul>
        <li>Annales, théorie à rattraper, exercices… (Réglages → Objectifs de la semaine), pour chaque semaine ou pour une semaine précise.</li>
        <li>Ils se font en gros blocs de 2h d'un seul tenant, sans pause au milieu : une annale de 4h = deux blocs de 2h (1re partie, 2e partie). Jamais pendant les séances, la guidance ou la permanence.</li>
        <li>Au plus deux blocs par jour. Le premier passe dès qu'il te reste au moins 2h d'étude perso à côté ; le second seulement si les préparations et les cours à rattraper du jour tiennent encore. Les matières alternent (chimie, physique, maths, chimie…).</li>
        <li>La carte « Objectifs de la semaine » montre ce qui est planifié et ce que tu as coché ; s'il manque du temps, elle le dit.</li>
      </ul>

      <h2>Ce qui compte dans les ${st.targetH}h</h2>
      <ul>
        <li>Étude perso, séminaires, exercices, TP, guidance, permanence, appuis : oui.</li>
        <li>Trajets, repas, pauses, sport : non.</li>
      </ul>

      <h2>Trois blocs</h2>
      <ul>
        <li>Bloc 1 jusqu'au déjeuner (entre 12h et 13h15), bloc 2 jusqu'à une grande pause de ${st.bigPause} min, bloc 3 le soir.</li>
        <li>Sessions de ${st.minSession} min minimum et ${st.session} min maximum (2h pour un bloc d'annale), ${st.pause} min de pause entre deux. Plutôt que de laisser un petit bout à la fin, deux sessions équilibrées (ex. 2 × 1h au lieu de 1h30 + 30 min).</li>
        <li>Le sport (${st.sport} min + douche) est toujours la dernière chose de la journée, après le programme.</li>
        <li>Tu peux choisir l'heure à laquelle tu commences : tout le programme se décale.</li>
      </ul>

      <h2>Une matière = un bloc</h2>
      <ul>
        <li>En semaine, chaque matière est travaillée d'un seul tenant : cours du jour, préparation de séminaire et exercices de la même matière se suivent. Une fois que tu es passé à autre chose, la matière ne revient plus dans la journée.</li>
      </ul>

      <h2>Semaine de cours</h2>
      <ul>
        <li>Du lundi au vendredi (hors congés), tu travailles à : ${(E.PLACES[st.weekdayPlace] || E.PLACES.maison).name}${+st.homeTail > 0 && st.weekdayPlace !== "maison" ? ", et tu finis la journée à la maison" : ""}. Le week-end, à la maison. Tu peux changer pour un jour donné dans « Où tu travailles ».</li>
        <li>Tu ne vas pas aux cours magistraux : le jour même, un créneau « Cours de … du jour » (slides ou podcast ×1,5 → fiche → Anki) est placé après l'heure du cours.</li>
        <li>Ce qui ne tient pas passe en tête du lendemain, puis au samedi.</li>
        <li>La veille d'un séminaire : préparation de la série.</li>
        <li>Guidance chimie 1×/semaine : jeudi par défaut, avant le séminaire de maths (un seul trajet). Permanence physique 1×/semaine : mercredi 10h–12h, avant les séminaires de chimie et physique.</li>
        <li>Appuis : maths le mardi 12h–14h, bio le vendredi 12h–14h. Les créneaux partagés avec VETE sont désactivés par défaut.</li>
        <li>Le reste du temps tourne entre chimie, physique, maths et bio pour équilibrer la semaine.</li>
      </ul>

      <h2>Samedi</h2>
      <ul>
        <li>Matin : chimie Q2, ${E.hdur(st.chimOrga)} d'organique puis ${E.hdur(st.chimMin)} de minérale (redox, acide-base).</li>
        <li>Après-midi : prépa concours ${E.hdur(st.concoursSat)} (physique puis maths), puis révision de la semaine ${E.hdur(st.revSat)}, qui commence par ce qui a été reporté.</li>
      </ul>

      <h2>Dimanche concours</h2>
      <ul>
        <li>Concours blanc 3h en sciences dès que tu es prêt${st.concoursStart ? " (ou à " + st.concoursStart + ")" : ""}, pause ${st.concoursPause} min, raisonnement ${st.raisonnement} min.</li>
        <li>Éthique & empathie un dimanche sur ${st.ethiqueEvery} :</li>
      </ul>
      <div class="cyc">${cyc.map((c) => html`<span>${c}</span>`)}</div>
      <ul><li>Ensuite : correction complète (fiche d'erreurs), puis remédiation sur les notions ratées.</li></ul>

      <h2>À vérifier de ton côté</h2>
      <ul>
        <li>Guidance chimie à partir de novembre : créneaux supposés identiques à octobre (mar 10h30, mer 10h, jeu 11h).</li>
        <li>Séminaire de maths du 22/10 : local non indiqué dans TimeEdit.</li>
        <li>Cours MEDIG (IA, ERSB, durabilité) : vérifie si la présence est obligatoire, puis active-les dans « Séances à l'unif ».</li>
      </ul>

      <h2>Sur tes appareils</h2>
      <ul>
        <li>iPhone : ouvre l'app (artefact Claude ou site web) dans Safari → Partager → « Sur l'écran d'accueil ».</li>
        <li>Tablette Android : installe l'APK (téléchargé depuis la page GitHub « Releases »).</li>
        <li>PC : installe « Horaire 9h » pour Windows, ou, dans Chrome/Edge, clique sur l'icône « Installer » de la barre d'adresse.</li>
        <li>${state.sync === "cloud"
          ? "Ouverte depuis ton compte Claude, l'app synchronise tes réglages et tes cases cochées entre tes appareils."
          : "Chaque appareil garde ses propres données. Pour copier tes réglages et tes cases cochées d'un appareil à l'autre : Réglages → Sauvegarde."}</li>
        <li>Raccourcis clavier sur PC : ← → changer de jour, T aujourd'hui, 1 à 4 pour les onglets.</li>
      </ul>
    </article>`;
}
