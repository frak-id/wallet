import { dbInstance, elysiaEnv, postgresEnv } from "./secrets";

const localPort = "8888";
const sqldLocalPort = "8089";
const rustfsLocalPort = "9100";

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
        SQLD_LOCAL_PORT: sqldLocalPort,
        SQLD_NAMESPACE: "db-production",
        SQLD_SERVICE: "sqld-production-service",
        SQLD_REMOTE_PORT: "8080",
        RUSTFS_LOCAL_PORT: rustfsLocalPort,
    },
});

export const dbEnv = {
    ...postgresEnv,
    POSTGRES_HOST: "localhost",
    POSTGRES_PORT: localPort,
    POSTGRES_SCHEMA: "local",
};

const libsqlUrl = `http://localhost:${sqldLocalPort}`;

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
        LIBSQL_URL: libsqlUrl,
        DOMAIN_NAME: "",
        STAGE: $app.stage,
        // Override RustFS endpoint for local dev (tunnel)
        RUSTFS_ENDPOINT: `http://localhost:${rustfsLocalPort}`,
    },
});

// Drizzle migration for libsql (authenticator)
new sst.x.DevCommand("db-migrate-libsql", {
    dev: {
        title: "Migrate libsql",
        autostart: false,
        command: "bun db:migrate:libsql",
        directory: "services/backend",
    },
    environment: {
        LIBSQL_URL: libsqlUrl,
    },
});
