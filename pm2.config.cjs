/**
 * Pm2 configuration file
 */
module.exports = {
    apps: [
        {
            name: "sst-config",
            script: "bun sst dev",
            cwd: "./",
        },
        {
            name: "wallet",
            script: "bun",
            args: "run dev",
            cwd: "./packages/wallet",
            env: {
                PORT: 3000,
            },
        },
        {
            name: "business",
            script: "bun",
            args: "run dev",
            cwd: "./packages/dashboard",
            env: {
                PORT: 3001,
            },
        },
        {
            name: "news-interaction",
            script: "bun",
            args: "run dev",
            cwd: "./example/news-interactions",
            env: {
                PORT: 3011,
            },
        },
        {
            name: "demo-ethcc",
            script: "bun",
            args: "run dev",
            cwd: "./example/wallet-ethcc",
            env: {
                PORT: 3012,
            },
        },
    ],
};
