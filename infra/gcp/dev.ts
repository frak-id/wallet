const stage = "staging";

// Get the db instance
const dbInstance = $output(
    gcp.sql.getDatabaseInstance({
        name: `master-db-${stage}`,
    })
);

const bastionHost = "bastion-host";
const bastionZone = "europe-west1-b";
const dbHost = dbInstance.privateIpAddress;

// Launch the tunnel
const tunnelCmd = new sst.x.DevCommand("db-tunnel", {
    dev: {
        title: "[DB] Tunnel",
        autostart: false,
        command: "bash ./infra/gcp-tunnel.sh",
    },
    environment: {
        BASTION_HOST: bastionHost,
        BASTION_ZONE: bastionZone,
        LOCAL_PORT: "8888",
        DB_HOST: dbHost,
        DB_PORT: "5432",
    },
});

// Get the db parameters
const dbPassword = $output(
    gcp.secretmanager.getSecretVersion({
        secret: `wallet-backend-db-secret-${stage}`,
    })
).apply((secret) => secret.secretData);
const dbEnv = {
    POSTGRES_DB: "wallet-backend",
    POSTGRES_USER: `wallet-backend_${stage}`,
    POSTGRES_PASSWORD: dbPassword,
    POSTGRES_HOST: "localhost",
    POSTGRES_PORT: "8888",
};

// Helpers command
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
