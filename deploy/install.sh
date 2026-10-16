#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AURUM — instalacja / aktualizacja na VPS jednym poleceniem.
#
#   cd /opt/aurum && sudo bash deploy/install.sh
#
# Co robi (bezpiecznie do wielokrotnego uruchamiania):
#   1. instaluje Dockera i plugin compose, jeśli ich brak (Debian/Ubuntu),
#   2. tworzy .env z .env.example i pyta o klucze (pusty = pomiń), istniejącego .env nie nadpisuje,
#   3. buduje obraz i uruchamia kontener (opcjonalnie z Redis),
#   4. czeka, aż /api/status odpowie, i wypisuje stan źródeł,
#   5. jeśli jest Tailscale — wystawia aplikację w tailnecie przez HTTPS na osobnym porcie
#      (domyślnie 8443, żeby nie kolidować z innymi usługami, np. GOLD DESK na 443).
#
# Zmienne: AURUM_TS_PORT=8443  AURUM_REDIS=1 (włącz Redis)  AURUM_NONINTERACTIVE=1 (bez pytań)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
TS_PORT="${AURUM_TS_PORT:-8443}"
say() { printf '\033[1;33m[AURUM]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[AURUM] %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$ROOT/docker-compose.yml" ] || die "Uruchom z katalogu projektu (brak docker-compose.yml w $ROOT)."

# ── 1. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  say "Instaluję Dockera…"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y docker.io
    apt-get install -y docker-compose-plugin 2>/dev/null || apt-get install -y docker-compose-v2 2>/dev/null || true
  else
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable --now docker 2>/dev/null || true
fi
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose";
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE="docker-compose";
else die "Brak docker compose — zainstaluj plugin: apt-get install docker-compose-plugin"; fi
say "Docker: $(docker --version | cut -d, -f1) · compose: $($COMPOSE version --short 2>/dev/null || echo ok)"

# ── 2. .env ──────────────────────────────────────────────────────────────────
setkey() { # setkey KLUCZ wartość — wpisuje lub podmienia linię KLUCZ=... w .env
  local k="$1" v="$2"
  if grep -qE "^#?\s*${k}=" .env; then sed -i -E "s|^#?\s*${k}=.*|${k}=${v}|" .env; else printf '%s=%s\n' "$k" "$v" >> .env; fi
}
if [ ! -f .env ]; then
  cp .env.example .env
  say "Utworzono .env z .env.example."
  if [ "${AURUM_NONINTERACTIVE:-0}" != "1" ] && [ -t 0 ]; then
    ask() { local prompt="$1" key="$2" val; read -r -p "  $prompt: " val || true; [ -n "$val" ] && setkey "$key" "$val"; return 0; }
    say "Podaj klucze (Enter = pomiń, można uzupełnić później w .env):"
    ask "FRED_API_KEY (zalecany — tło makro, oczekiwania Fed, recesja)" FRED_API_KEY
    ask "TWELVEDATA_API_KEY (sezonowość, reakcje złota)" TWELVEDATA_API_KEY
    ask "TELEGRAM_BOT_TOKEN (skrót dnia i alerty)" TELEGRAM_BOT_TOKEN
    ask "TELEGRAM_CHAT_ID" TELEGRAM_CHAT_ID
    ask "AISSTREAM_API_KEY (statki w chokepointach)" AISSTREAM_API_KEY
  fi
  if ! grep -qE '^ALERTS_SECRET=.+' .env; then setkey ALERTS_SECRET "$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"; fi
else
  say ".env już istnieje — zostawiam bez zmian."
fi
if [ "${AURUM_REDIS:-0}" = "1" ]; then setkey REDIS_URL "redis://redis:6379"; fi
grep -qE '^FRED_API_KEY=.+' .env || say "UWAGA: brak FRED_API_KEY — panele makro będą pokazywać „brak danych”."

# ── 3. build + start ─────────────────────────────────────────────────────────
PROFILE=""
grep -qE '^REDIS_URL=redis://redis' .env && PROFILE="--profile redis"
say "Buduję i uruchamiam (pierwszy build trwa kilka minut)…"
$COMPOSE $PROFILE up -d --build

# ── 4. zdrowie ───────────────────────────────────────────────────────────────
say "Czekam na start aplikacji…"
ok=0
for _ in $(seq 1 60); do
  if curl -fsS -m 5 http://127.0.0.1:3000/api/status -o /tmp/aurum-status.json 2>/dev/null; then ok=1; break; fi
  sleep 3
done
[ "$ok" = "1" ] || { $COMPOSE logs --tail 80 aurum; die "Aplikacja nie odpowiada na :3000 — logi powyżej."; }
say "Aplikacja działa: http://127.0.0.1:3000"
if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY' || true
import json
d = json.load(open('/tmp/aurum-status.json'))
c = d.get('config', {})
print('  klucze: ' + ' · '.join(f"{k}={'tak' if v else 'nie'}" for k, v in c.items()))
print('  źródła rozgrzewają się w tle (1–2 min); pełny stan: panel STATUS ŹRÓDEŁ lub /api/status')
PY
fi

# ── 5. Tailscale ─────────────────────────────────────────────────────────────
if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
  if tailscale serve --bg --https="$TS_PORT" http://127.0.0.1:3000 >/dev/null 2>&1; then
    HOST="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))' 2>/dev/null || hostname)"
    say "Tailscale: https://${HOST}:${TS_PORT}  (dostęp tylko z Twojego tailnetu)"
  else
    say "Tailscale jest, ale 'tailscale serve' się nie powiódł — uruchom ręcznie: tailscale serve --bg --https=${TS_PORT} http://127.0.0.1:3000"
  fi
else
  say "Brak Tailscale — aplikacja słucha tylko lokalnie (127.0.0.1:3000). Wystaw ją przez Tailscale lub nginx z hasłem (deploy/nginx.conf.example)."
fi

say "Gotowe. Aktualizacja z GitHuba: sudo bash deploy/update.sh (.env zostaje; przy instalacji przez bootstrap.sh dzieje się to samo co 30 min)."
say "Test Telegrama: curl -X POST -H \"x-alerts-secret: \$(grep ^ALERTS_SECRET .env | cut -d= -f2)\" 'http://127.0.0.1:3000/api/alerts?test=1'"
