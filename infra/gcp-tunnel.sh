#!/bin/bash

# We are doing that just because sst dev command fck up with the ssh flag param

# Kill the whole process group (this script is its own session/group leader,
# set by sst via Setsid) so gcloud/kubectl grandchildren die too, not just
# the launch_*_tunnel job wrappers.
trap 'kill -- -$$ 2>/dev/null; exit' INT TERM EXIT

# --- Postgres tunnel (gcloud SSH through bastion) ---
bastionHost=$BASTION_HOST
bastionZone=$BASTION_ZONE
localPort=$LOCAL_PORT
dbHost=$DB_HOST
dbPort=$DB_PORT

echo "[postgres] Launching tunnel to ${bastionHost} in zone ${bastionZone} on port ${localPort} to ${dbHost}:${dbPort}"

function launch_pg_tunnel() {
    gcloud compute ssh ${bastionHost} --zone=${bastionZone} --tunnel-through-iap --ssh-flag="-4 -L${localPort}:${dbHost}:${dbPort} -N -q"
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "[postgres] Tunnel creation failed. Attempting to re-authenticate..."
        gcloud auth application-default login
        echo "[postgres] Retrying tunnel creation..."
        launch_pg_tunnel
    fi
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

# --- sqld tunnel (kubectl port-forward to K8s pod) ---
sqldLocalPort=$SQLD_LOCAL_PORT
sqldNamespace=$SQLD_NAMESPACE
sqldService=$SQLD_SERVICE
sqldRemotePort=$SQLD_REMOTE_PORT

echo "[sqld] Forwarding localhost:${sqldLocalPort} -> ${sqldService}.${sqldNamespace}:${sqldRemotePort}"

function launch_sqld_tunnel() {
    kubectl port-forward -n "${sqldNamespace}" "svc/${sqldService}" "${sqldLocalPort}:${sqldRemotePort}"
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "[sqld] Port-forward failed (exit code: ${exit_code}). Retrying in 3s..."
        sleep 3
        launch_sqld_tunnel
    fi
}

# --- RustFS tunnel (kubectl port-forward to RustFS pod) ---
rustfsLocalPort=${RUSTFS_LOCAL_PORT:-9100}
rustfsNamespace="db-production"
rustfsService="rustfs-production-service"
rustfsRemotePort=9000

echo "[rustfs] Forwarding localhost:${rustfsLocalPort} -> ${rustfsService}.${rustfsNamespace}:${rustfsRemotePort}"

function launch_rustfs_tunnel() {
    kubectl port-forward -n "${rustfsNamespace}" "svc/${rustfsService}" "${rustfsLocalPort}:${rustfsRemotePort}"
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "[rustfs] Port-forward failed (exit code: ${exit_code}). Retrying in 3s..."
        sleep 3
        launch_rustfs_tunnel
    fi
}

# Run both tunnels in parallel, exit if either dies
launch_pg_tunnel &
launch_sqld_tunnel &
launch_rustfs_tunnel &
monitor_pg_health &
wait
