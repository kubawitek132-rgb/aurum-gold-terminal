#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AURUM — instalacja na VPS prosto z GitHuba (jedno polecenie, bez kopiowania plików):
#
#   curl -fsSL https://raw.githubusercontent.com/kubawitek132-rgb/aurum-gold-terminal/main/deploy/bootstrap.sh | sudo bash
#
# 1. instaluje git (jeśli brak),
# 2. pobiera / aktualizuje kod w /opt/aurum (istniejący .env i dane zostają),
# 3. uruchamia deploy/install.sh (Docker, .env, start, Tailscale),
# 4. włącza automatyczne aktualizacje: co 30 min sprawdza GitHub i po nowym commicie
#    przebudowuje aplikację (wyłączenie: AURUM_AUTOUPDATE=0).
#
# Zmienne: AURUM_DIR=/opt/aurum  AURUM_REPO=…  AURUM_BRANCH=main  AURUM_AUTOUPDATE=1
#          oraz wszystkie zmienne deploy/install.sh (AURUM_TS_PORT, AURUM_REDIS, AURUM_NONINTERACTIVE).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="${AURUM_REPO:-https://github.com/kubawitek132-rgb/aurum-gold-terminal.git}"
BRANCH="${AURUM_BRANCH:-main}"
DIR="${AURUM_DIR:-/opt/aurum}"
say() { printf '\033[1;33m[AURUM]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[AURUM] %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "Uruchom jako root: … | sudo bash"

if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  say "Instaluję git i curl…"
  if command -v apt-get >/dev/null 2>&1; then apt-get update -y && apt-get install -y git curl ca-certificates
  elif command -v dnf >/dev/null 2>&1; then dnf install -y git curl
  else die "Zainstaluj git i curl ręcznie."; fi
fi

mkdir -p "$DIR"
cd "$DIR"
if [ ! -d .git ]; then
  # Katalog pusty albo wcześniejsza instalacja z paczki zip — podpinamy repozytorium,
  # pliki śledzone przez git zostaną nadpisane, .env i .data (ignorowane) zostają.
  say "Pobieram kod z $REPO…"
  git init -q
  git remote add origin "$REPO"
fi
git remote set-url origin "$REPO"
git fetch -q --depth 1 origin "$BRANCH"
git reset -q --hard FETCH_HEAD
git config --local core.fileMode false
say "Kod: $(git log -1 --format='%h %s' 2>/dev/null || echo "$BRANCH")"

# install.sh pyta o klucze tylko z terminala — przy „curl | bash” stdin to potok, więc podpinamy /dev/tty.
if [ -z "${AURUM_NONINTERACTIVE:-}" ] && [ -r /dev/tty ] && [ -w /dev/tty ]; then
  bash deploy/install.sh </dev/tty
else
  AURUM_NONINTERACTIVE=1 bash deploy/install.sh
fi

if [ "${AURUM_AUTOUPDATE:-1}" = "1" ]; then
  cat >/etc/cron.d/aurum-update <<EOF
# AURUM — automatyczna aktualizacja z GitHuba (deploy/update.sh). Wyłączenie: usuń ten plik.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/30 * * * * root AURUM_DIR=$DIR AURUM_BRANCH=$BRANCH bash $DIR/deploy/update.sh >>/var/log/aurum-update.log 2>&1
EOF
  chmod 644 /etc/cron.d/aurum-update
  say "Automatyczne aktualizacje: włączone (co 30 min, log: /var/log/aurum-update.log)."
fi
