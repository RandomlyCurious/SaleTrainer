#!/bin/sh
# Scan de secrets — SOURCE UNIQUE, appelée par .githooks/pre-commit (commit en
# cours) et par .github/workflows/ci.yml (branche entière). Ne jamais dupliquer
# la regex ailleurs : deux copies finissent par diverger.
#
# Usage :
#   sh scripts/scan-secrets.sh --cached            # ce qui est sur le point d'être commité
#   sh scripts/scan-secrets.sh origin/main..HEAD   # tout ce que la branche ajoute
#
# Ne scanne que les lignes AJOUTÉES : on ne fuite un secret qu'en l'ajoutant, et
# scanner le contexte et les suppressions produisait des faux positifs.
#
# package-lock.json est exclu : ses hashes base64 peuvent contenir "eyJ" par
# hasard, ce qui bloquerait un simple bump de dépendances sur un faux positif.
# Aucune perte : un secret ne s'écrit pas dans un lockfile généré.
#
# Les crochets (ROL[E], live[_], ey[J]…) ne sont PAS une coquille : sans eux, ce
# fichier contient les littéraux qu'il cherche et se détecte lui-même dès qu'on
# le modifie. La regex reste strictement équivalente. NE PAS les retirer.
#
# La première alternative exige une VALEUR derrière le nom de variable. Avant,
# elle matchait `SUPABASE_SERVICE_ROL`+`E` seul : lire cette variable dans du
# code ou la câbler dans un workflow suffisait à bloquer le commit, alors
# qu'aucun secret n'était en jeu. Un nom de variable n'est pas un secret ; ce
# qu'on cherche, c'est une clé collée en face.
# Passent donc : `…KEY` cité seul, `…KEY=` vide, `…KEY=$AUTRE`, `…KEY: ${{ … }}`.
# Restent bloqués : `…KEY=` suivi d'un littéral d'au moins 20 caractères — ce qui
# couvre le JWT historique comme la clé `sb_secret_…` du nouveau format.
#
# `sb_secret[_]` suivi d'au moins 16 caractères attrape en plus la clé Supabase
# du nouveau format collée NUE, sans nom de variable en face — le cas que la
# règle ci-dessus laisse passer. La longueur est exigée pour la même raison que
# ci-dessus : le préfixe seul, cité dans un commentaire ou de la doc, n'est pas
# un secret. Volontairement pas de `sb_[a-z]*_` non plus : `sb_publishable_…`
# est publique par construction, la bloquer serait un faux positif de plus.
PATTERN='(SUPABASE_SERVICE_ROL[E][A-Z_]*\s*[:=]\s*["'"'"']?[A-Za-z0-9_.-]{20,}|sb_secret[_][A-Za-z0-9_-]{16,}|sk_live[_]|sk_test[_]|ey[J][A-Za-z0-9_-]{20,}|gh[pous]_|api[_-]?key\s*=\s*["'"'"'][A-Za-z0-9]{20,})'

# La ligne fautive n'est volontairement PAS affichée : elle finirait en clair
# dans les logs GitHub Actions, qui sont conservés et lisibles.
if git diff "$@" -- . ':(exclude)package-lock.json' \
  | grep '^+' | grep -v '^+++' | grep -qiE "$PATTERN"; then
  echo "❌ secret potentiel détecté dans les lignes ajoutées."
  echo "   Cherche-le avec : git diff $* | grep '^+'"
  echo "   Rien de sensible en clair dans le dépôt : .env.local en local,"
  echo "   secrets GitHub Actions en CI."
  exit 1
fi
