#!/bin/bash

# We are doing that just because sst dev command fck up with the ssh flag param

trap 'kill $(jobs -p) 2>/dev/null; exit' INT TERM EXIT

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

# Run both tunnels in parallel, exit if either dies
launch_pg_tunnel &
launch_sqld_tunnel &
wait