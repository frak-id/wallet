async function init() {
    /**
     * If we are not using the CDN, we need to import the components
     */
    if (!process.env.USE_CDN) {
        await Promise.all([
            import("@frak-labs/components/dist/buttonWallet.js"),
            import("@frak-labs/components/dist/buttonWallet.css"),
            import("@frak-labs/components/dist/buttonShare.js"),
            import("@frak-labs/components/dist/buttonShare.css"),
            import("@frak-labs/components/dist/buttonGift.js"),
            import("@frak-labs/components/dist/buttonGift.css"),
        ]);
    }

    const walletUrl =
        process.env.NODE_ENV === "production"
            ? "https://wallet-dev.frak.id"
            : "https://localhost:3000";

    window.FrakSetup = {
        config: {
            walletUrl,
            metadata: {
                name: "Vanilla JS",
                lang: "fr",
                currency: "eur",
            },
        },
        modalWalletConfig: {
            metadata: {
                position: "left",
            },
        },
    };
}

init();
