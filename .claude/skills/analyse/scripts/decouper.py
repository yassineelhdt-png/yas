#!/usr/bin/env python3
"""
Découpe un document en éléments atomiques numérotés (E1, E2, ...) pour une
analyse exhaustive : phrases, lignes de code, formules, lignes de tableau, titres.

Usage :
    python3 decouper.py <fichier> [--json] [--sortie inventaire.md]

Formats : .md / .txt (prose + blocs de code + formules + tableaux) ;
fichiers de code (.py, .java, .c, .cpp, .js, .ts, .sql, .sh, ...) : une ligne = un élément.
"""
import json
import re
import sys
from pathlib import Path

CODE_EXT = {".py", ".java", ".c", ".h", ".cpp", ".hpp", ".cs", ".js", ".ts",
            ".sql", ".sh", ".bash", ".rb", ".go", ".rs", ".php", ".kt", ".swift",
            ".m", ".r", ".html", ".css", ".json", ".yaml", ".yml", ".xml"}

# Abréviations courantes (FR/EN) après lesquelles un point ne termine pas la phrase.
ABREV = ["p. ex.", "ex.", "etc.", "cf.", "M.", "Mme.", "Dr.", "fig.", "Fig.", "éq.",
         "n°.", "vol.", "chap.", "env.", "approx.", "resp.", "i.e.", "e.g.", "vs.", "min.", "max."]
SEP = "\u241E"  # caractère sentinelle


def proteger(texte):
    for a in ABREV:
        texte = texte.replace(a, a.replace(".", SEP))
    return texte


def restaurer(texte):
    return texte.replace(SEP, ".")


def couper_phrases(paragraphe):
    p = proteger(paragraphe)
    # Coupe après . ! ? … suivi d'un espace et d'une majuscule / chiffre / guillemet / puce.
    morceaux = re.split(r'(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ0-9«"“(\[\-•*])', p)
    return [restaurer(m).strip() for m in morceaux if m.strip()]


def decouper_markdown(lignes):
    elements = []
    i, n = 0, len(lignes)
    paragraphe, debut_para = [], None

    def vider_paragraphe():
        nonlocal paragraphe, debut_para
        if paragraphe:
            texte = " ".join(l.strip() for l in paragraphe)
            for ph in couper_phrases(texte):
                elements.append(("phrase", debut_para, ph))
        paragraphe, debut_para = [], None

    while i < n:
        ligne = lignes[i]
        s = ligne.strip()
        num = i + 1
        if s.startswith("```") or s.startswith("~~~"):
            vider_paragraphe()
            barriere = s[:3]
            i += 1
            while i < n and not lignes[i].strip().startswith(barriere):
                if lignes[i].strip():
                    elements.append(("code", i + 1, lignes[i].rstrip()))
                i += 1
            i += 1
            continue
        if s.startswith("$$"):
            vider_paragraphe()
            bloc, debut = [s], num
            if not (len(s) > 2 and s.endswith("$$") and s != "$$"):
                i += 1
                while i < n and "$$" not in lignes[i]:
                    bloc.append(lignes[i].strip())
                    i += 1
                if i < n:
                    bloc.append(lignes[i].strip())
            elements.append(("formule", debut, " ".join(bloc)))
            i += 1
            continue
        if s.startswith("|"):
            vider_paragraphe()
            if not re.fullmatch(r"\|?[\s:\-|]+\|?", s):  # ignore la ligne de séparation
                elements.append(("tableau", num, s))
            i += 1
            continue
        if s.startswith("#"):
            vider_paragraphe()
            elements.append(("titre", num, s))
            i += 1
            continue
        if not s:
            vider_paragraphe()
            i += 1
            continue
        if re.match(r"^([-*•]|\d+[.)]|[a-z][.)])\s", s):  # puce ou numérotation = nouvel item
            vider_paragraphe()
        if debut_para is None:
            debut_para = num
        paragraphe.append(ligne)
        i += 1
    vider_paragraphe()
    return elements


def decouper_code(lignes):
    return [("code", i + 1, l.rstrip()) for i, l in enumerate(lignes) if l.strip()]


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    chemin = Path(args[0])
    en_json = "--json" in args
    sortie = None
    if "--sortie" in args:
        sortie = Path(args[args.index("--sortie") + 1])

    lignes = chemin.read_text(encoding="utf-8", errors="replace").splitlines()
    elements = decouper_code(lignes) if chemin.suffix.lower() in CODE_EXT else decouper_markdown(lignes)

    items = [{"id": f"E{k}", "type": t, "ligne": l, "texte": x}
             for k, (t, l, x) in enumerate(elements, 1)]

    if en_json:
        texte = json.dumps(items, ensure_ascii=False, indent=2)
    else:
        compte = {}
        for it in items:
            compte[it["type"]] = compte.get(it["type"], 0) + 1
        resume = ", ".join(f"{v} {k}" for k, v in sorted(compte.items()))
        out = [f"# Inventaire : {chemin.name}",
               f"Total : {len(items)} éléments ({resume})", "",
               "| ID | Type | Ligne | Texte |", "|---|---|---|---|"]
        for it in items:
            t = it["texte"].replace("|", "\\|")
            out.append(f"| {it['id']} | {it['type']} | {it['ligne']} | {t} |")
        texte = "\n".join(out)

    if sortie:
        sortie.write_text(texte, encoding="utf-8")
        print(f"Inventaire écrit dans {sortie} : {len(items)} éléments.")
    else:
        print(texte)


if __name__ == "__main__":
    main()
