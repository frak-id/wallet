import { dbInstance, elysiaEnv, postgresEnv } from "./secrets";

// Local port is a random number between 8000 and 9999
const localPort = "8888";

// DB tunnel cmd
new sst.x.DevCommand("db-tunnel", {
    dev: {
        title: "GCP Tunnel",
        autostart: false,
        command: "bash ./infra/gcp-tunnel.sh",
    },
    environment: {
        BASTION_HOST: "bastion-host",
        BASTION_ZONE: "europe-west1-b",
        LOCAL_PORT: localPort,
        DB_HOST: dbInstance.privateIpAddress,
        DB_PORT: "5432",
    },
});

// Get the db parameters for local development (uses separate 'local' schema)
export const dbEnv = {
    ...postgresEnv,
    POSTGRES_HOST: "localhost",
    POSTGRES_PORT: localPort,
    POSTGRES_SCHEMA: "local",
};

// Backend dev command
new sst.x.DevCommand("backend", {
    dev: {
        title: "Backend",
        autostart: true,
        command: "bun run dev",
        directory: "services/backend",
    },
    environment: {
        ...elysiaEnv,
        ...dbEnv,
        DOMAIN_NAME: "",
        STAGE: $app.stage,
    },
});