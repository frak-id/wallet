import { dbInstance, elysiaEnv, postgresEnv } from "./secrets";

// Local port is a random number between 8000 and 9999
const localPort = $output(Math.floor(Math.random() * 2000) + 8000).apply(
    (port) => port.toString()
);

// Launch the tunnel
const tunnelCmd = new sst.x.DevCommand("db-tunnel", {
    dev: {
        title: "GCP Tunnel",
        autostart: true,
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

// Get the db parameters
const dbEnv = {
    ...postgresEnv,
    POSTGRES_HOST: "localhost",
    POSTGRES_PORT: localPort,
};

// Helpers command
export const backend = new sst.x.DevCommand("backend", {
    dev: {
        title: "Backend",
        autostart: true,
        command: "bun run dev",
        directory: "packages/backend-elysia",
    },
    environment: {
        ...elysiaEnv,
        ...dbEnv,
    },
});
export const dbGcpStudio = new sst.x.DevCommand(
    "db:gcp:studio",
    {
        dev: {
            title: "[DB][GCP] Inspect",
            autostart: false,
            command: "bunx drizzle-kit studio --port 13001",
            directory: "packages/backend-elysia",
        },
        environment: dbEnv,
    },
    {
        dependsOn: [tunnelCmd],
    }
);
export const dbGcpGenerate = new sst.x.DevCommand("db:gcp:generate", {
    dev: {
        title: "[DB][GCP] Generate",
        autostart: false,
        command: "bunx drizzle-kit generate",
        directory: "packages/backend-elysia",
    },
    environment: dbEnv,
});
