#!/usr/bin/env bash
# AURUM — aktualizacja z GitHuba, wywoływana z crona (/etc/cron.d/aurum-update) albo ręcznie:
#   sudo bash /opt/aurum/deploy/update.sh          (AURUM_FORCE=1 — przebuduj nawet bez zmian)
# Przebudowuje tylko, gdy na GitHubie jest nowy commit. .env i .data zostają nietknięte.
set -euo pipefail
DIR="${AURUM_DIR:-/opt/aurum}"
BRANCH="${AURUM_BRANCH:-main}"
LOCK=/tmp/aurum-update.lock
ts() { date '+%Y-%m-%d %H:%M:%S'; }

exec 9>"$LOCK"
flock -n 9 || { echo "$(ts) inna aktualizacja w toku — pomijam"; exit 0; }

cd "$DIR"
git fetch -q --depth 1 origin "$BRANCH" || { echo "$(ts) GitHub niedostępny — spróbuję później"; exit 0; }
NEW="$(git rev-parse FETCH_HEAD)"
OLD="$(git rev-parse HEAD)"
if [ "$NEW" = "$OLD" ] && [ "${AURUM_FORCE:-0}" != "1" ]; then exit 0; fi

echo "$(ts) aktualizacja ${OLD:0:7} → ${NEW:0:7}"
git reset -q --hard "$NEW"
if AURUM_NONINTERACTIVE=1 bash deploy/install.sh; then
  docker image prune -f >/dev/null 2>&1 || true
  echo "$(ts) OK: $(git log -1 --format='%h %s')"
else
  # Nowa wersja nie wstała — wracamy do poprzedniej, żeby aplikacja dalej działała.
  echo "$(ts) BŁĄD — przywracam ${OLD:0:7}"
  git reset -q --hard "$OLD"
  AURUM_NONINTERACTIVE=1 bash deploy/install.sh || echo "$(ts) przywrócenie też nieudane — sprawdź: docker compose logs aurum"
  exit 1
fi
