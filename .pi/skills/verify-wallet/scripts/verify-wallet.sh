#!/usr/bin/env bash
# Launches an owned, hermetic wallet instance, drives it, keeps the evidence, tears the instance down.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$SCRIPT_DIR/../../../.." && pwd)
WALLET="$REPO/apps/wallet"
EVIDENCE_ROOT="$REPO/.pi/verify-evidence"
SERVER_PID=""
EVIDENCE=""
SCRATCH=""
REAL_DEV=0
# The real-dev page origin: the gcp-dev backend only verifies passkeys from it, so Chromium maps it onto the local server.
REAL_DEV_HOST=wallet-dev.frak.id
# Outside the checkout so every worktree and clone logs into the same gcp-dev wallet; it holds a private key.
REAL_DEV_CREDENTIAL="${VERIFY_WALLET_CREDENTIAL:-$HOME/.pi/verify-wallet/authenticator-dev.json}"

usage() {
    cat <<'EOF'
Usage:
  verify-wallet.sh doctor
  verify-wallet.sh flow <spa|standalone> <flow.mjs> [--logged-out] [--desktop] [--evidence DIR]
  verify-wallet.sh flow spa <flow.mjs> --real-dev [--desktop] [--evidence DIR]
  verify-wallet.sh check [--evidence DIR] -- <playwright args for playwright.light.config.ts>

flow   starts its own server on a free port, runs the flow in headless Chromium
       (visible with VERIFY_HEADED=1; Pixel 7 by default) with backend/RPC/
       analytics mocked and every other off-origin request blocked, then stops
       the server.
       --real-dev: no mocks. The local SPA is served as https://wallet-dev.frak.id
       and logs in (registering once) to the real gcp-dev backend and Arbitrum
       Sepolia with a persisted test passkey. Writes to the shared dev database.
check  runs the repo's light Playwright suite (apps/wallet/tests-light). Its spa
       project needs https://localhost:3000, so check refuses if :3000 is taken.
Evidence goes to a NEW directory (default .pi/verify-evidence/<utc>-<label>);
an existing directory is refused. verdict.txt is written last.
EOF
}

die() { echo "verify-wallet: $*" >&2; exit 2; }

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
    if [ -n "$SCRATCH" ] && [ -d "$SCRATCH" ]; then rm -rf -- "$SCRATCH"; fi
    if [ -n "$EVIDENCE" ] && [ -d "$EVIDENCE" ]; then echo "evidence: $EVIDENCE" >&2; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

new_evidence() {
    local dir=${1:-"$EVIDENCE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)-$2"}
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
    [ -f "$WALLET/package.json" ] && say ok "wallet app at $WALLET" || say FAIL "no apps/wallet under $REPO"
    command -v bun >/dev/null && say ok "bun $(bun --version)" || say FAIL "bun not on PATH"
    local nodev
    nodev=$(node -p 'process.versions.node' 2>/dev/null || echo 0)
    node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>23||(a===23&&b>=6)?0:1)' 2>/dev/null \
        && say ok "node $nodev (strips TypeScript natively)" || say FAIL "node $nodev: need >= 23.6 to import tests-light/mocks/*.ts"
    local pw
    pw=$(cd "$WALLET" && node -p 'require("@playwright/test/package.json").version' 2>/dev/null || true)
    [ -n "$pw" ] && say ok "@playwright/test $pw" || say FAIL "@playwright/test not installed in apps/wallet (bun install)"
    local exe
    exe=$(cd "$WALLET" && node -p 'require("@playwright/test").chromium.executablePath()' 2>/dev/null || true)
    [ -n "$exe" ] && [ -e "$exe" ] && say ok "chromium for playwright $pw" \
        || say FAIL "chromium missing for playwright $pw: (cd apps/wallet && bunx playwright install chromium)"
    [ -f "$WALLET/tests-light/mocks/api.ts" ] && say ok "light mocks present" || say FAIL "apps/wallet/tests-light/mocks/api.ts missing"
    [ -f "$WALLET/public/sw.js" ] && say ok "service worker built (flow/check rebuild it anyway)" \
        || say info "public/sw.js missing; flow/check run build:sw first"
    [ -f "$REAL_DEV_CREDENTIAL" ] && say ok "real-dev passkey at $REAL_DEV_CREDENTIAL (next --real-dev run logs in)" \
        || say info "no real-dev passkey yet; the first --real-dev run registers a new gcp-dev wallet"
    local o
    o=$(port_owner 3000)
    [ -z "$o" ] && say ok ":3000 free (needed only by check's spa project)" \
        || say info ":3000 held by pid $o ($(ps -o comm= -p "$o")); check's spa project will refuse, flow is unaffected"
    return $ok
}

start_server() { # $1 = spa|standalone, $2 = port
    local surface=$1 port=$2 ready
    if [ "$surface" = spa ]; then
        echo "== build:sw" >>"$EVIDENCE/server.log"
        (cd "$WALLET" && bun run build:sw) >>"$EVIDENCE/server.log" 2>&1 || die "build:sw failed, see $EVIDENCE/server.log"
        if [ "$REAL_DEV" = 1 ]; then
            URL="https://$REAL_DEV_HOST"
            ready="https://127.0.0.1:$port/"
            set -m
            (cd "$WALLET" && __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="$REAL_DEV_HOST" \
                exec bun x vite dev --host 127.0.0.1 --port "$port" --strictPort) >>"$EVIDENCE/server.log" 2>&1 &
        else
            URL="https://localhost:$port"
            ready="$URL/"
            set -m
            (cd "$WALLET" && exec bun x vite dev --port "$port" --strictPort) >>"$EVIDENCE/server.log" 2>&1 &
        fi
    else
        URL="http://127.0.0.1:$port"
        ready="$URL/sharing"
        set -m
        (cd "$WALLET" && STANDALONE_PORT="$port" exec bun tests-light/serve-standalone.ts) >>"$EVIDENCE/server.log" 2>&1 &
    fi
    SERVER_PID=$!
    set +m
    for _ in $(seq 360); do
        kill -0 "$SERVER_PID" 2>/dev/null || { tail -20 "$EVIDENCE/server.log" >&2; die "$surface server exited before it was ready"; }
        curl -ksf -o /dev/null "$ready" && break
        sleep 0.5
    done
    curl -ksf -o /dev/null "$ready" || die "$surface server not ready after 180s, see $EVIDENCE/server.log"
    instance_doctor "$surface" "$port" "$ready"
}

instance_doctor() { # proves the port is ours and serves the wallet, before anything drives it
    local surface=$1 port=$2 ready=$3 owner pgid title
    owner=$(port_owner "$port")
    pgid=$(ps -o pgid= -p "$owner" 2>/dev/null | tr -d ' ')
    [ "$pgid" = "$SERVER_PID" ] || die ":$port is held by pid $owner (pgid $pgid), not by our server $SERVER_PID"
    title=$(curl -ksf "$ready" | grep -o '<title>[^<]*' | sed 's/<title>//')
    case "$surface:$title" in
    spa:"Frak Wallet"*) ;;
    standalone:"Share &amp; earn | Frak") ;;
    *) die "$ready serves an unexpected document: '$title'" ;;
    esac
    {
        echo "surface=$surface url=$URL server_pid=$SERVER_PID"
        echo "title=$title"
        echo "commit=$(git -C "$REPO" rev-parse --short HEAD) dirty_files=$(git -C "$REPO" status --porcelain | wc -l | tr -d ' ')"
    } >"$EVIDENCE/instance.txt"
}

cmd_flow() {
    local surface=${1:-} flow=${2:-} evidence="" auth=in device="Pixel 7"
    shift 2 || { usage; exit 2; }
    while [ $# -gt 0 ]; do
        case $1 in
        --logged-out) [ "$REAL_DEV" = 0 ] || die "--real-dev and --logged-out are exclusive"; auth=out ;;
        --desktop) device="Desktop Chrome" ;;
        --webkit) device="iPhone 16" ;;
        --real-dev) [ "$auth" != out ] || die "--real-dev and --logged-out are exclusive"; REAL_DEV=1; auth=real-dev ;;
        --evidence) evidence=$2; shift ;;
        *) die "unknown flow option: $1" ;;
        esac
        shift
    done
    [[ "$surface" == spa || "$surface" == standalone ]] || die "surface must be spa or standalone"
    [ "$REAL_DEV" = 0 ] || [ "$surface" = spa ] || die "--real-dev only drives the spa surface"
    [ -f "$flow" ] || die "flow file not found: $flow"
    flow=$(cd "$(dirname "$flow")" && pwd)/$(basename "$flow")
    new_evidence "$evidence" "$(basename "$flow" .mjs)"
    local port
    port=$(free_port)
    REAL_AUTH=""
    if [ "$REAL_DEV" = 1 ]; then
        mkdir -p "$(dirname "$REAL_DEV_CREDENTIAL")" && chmod 700 "$(dirname "$REAL_DEV_CREDENTIAL")"
        bundle_real_auth
    fi
    start_server "$surface" "$port"
    local rc=0
    WALLET_URL="$URL" WALLET_DIR="$WALLET" EVIDENCE_DIR="$EVIDENCE" VERIFY_AUTH="$auth" VERIFY_DEVICE="$device" \
        VERIFY_MAP="$REAL_DEV_HOST 127.0.0.1:$port" VERIFY_REAL_AUTH="$REAL_AUTH" VERIFY_CREDENTIAL="$REAL_DEV_CREDENTIAL" \
        node --no-warnings "$SCRIPT_DIR/drive.mjs" "$flow" || rc=$?
    if [ "$REAL_DEV" = 1 ] && [ -f "$REAL_DEV_CREDENTIAL" ]; then chmod 600 "$REAL_DEV_CREDENTIAL"; fi
    [ -f "$EVIDENCE/verdict.txt" ] || echo "FAIL driver exited $rc without a verdict" >"$EVIDENCE/verdict.txt"
    cat "$EVIDENCE/verdict.txt"
    return $rc
}

bundle_real_auth() { # the e2e suite's passkey mock + auth page, bundled where node can resolve @playwright/test
    mkdir -p "$WALLET/node_modules/.cache/verify-wallet"
    SCRATCH=$(mktemp -d "$WALLET/node_modules/.cache/verify-wallet/run.XXXXXX")
    cat >"$SCRATCH/entry.ts" <<EOF
export { MockedWebAuthNHelper } from "$WALLET/tests/helpers/mockedWebauthn.helper.ts";
export { AuthPage } from "$WALLET/tests/pages/auth.page.ts";
EOF
    (cd "$WALLET" && bun build "$SCRATCH/entry.ts" --target node --format esm --external @playwright/test \
        --outfile "$SCRATCH/real-auth.mjs") >>"$EVIDENCE/server.log" 2>&1 || die "bundling the e2e auth helpers failed, see $EVIDENCE/server.log"
    REAL_AUTH="$SCRATCH/real-auth.mjs"
}

cmd_check() {
    local evidence=""
    while [ $# -gt 0 ] && [ "$1" != -- ]; do
        case $1 in
        --evidence) evidence=$2; shift ;;
        *) die "unknown check option: $1 (put playwright args after --)" ;;
        esac
        shift
    done
    [ "${1:-}" = -- ] && shift
    new_evidence "$evidence" check
    local spa_url="" args=" $* "
    if [[ "$args" != *"--project standalone "* && "$args" != *"--project=standalone "* ]]; then
        [ -z "$(port_owner 3000)" ] || die ":3000 is taken; the light spa project's storageState is pinned to https://localhost:3000 (stop that server or pass --project standalone)"
        start_server spa 3000
        spa_url=$URL
    fi
    local rc=0
    (cd "$WALLET" && LIGHT_BASE_URL="${spa_url:-https://localhost:3000}" STANDALONE_PORT="$(free_port)" \
        PLAYWRIGHT_HTML_OUTPUT_DIR="$EVIDENCE/report" \
        bun x playwright test --config playwright.light.config.ts --output "$EVIDENCE/test-results" "$@") \
        2>&1 | tee "$EVIDENCE/playwright.log" || rc=$?
    [ "$rc" = 0 ] && echo "PASS light suite: $*" >"$EVIDENCE/verdict.txt" || echo "FAIL light suite exited $rc: $*" >"$EVIDENCE/verdict.txt"
    cat "$EVIDENCE/verdict.txt"
    return "$rc"
}

case ${1:-} in
doctor) doctor ;;
flow) shift; cmd_flow "$@" ;;
check) shift; cmd_check "$@" ;;
-h | --help | help) usage ;;
*) usage; exit 2 ;;
esac
