---
name: analyse
description: Analyse exhaustive « au peigne fin » d'un document pour trouver toutes les fautes. Chaque phrase, chaque nombre, chaque formule et chaque ligne de code est inventorié puis vérifié un par un, avec recalcul Python et exécution du code. Utilise ce skill dès que l'utilisateur veut vérifier, relire, corriger, contrôler, checker ou analyser en détail un texte, un examen, un corrigé, un QCM, un exercice, un rapport, un devoir ou du code, ou veut être sûr qu'il n'y a aucune erreur, même s'il ne dit pas le mot « analyse ». À utiliser aussi en passe finale du skill annale.
---

# Analyse au peigne fin

Une relecture globale rate des fautes parce que l'œil glisse sur ce qui « a l'air juste ». Ce skill force une vérification élément par élément à partir d'un inventaire numéroté : rien n'est sauté, et la couverture est prouvable (N éléments vérifiés sur N).

Si un cours, un syllabus ou un énoncé de référence est fourni, c'est LA référence : une affirmation conforme au cours est correcte même si une source plus avancée la nuancerait (signale la nuance sans la compter comme erreur).

## Étape 1 : inventaire

1. Mets le contenu à analyser dans un fichier texte (`.md`, ou le fichier de code tel quel). Pour une photo ou un PDF scanné, transcris fidèlement, sans rien corriger pendant la transcription : une faute corrigée en transcrivant est une faute non signalée.
2. Lance le script du dossier de ce skill :
   `python3 <dossier-du-skill>/scripts/decouper.py <fichier> --sortie inventaire.md`
   Il numérote chaque élément (E1…En) : titre, phrase, formule, ligne de tableau, ligne de code.
3. Document long (plus de ~150 éléments) : traite par blocs d'environ 50, annonce le bloc en cours. Ne saute jamais un bloc. Si tu dois t'arrêter, dis exactement à quel ID reprendre.

## Étape 2 : passe 1, élément par élément

Pour CHAQUE élément de l'inventaire, applique les contrôles de son type.

**Phrase / affirmation**
- Vraie ? (fait, définition, mécanisme, date, nom). Si ta confiance n'est pas haute → 🔍, ne tranche pas au bluff.
- Mots absolus (toujours, jamais, seul, tous, aucun) : sont-ils justifiés ? Ce sont des nids à erreurs.
- Négations : une négation manquante ou en trop inverse le sens. Relis-les deux fois.
- Orthographe, grammaire, accords, conjugaison, ponctuation.
- Terme technique exact et identique à celui utilisé ailleurs dans le document.

**Nombre / calcul**
- Recalcule avec Python, même les additions simples : les erreurs « évidentes » sont justement celles qu'on survole.
- Unités présentes et justes, conversions, puissances de 10.
- Chiffres significatifs et arrondis cohérents avec les données.
- Ordre de grandeur plausible.

**Formule / équation**
- Homogénéité dimensionnelle ; signes, indices, exposants, parenthèses.
- Chimie : équilibre de masse ET de charge, états physiques, → vs ⇌.
- Maths : domaine de définition, conditions d'application des théorèmes.

**Raisonnement (passage d'un élément au suivant)**
- La conclusion découle-t-elle vraiment ? Hypothèse cachée, cas oublié, confusion nécessaire/suffisante, réciproque abusive, corrélation prise pour causalité.

**Code**
- Exécute-le réellement quand c'est possible, avec des cas normaux ET limites : vide, 0, 1, négatif, très grand, doublons.
- Ligne par ligne : syntaxe, types, noms cohérents, bornes de boucles (off-by-one, `<` vs `<=`), indices, initialisations, conditions inversées, `return` manquant, division par zéro, effets de bord, entrées non validées.
- Conformité à la consigne : nom de fonction, format de sortie, contraintes imposées.
- Si le code ne peut pas être exécuté (langage indisponible, fragment), fais une trace à la main (tableau des variables) sur au moins un exemple.

**Tableau / figure / renvoi**
- Chaque ligne, chaque total, chaque légende. Les renvois (« voir Q3 », « figure 2 ») pointent vers quelque chose qui existe et qui correspond.

## Étape 3 : passe 2, cohérence globale

- Mêmes notations et mêmes termes du début à la fin.
- Numérotation continue ; barème total = somme des points.
- Une valeur réutilisée garde la même valeur partout.
- Énoncé ↔ corrigé : chaque question a sa réponse, et le corrigé utilise bien les données de l'énoncé.

## Étape 4 : passe 3, contre-vérification adverse

La passe 1 a un biais de confirmation ; celle-ci sert à le casser.
- Reprends les éléments ✅ les plus risqués (nombres, négations, unités, bornes de boucles, affirmations absolues) et essaie activement de prouver qu'ils sont faux.
- Reprends chaque ❌ trouvé et vérifie que ta correction n'est pas elle-même fausse. Un faux positif fait perdre confiance dans tout le rapport.

## Rapport

Utilise ce modèle :

### Résumé
- Éléments analysés : N / N
- ❌ Erreurs certaines : x · ⚠️ Problèmes (ambiguïté, imprécision, style) : y · 🔍 Doutes à vérifier : z

### Erreurs et problèmes
| ID | Extrait | Verdict | Correction | Justification |
|---|---|---|---|---|

Ne liste ici que les éléments non ✅. Chaque ❌ a une justification vérifiable : calcul Python, règle de grammaire, exécution du code, ou passage du cours cité.

### Version corrigée
Document court : donne la version corrigée complète. Document long : donne seulement les passages corrigés.

Si le document dépasse ~30 éléments, écris aussi le tableau complet élément par élément (✅ compris) dans un fichier `analyse-complete.md`, pour que l'utilisateur puisse contrôler la couverture.

## Honnêteté

N'écris jamais « aucune faute ». Écris « aucune erreur détectée sur N éléments analysés », suivi des 🔍 restants. Une vérification ne prouve pas l'absence totale d'erreurs : l'utilisateur doit savoir exactement ce qui reste incertain pour aller le vérifier lui-même.
