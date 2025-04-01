#!/bin/bash

# We are doing that just because sst dev command fck up with the ssh flag param

# Get params from the environment
bastionHost=$BASTION_HOST
bastionZone=$BASTION_ZONE
localPort=$LOCAL_PORT
dbHost=$DB_HOST
dbPort=$DB_PORT

echo "Launching tunnel to ${bastionHost} in zone ${bastionZone} on port ${localPort} to ${dbHost}:${dbPort}"

# Print the cmd that will be run
echo "gcloud compute ssh ${bastionHost} --zone=${bastionZone} --tunnel-through-iap --ssh-flag=\"-4 -L${localPort}:${dbHost}:${dbPort} -N -q\""

# Launch the tunnel command
function launch_tunnel() {
    gcloud compute ssh ${bastionHost} --zone=${bastionZone} --tunnel-through-iap --ssh-flag="-4 -L${localPort}:${dbHost}:${dbPort} -N -q"
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "Tunnel creation failed. Attempting to re-authenticate..."
        gcloud auth application-default login
        
        echo "Retrying tunnel creation..."
        launch_tunnel
    fi
}

launch_tunnel