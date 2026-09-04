#!/bin/bash

# We are doing that just because sst dev command fck up with the ssh flag param

# Kill the whole process group (this script is its own session/group leader,
# set by sst via Setsid) so gcloud/kubectl grandchildren die too, not just
# the launch_*_tunnel job wrappers.
trap 'kill -- -$$ 2>/dev/null; exit' INT TERM EXIT

# --- Local port reclamation ---
# A local listener left over from a previous run makes every rebind fail with
# "address already in use", which no amount of retrying can fix. Reclaim the
# port when the holder is one of our own tunnel processes; refuse to touch
# anything else and let the caller abort instead of looping.
function reclaim_port() {
    local label=$1 port=$2 owner=$3 pids pid comm

    command -v lsof >/dev/null 2>&1 || return 0
    pids=$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null)
    [ -z "${pids}" ] && return 0

    for pid in ${pids}; do
        comm=$(ps -p "${pid}" -o comm= 2>/dev/null)
        case "${comm}" in
            ${owner})
                echo "[${label}] Reclaiming port ${port} from stale ${comm##*/} (pid ${pid})"
                kill "${pid}" 2>/dev/null
                ;;
            *)
                echo "[${label}] Port ${port} is held by '${comm:-unknown}' (pid ${pid}) — refusing to kill it. Free the port, then restart the GCP Tunnel task."
                return 1
                ;;
        esac
    done

    # The kernel needs a beat to release the socket before a rebind succeeds.
    sleep 1
    [ -z "$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null)" ]
}

# --- Postgres tunnel (gcloud SSH through bastion) ---
bastionHost=$BASTION_HOST
bastionZone=$BASTION_ZONE
localPort=$LOCAL_PORT
dbHost=$DB_HOST
dbPort=$DB_PORT

echo "[postgres] Launching tunnel to ${bastionHost} in zone ${bastionZone} on port ${localPort} to ${dbHost}:${dbPort}"

function launch_pg_tunnel() {
    local reauthed="" exit_code

    while true; do
        reclaim_port "postgres" "${localPort}" "*ssh*" || return 1

        gcloud compute ssh ${bastionHost} --zone=${bastionZone} --tunnel-through-iap --ssh-flag="-4 -L${localPort}:${dbHost}:${dbPort} -N -q"
        exit_code=$?
        [ $exit_code -eq 0 ] && return 0

        # Re-auth is worth exactly one shot: a second failure is not a token problem.
        if [ -n "${reauthed}" ]; then
            echo "[postgres] Tunnel failed again after re-authenticating (exit code: ${exit_code}). Restart the GCP Tunnel task."
            return 1
        fi
        reauthed="yes"
        echo "[postgres] Tunnel creation failed. Attempting to re-authenticate..."
        gcloud auth application-default login
        echo "[postgres] Retrying tunnel creation..."
    done
}

# --- Postgres tunnel health-check ---
# The local `-L` listener accepts TCP even when the IAP/SSH channel is dead, so
# a plain "is the port open?" check passes on a broken tunnel. Probe the
# Postgres wire protocol instead: send an SSLRequest and require a 1-byte reply
# from the real server. Surfaces both a failed startup and a mid-session death
# (e.g. laptop sleep) that would otherwise hang every DB query for ~30s.
#
# Note: the probe leaves the startup incomplete, so Postgres logs one
# "incomplete startup packet" per run — kept rare (startup + a slow re-check
# loop) to avoid spamming the shared server's logs.
function probe_pg() {
    python3 - "${localPort}" <<'PY' 2>/dev/null
import socket, struct, sys
port = int(sys.argv[1])
try:
    s = socket.create_connection(("127.0.0.1", port), timeout=4)
    s.sendall(struct.pack("!ii", 8, 80877103))
    s.settimeout(5)
    sys.exit(0 if s.recv(1) else 1)
except Exception:
    sys.exit(1)
PY
}

function monitor_pg_health() {
    if ! command -v python3 >/dev/null 2>&1; then
        echo "[postgres] health-check skipped (python3 not found)"
        return
    fi
    # Give the tunnel a moment to establish before the first probe.
    sleep 8
    local healthy=""
    while true; do
        if probe_pg; then
            if [ "${healthy}" != "yes" ]; then
                echo "[postgres] ✅ tunnel healthy — DB responds on localhost:${localPort}"
                healthy="yes"
            fi
        elif [ "${healthy}" != "no" ]; then
            echo "[postgres] ❌ tunnel DEAD — localhost:${localPort} accepts connections but the DB never replies (stale SSH/IAP channel). Restart the GCP Tunnel task."
            healthy="no"
        fi
        # Slow loop: enough to catch a mid-session death without flooding the
        # shared Postgres log with incomplete-startup entries.
        sleep 120
    done
}

# --- kubectl port-forward supervisor ---
# `kubectl port-forward` exits 1 both when a live tunnel dies (transient) and
# when the local port is already bound (permanent while the holder lives), so
# every attempt resolves the bind conflict first and consecutive fast failures
# are capped. A forward that stayed up long enough resets the budget.
function supervise_port_forward() {
    local label=$1 namespace=$2 service=$3 localPort=$4 remotePort=$5
    local attempt=0 started exit_code delay

    while true; do
        if ! reclaim_port "${label}" "${localPort}" "*kubectl*"; then
            echo "[${label}] Tunnel abandoned."
            return 1
        fi

        started=$SECONDS
        kubectl port-forward -n "${namespace}" "svc/${service}" "${localPort}:${remotePort}"
        exit_code=$?
        [ $exit_code -eq 0 ] && return 0

        [ $((SECONDS - started)) -ge 60 ] && attempt=0
        attempt=$((attempt + 1))
        if [ ${attempt} -gt 5 ]; then
            echo "[${label}] Port-forward failed 5 times in a row — giving up. Restart the GCP Tunnel task once the cause is fixed."
            return 1
        fi

        delay=$((attempt * 3))
        echo "[${label}] Port-forward failed (exit code: ${exit_code}). Retry ${attempt}/5 in ${delay}s..."
        sleep "${delay}"
    done
}

# --- sqld tunnel (kubectl port-forward to K8s pod) ---
sqldLocalPort=$SQLD_LOCAL_PORT
sqldNamespace=$SQLD_NAMESPACE
sqldService=$SQLD_SERVICE
sqldRemotePort=$SQLD_REMOTE_PORT

echo "[sqld] Forwarding localhost:${sqldLocalPort} -> ${sqldService}.${sqldNamespace}:${sqldRemotePort}"

# --- RustFS tunnel (kubectl port-forward to RustFS pod) ---
rustfsLocalPort=${RUSTFS_LOCAL_PORT:-9100}
rustfsNamespace="db-production"
rustfsService="rustfs-production-service"
rustfsRemotePort=9000

echo "[rustfs] Forwarding localhost:${rustfsLocalPort} -> ${rustfsService}.${rustfsNamespace}:${rustfsRemotePort}"

# Run both tunnels in parallel, exit if either dies
launch_pg_tunnel &
supervise_port_forward "sqld" "${sqldNamespace}" "${sqldService}" "${sqldLocalPort}" "${sqldRemotePort}" &
supervise_port_forward "rustfs" "${rustfsNamespace}" "${rustfsService}" "${rustfsLocalPort}" "${rustfsRemotePort}" &
monitor_pg_health &
wait
