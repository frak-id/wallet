#!/usr/bin/env bash
# Renders the real apps/shopify routes outside the Shopify admin, drives them, keeps the evidence, tears the server down.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL=$(cd "$SCRIPT_DIR/.." && pwd)
REPO=$(cd "$SKILL/../../.." && pwd)
# apps/shopify has no Playwright of its own; the wallet's install is the repo's pinned one.
PLAYWRIGHT_HOME="$REPO/apps/wallet"
EVIDENCE_ROOT="$REPO/.pi/verify-evidence"
TITLE="verify-shopify harness"
SERVER_PID=""
EVIDENCE=""
STAGE=""

usage() {
    cat <<'EOF'
Usage:
  verify-shopify.sh doctor [--tree DIR]
  verify-shopify.sh mocks [--tree DIR]
  verify-shopify.sh flow <flow.mjs> [--tree DIR] [--locale en|fr] [--width N] [--evidence DIR]

doctor  read-only: tools, browser, and the app files the harness imports.
mocks   type-checks the harness's mock loader data against the real route loaders
        (exit 1 = a loader changed shape and the mocks need updating).
flow    serves apps/shopify's route modules with vite on a free port (server modules
        stubbed, loader data mocked, Polaris from Shopify's CDN), runs the flow in
        headless Chromium (VERIFY_HEADED=1 to watch; 1040 wide, English by default)
        with every other off-origin request blocked, then stops the server.
--tree  render another checkout's apps/shopify (it needs its own bun install and
        bun run build:sdk); default is the checkout this skill lives in.
Evidence goes to a NEW directory (default .pi/verify-evidence/<utc>-shopify-<label>);
an existing directory is refused. verdict.txt is written last.
EOF
}

die() { echo "verify-shopify: $*" >&2; exit 2; }

free_port() {
    node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}

port_owner() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }

cleanup() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        # The server is its own process group (set -m), so this reaches vite's children and nothing else.
        kill -TERM -- "-$SERVER_PID" 2>/dev/null || kill -TERM "$SERVER_PID" 2>/dev/null || true
        for _ in $(seq 50); do kill -0 "$SERVER_PID" 2>/dev/null || break; sleep 0.1; done
        kill -KILL -- "-$SERVER_PID" 2>/dev/null || true
    fi
    if [ -n "$STAGE" ] && [ -d "$STAGE" ]; then rm -rf "$STAGE"; fi
    if [ -n "$EVIDENCE" ] && [ -d "$EVIDENCE" ]; then echo "evidence: $EVIDENCE" >&2; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# A per-run copy of harness/ whose node_modules is the tree's own, so the app and the harness share one React.
stage_harness() { # $1 = tree
    local tree=$1
    STAGE=$(mktemp -d "${TMPDIR:-/tmp}/verify-shopify.XXXXXX")
    cp "$SKILL"/harness/* "$STAGE/"
    ln -s "$tree/apps/shopify/node_modules" "$STAGE/node_modules"
    cat >"$STAGE/tsconfig.json" <<EOF
{
    "extends": "$tree/apps/shopify/tsconfig.json",
    "include": ["main.tsx", "useMerchantBank.mock.ts", "$tree/apps/shopify/env.d.ts", "$tree/apps/shopify/app/globals.d.ts"]
}
EOF
}

resolve_tree() { # $1 = --tree value or empty
    local tree=${1:-$REPO}
    [ -d "$tree/apps/shopify" ] || die "no apps/shopify under $tree"
    (cd "$tree" && pwd)
}

new_evidence() {
    local dir=${1:-"$EVIDENCE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)-shopify-$2"}
    [ -e "$dir" ] && die "evidence dir already exists, refusing to reuse it: $dir"
    if [[ "$dir" == "$EVIDENCE_ROOT"/* ]]; then
        mkdir -p "$EVIDENCE_ROOT"
        [ -f "$EVIDENCE_ROOT/.gitignore" ] || echo '*' >"$EVIDENCE_ROOT/.gitignore"
    fi
    mkdir -p "$dir"
    EVIDENCE=$(cd "$dir" && pwd)
}

doctor() {
    local tree ok=0 pw exe f
    tree=$(resolve_tree "${1:-}")
    local shopify="$tree/apps/shopify"
    say() { printf '%-5s %s\n' "$1" "$2"; [ "$1" = FAIL ] && ok=1; return 0; }
    say ok "shopify app at $shopify"
    command -v bun >/dev/null && say ok "bun $(bun --version)" || say FAIL "bun not on PATH"
    for f in curl lsof; do
        command -v $f >/dev/null && say ok "$f" || say FAIL "$f not on PATH (flow needs it to check the server it starts)"
    done
    [ -x "$shopify/node_modules/.bin/vite" ] && say ok "vite installed in apps/shopify" || say FAIL "apps/shopify/node_modules missing (bun install in $tree)"
    [ -f "$tree/sdk/core/dist/index.d.ts" ] && say ok "SDK built (sdk/core/dist)" || say FAIL "SDK not built: (cd $tree && bun run build:sdk)"
    pw=$(cd "$PLAYWRIGHT_HOME" && node -p 'require("@playwright/test/package.json").version' 2>/dev/null || true)
    [ -n "$pw" ] && say ok "@playwright/test $pw (from apps/wallet)" || say FAIL "@playwright/test not installed in apps/wallet (bun install)"
    exe=$(cd "$PLAYWRIGHT_HOME" && node -p 'require("@playwright/test").chromium.executablePath()' 2>/dev/null || true)
    [ -n "$exe" ] && [ -e "$exe" ] && say ok "chromium for playwright $pw" \
        || say FAIL "chromium missing for playwright $pw: (cd apps/wallet && bunx playwright install chromium)"
    for f in $(grep -o '"app/[^"]*"' "$SKILL/harness/main.tsx" | tr -d '"' | sort -u); do
        compgen -G "$shopify/$f.ts*" >/dev/null || compgen -G "$shopify/$f/index.ts*" >/dev/null \
            || compgen -G "$shopify/$f/route.ts*" >/dev/null || say FAIL "harness imports $f, missing in $shopify"
    done
    [ $ok = 0 ] && say ok "every app module main.tsx imports exists"
    return $ok
}

cmd_mocks() {
    local tree
    tree=$(resolve_tree "${1:-}")
    stage_harness "$tree"
    (cd "$tree/apps/shopify" && ./node_modules/.bin/react-router typegen >/dev/null)
    if (cd "$STAGE" && ./node_modules/.bin/tsc --noEmit -p tsconfig.json); then
        echo "ok    mock loader data matches the route loaders of $tree"
    else
        echo "FAIL  mock loader data no longer matches the route loaders: update $SKILL/harness/main.tsx" >&2
        return 1
    fi
}

start_server() { # $1 = port, $2 = tree
    local port=$1 tree=$2 owner pgid title
    URL="http://127.0.0.1:$port"
    set -m
    (cd "$tree/apps/shopify" && VERIFY_SHOPIFY_TREE="$tree" exec ./node_modules/.bin/vite --config "$STAGE/vite.config.mjs" \
        --host 127.0.0.1 --port "$port" --strictPort) >>"$EVIDENCE/server.log" 2>&1 &
    SERVER_PID=$!
    set +m
    for _ in $(seq 240); do
        kill -0 "$SERVER_PID" 2>/dev/null || { tail -20 "$EVIDENCE/server.log" >&2; die "server exited before it was ready"; }
        curl -sf -o /dev/null "$URL/" && break
        sleep 0.5
    done
    curl -sf -o /dev/null "$URL/" || die "server not ready after 120s, see $EVIDENCE/server.log"
    owner=$(port_owner "$port")
    pgid=$(ps -o pgid= -p "$owner" 2>/dev/null | tr -d ' ')
    [ "$pgid" = "$SERVER_PID" ] || die ":$port is held by pid $owner (pgid $pgid), not by our server $SERVER_PID"
    title=$(curl -sf "$URL/" | grep -o '<title>[^<]*' | head -1 | sed 's/<title>//')
    [ "$title" = "$TITLE" ] || die "$URL/ serves an unexpected document: '$title'"
    {
        echo "url=$URL server_pid=$SERVER_PID"
        echo "tree=$tree"
        echo "commit=$(git -C "$tree" rev-parse --short HEAD) dirty_files=$(git -C "$tree" status --porcelain | wc -l | tr -d ' ')"
    } >"$EVIDENCE/instance.txt"
}

cmd_flow() {
    local flow=${1:-} evidence="" tree="" locale=en width=1040
    [ -n "$flow" ] || { usage; exit 2; }
    shift
    while [ $# -gt 0 ]; do
        case $1 in
        --tree) tree=$2; shift ;;
        --locale) locale=$2; shift ;;
        --width) width=$2; shift ;;
        --evidence) evidence=$2; shift ;;
        *) die "unknown flow option: $1" ;;
        esac
        shift
    done
    [[ "$width" =~ ^[0-9]+$ ]] || die "--width takes a number of CSS pixels"
    [[ "$locale" =~ ^(en|fr)$ ]] || die "--locale is en or fr"
    [ -f "$flow" ] || die "flow file not found: $flow"
    flow=$(cd "$(dirname "$flow")" && pwd)/$(basename "$flow")
    tree=$(resolve_tree "$tree")
    new_evidence "$evidence" "$(basename "$flow" .mjs)"
    stage_harness "$tree"
    start_server "$(free_port)" "$tree"
    local rc=0
    SHOPIFY_URL="$URL" PLAYWRIGHT_HOME="$PLAYWRIGHT_HOME" EVIDENCE_DIR="$EVIDENCE" \
        VERIFY_LOCALE="$locale" VERIFY_WIDTH="$width" \
        node --no-warnings "$SCRIPT_DIR/drive.mjs" "$flow" || rc=$?
    [ -f "$EVIDENCE/verdict.txt" ] || echo "FAIL driver exited $rc without a verdict" >"$EVIDENCE/verdict.txt"
    cat "$EVIDENCE/verdict.txt"
    return $rc
}

opt_tree() { # doctor/mocks take only --tree
    [ $# -eq 0 ] && return 0
    [ "$1" = --tree ] && [ $# -eq 2 ] || die "unknown option: $*"
    echo "$2"
}

case ${1:-} in
doctor) shift; t=$(opt_tree "$@") || exit 2; doctor "$t" ;;
mocks) shift; t=$(opt_tree "$@") || exit 2; cmd_mocks "$t" ;;
flow) shift; cmd_flow "$@" ;;
-h | --help | help) usage ;;
*) usage; exit 2 ;;
esac
