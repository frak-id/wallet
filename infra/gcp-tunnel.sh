#!/bin/bash

# We are doing that just because sst dev command fck up with the ssh flag param

# Get params from the environment
bastionHost=$BASTION_HOST
bastionZone=$BASTION_ZONE
localPort=$LOCAL_PORT
dbHost=$DB_HOST
dbPort=$DB_PORT

echo "Launching tunnel to ${bastionHost} in zone ${bastionZone} on port ${localPort} to ${dbHost}:${dbPort}"

# Launch the tunnel command
gcloud compute ssh ${bastionHost} --zone=${bastionZone} --tunnel-through-iap --ssh-flag="-4 -L${localPort}:${dbHost}:${dbPort} -N -q"