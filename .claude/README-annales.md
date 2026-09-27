# Pipeline /annale : 3 agents pour des annales fiables

```
generateur-annale  →  enonce.md + corrige.md
        │
        ▼ (énoncé seul, jamais le corrigé)
solveur-aveugle    →  resolution.md
        │
        ▼
verificateur-annale → rapport.md  →  VALIDÉ ou À CORRIGER (boucle max 2x)
        │
        ▼
analyste-exhaustif → analyse.md (chaque phrase, nombre, formule, ligne de code)
```

**Analyse seule :** `/analyse mon-fichier.md` (ou un fichier de code) pour vérifier n'importe quel document au peigne fin, sans passer par le pipeline.

## Installation

**Option A : pour ce projet seulement**
Décompresse le zip, ouvre un terminal dans le dossier `annales-agents`, puis lance `claude`.

**Option B : disponible partout**
Copie le contenu de `.claude/agents/` dans `~/.claude/agents/` et le dossier `.claude/skills/annale/` dans `~/.claude/skills/`.

⚠️ Le dossier `.claude` est caché (le nom commence par un point). Sur macOS : `Cmd + Shift + .` dans le Finder pour l'afficher. Sur Windows : Affichage → Éléments masqués.

**Dépendances pour les calculs :**
```
pip install sympy numpy
```

## Utilisation

Dans Claude Code :
```
/annale maths discrètes, logique propositionnelle et ensembles, 2h, 5 questions
```
Ou simplement en langage naturel : « génère-moi un exam blanc de chimie sur les équilibres acide-base ».

Pour que les annales ressemblent à celles de ton prof :
- Mets tes notes / slides / syllabus dans `cours/`
- Mets d'anciens examens dans `annales-sources/`

Résultats dans `sortie/<matiere>-<chapitre>-<date>/`.

## À savoir
- Le solveur n'a pas l'outil Read et reçoit l'énoncé dans son prompt, mais il a Bash (pour Python). L'isolement repose donc aussi sur ses instructions. Pour un isolement strict, retire `Bash` de ses `tools` (il perdra les calculs Python).
- Une annale = au moins 3 lancements d'agents (jusqu'à ~12 avec les boucles de correction et l'analyse), ça consomme ton quota plus vite qu'une conversation normale.
- `model: inherit` = les agents utilisent le même modèle que ta session. Tu peux mettre `model: opus` sur le vérificateur pour plus de rigueur.
