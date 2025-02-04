const walletUrl =
    process.env.NODE_ENV === "production"
        ? "https://wallet-dev.frak.id"
        : "https://localhost:3000";

window.FrakSetup = {
    config: {
        walletUrl,
        metadata: {
            name: "Your App Name",
        },
    },
    modalWalletConfig: {
        metadata: {
            position: "left",
        },
    },
};
