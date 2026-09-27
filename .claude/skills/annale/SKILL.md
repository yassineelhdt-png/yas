---
name: annale
description: Pipeline multi-agents pour générer une annale d'examen avec corrigé vérifié (génération → résolution à l'aveugle → vérification → correction). À utiliser quand l'utilisateur demande de générer un examen, une annale, un exam blanc, des exercices type examen ou un corrigé fiable, dans n'importe quelle matière (maths, physique, chimie, biologie, logique…).
---

# /annale : orchestration

Tu es l'orchestrateur. Tu ne rédiges ni l'énoncé ni le corrigé toi-même : tu délègues aux sous-agents et tu fais respecter l'ordre et l'isolement.

## Étape 0 : paramètres
Récupère depuis la demande : matière, chapitres, niveau, durée, nombre de questions.
S'il manque des infos essentielles (matière ou chapitres), pose UNE seule question courte. Sinon, valeurs par défaut : niveau bachelier 1re année, 2 h, 5 questions, 20 points.
Regarde si `cours/` et `annales-sources/` contiennent des fichiers pertinents et signale-le au générateur.

Crée le slug : `<matiere>-<chapitre>-<AAAAMMJJ>` (minuscules, tirets). Dossier de sortie : `sortie/<slug>/`.

## Étape 1 : génération
Lance le sous-agent `generateur-annale` avec les paramètres, le dossier de sortie et les supports éventuels.
Il produit `enonce.md` et `corrige.md`.

## Étape 2 : résolution à l'aveugle
1. Lis toi-même `enonce.md`.
2. Lance `solveur-aveugle` en collant le TEXTE COMPLET de l'énoncé dans son prompt, avec le chemin de sortie `sortie/<slug>/resolution.md`.
3. Ne lui donne JAMAIS le corrigé, son contenu ni son chemin. Ne mentionne même pas qu'un corrigé existe.

## Étape 3 : vérification
Lance `verificateur-annale` avec les chemins des trois fichiers. Il produit `rapport.md`.

## Étape 4 : boucle de correction (max 2 tours)
Si le verdict est `À CORRIGER` :
1. Relance `generateur-annale` en mode correction, avec le chemin de `rapport.md` : il ne modifie que les questions signalées.
2. Relance `solveur-aveugle` UNIQUEMENT sur les questions modifiées (même règle d'isolement), en écrivant dans `resolution-v2.md`.
3. Relance `verificateur-annale` sur ces questions.

Après 2 tours sans `VALIDÉ`, arrête-toi et liste à l'utilisateur les problèmes restants.

## Étape 4 bis : passe au peigne fin
Une fois le verdict `VALIDÉ`, lance `analyste-exhaustif` sur `enonce.md` et `corrige.md`.
S'il trouve des ❌, relance `generateur-annale` en mode correction avec `analyse.md`, puis relance `analyste-exhaustif` sur les questions modifiées (1 tour max).

## Étape 5 : restitution
Donne à l'utilisateur, en bref :
- Les chemins de `enonce.md` et `corrige.md`.
- Nombre de questions, total des points.
- Ce qui a été corrigé pendant la boucle (ex. « Q3 : erreur de signe dans le corrigé, corrigée »).
- Les doutes restants éventuels.

Si `pandoc` est disponible, propose un export PDF (énoncé et corrigé séparés).

## Mode vérification (jeu existant)
Si l'utilisateur veut vérifier un examen / QCM / jeu d'exercices qu'il a déjà :
1. Crée `sortie/<slug>/` et mets-y les questions dans `enonce.md` et le corrigé fourni dans `corrige.md` (fidèlement, sans rien corriger). Pas de corrigé fourni → `corrige.md` contient seulement « AUCUN CORRIGÉ FOURNI ».
2. Saute l'étape 1 (pas de génération). Fais les étapes 2 et 3 normalement.
3. Signale au vérificateur si des supports de cours existent dans `cours/` : ils servent de référence.
4. Si l'utilisateur veut une vérification maximale (« au peigne fin », « tout vérifier »), lance aussi `analyste-exhaustif` sur `enonce.md` et `corrige.md` (en parallèle du solveur, il n'a pas besoin d'être à l'aveugle).
5. Restitue le rapport à l'utilisateur. Ne lance pas la boucle de correction sauf s'il la demande.

## Plusieurs annales d'un coup
Si l'utilisateur en demande plusieurs (ex. « 3 exams blancs »), lance les générateurs EN PARALLÈLE, puis les solveurs en parallèle, puis les vérificateurs en parallèle. Un slug et un dossier par annale.
