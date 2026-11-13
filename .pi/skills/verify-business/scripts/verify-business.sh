#!/usr/bin/env bash
# Launches an owned, hermetic business dashboard instance, drives it, keeps the evidence, tears the instance down.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$SCRIPT_DIR/../../../.." && pwd)
BUSINESS="$REPO/apps/business"
# apps/business has no Playwright of its own; the wallet's install is the repo's pinned one.
PLAYWRIGHT_HOME="$REPO/apps/wallet"
EVIDENCE_ROOT="$REPO/.pi/verify-evidence"
TITLE="Frak Business Hub | Manage Your Web3 Products"
SERVER_PID=""
EVIDENCE=""

usage() {
    cat <<'EOF'
Usage:
  verify-business.sh doctor
  verify-business.sh flow <flow.mjs> [--logged-out] [--locale en-US|fr-FR] [--width N] [--welcome] [--evidence DIR]

flow  starts apps/business with vite dev on a free port, opens /demo (demo mode:
      seeded demo session, data from apps/business/src/mock/*.json), runs the
      flow in headless Chromium (visible with VERIFY_HEADED=1; Desktop Chrome,
      1280 wide, en-US by default) with every off-origin request blocked, then
      stops the server.
      --logged-out  skip /demo; the flow starts on /login with no session.
      --welcome     keep the "new dashboard" announcement; it is dismissed by default.
Evidence goes to a NEW directory (default .pi/verify-evidence/<utc>-business-<label>);
an existing directory is refused. verdict.txt is written last.
EOF
}

die() { echo "verify-business: $*" >&2; exit 2; }

free_port() {
    node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}

port_owner() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }

cleanup() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        # The server is its own process group (set -m), so this reaches vite/esbuild children and nothing else.
        kill -TERM -- "-$SERVER_PID" 2>/dev/null || kill -TERM "$SERVER_PID" 2>/dev/null || true
        for _ in $(seq 50); do kill -0 "$SERVER_PID" 2>/dev/null || break; sleep 0.1; done
        kill -KILL -- "-$SERVER_PID" 2>/dev/null || true
    fi
    if [ -n "$EVIDENCE" ] && [ -d "$EVIDENCE" ]; then echo "evidence: $EVIDENCE" >&2; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

new_evidence() {
    local dir=${1:-"$EVIDENCE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)-business-$2"}
    [ -e "$dir" ] && die "evidence dir already exists, refusing to reuse it: $dir"
    if [[ "$dir" == "$EVIDENCE_ROOT"/* ]]; then
        mkdir -p "$EVIDENCE_ROOT"
        [ -f "$EVIDENCE_ROOT/.gitignore" ] || echo '*' >"$EVIDENCE_ROOT/.gitignore"
    fi
    mkdir -p "$dir"
    EVIDENCE=$(cd "$dir" && pwd)
}

doctor() {
    local ok=0
    say() { printf '%-5s %s\n' "$1" "$2"; [ "$1" = FAIL ] && ok=1; return 0; }
    [ -f "$BUSINESS/package.json" ] && say ok "business app at $BUSINESS" || say FAIL "no apps/business under $REPO"
    command -v bun >/dev/null && say ok "bun $(bun --version)" || say FAIL "bun not on PATH"
    [ -x "$BUSINESS/node_modules/.bin/vite" ] && say ok "vite installed in apps/business" || say FAIL "apps/business/node_modules missing (bun install)"
    local pw exe
    pw=$(cd "$PLAYWRIGHT_HOME" && node -p 'require("@playwright/test/package.json").version' 2>/dev/null || true)
    [ -n "$pw" ] && say ok "@playwright/test $pw (from apps/wallet)" || say FAIL "@playwright/test not installed in apps/wallet (bun install)"
    exe=$(cd "$PLAYWRIGHT_HOME" && node -p 'require("@playwright/test").chromium.executablePath()' 2>/dev/null || true)
    [ -n "$exe" ] && [ -e "$exe" ] && say ok "chromium for playwright $pw" \
        || say FAIL "chromium missing for playwright $pw: (cd apps/wallet && bunx playwright install chromium)"
    [ -f "$BUSINESS/src/routes/demo.tsx" ] && say ok "demo route present (src/routes/demo.tsx)" || say FAIL "apps/business/src/routes/demo.tsx missing: demo mode is gone, flows cannot log in"
    [ -f "$BUSINESS/src/mock/campaigns.json" ] && say ok "demo data present (src/mock/*.json)" || say FAIL "apps/business/src/mock/campaigns.json missing"
    return $ok
}

start_server() { # $1 = port
    local port=$1 ready owner pgid title
    URL="http://127.0.0.1:$port"
    ready="$URL/"
    set -m
    (cd "$BUSINESS" && exec bun x vite dev --host 127.0.0.1 --port "$port" --strictPort) >>"$EVIDENCE/server.log" 2>&1 &
    SERVER_PID=$!
    set +m
    for _ in $(seq 240); do
        kill -0 "$SERVER_PID" 2>/dev/null || { tail -20 "$EVIDENCE/server.log" >&2; die "server exited before it was ready"; }
        curl -sf -o /dev/null "$ready" && break
        sleep 0.5
    done
    curl -sf -o /dev/null "$ready" || die "server not ready after 120s, see $EVIDENCE/server.log"
    owner=$(port_owner "$port")
    pgid=$(ps -o pgid= -p "$owner" 2>/dev/null | tr -d ' ')
    [ "$pgid" = "$SERVER_PID" ] || die ":$port is held by pid $owner (pgid $pgid), not by our server $SERVER_PID"
    title=$(curl -sf "$ready" | grep -o '<title>[^<]*' | head -1 | sed 's/<title>//')
    [ "$title" = "$TITLE" ] || die "$ready serves an unexpected document: '$title'"
    {
        echo "url=$URL server_pid=$SERVER_PID"
        echo "title=$title"
        echo "commit=$(git -C "$REPO" rev-parse --short HEAD) dirty_files=$(git -C "$REPO" status --porcelain | wc -l | tr -d ' ')"
    } >"$EVIDENCE/instance.txt"
}

cmd_flow() {
    local flow=${1:-} evidence="" auth=demo locale=en-US width=1280 welcome=0
    [ -n "$flow" ] || { usage; exit 2; }
    shift
    while [ $# -gt 0 ]; do
        case $1 in
        --logged-out) auth=out ;;
        --locale) locale=$2; shift ;;
        --width) width=$2; shift ;;
        --welcome) welcome=1 ;;
        --evidence) evidence=$2; shift ;;
        *) die "unknown flow option: $1" ;;
        esac
        shift
    done
    [[ "$width" =~ ^[0-9]+$ ]] || die "--width takes a number of CSS pixels"
    [ -f "$flow" ] || die "flow file not found: $flow"
    flow=$(cd "$(dirname "$flow")" && pwd)/$(basename "$flow")
    new_evidence "$evidence" "$(basename "$flow" .mjs)"
    start_server "$(free_port)"
    local rc=0
    BUSINESS_URL="$URL" PLAYWRIGHT_HOME="$PLAYWRIGHT_HOME" EVIDENCE_DIR="$EVIDENCE" VERIFY_AUTH="$auth" \
        VERIFY_LOCALE="$locale" VERIFY_WIDTH="$width" VERIFY_WELCOME="$welcome" \
        node --no-warnings "$SCRIPT_DIR/drive.mjs" "$flow" || rc=$?
    [ -f "$EVIDENCE/verdict.txt" ] || echo "FAIL driver exited $rc without a verdict" >"$EVIDENCE/verdict.txt"
    cat "$EVIDENCE/verdict.txt"
    return $rc
}

case ${1:-} in
doctor) doctor ;;
flow) shift; cmd_flow "$@" ;;
-h | --help | help) usage ;;
*) usage; exit 2 ;;
esac
