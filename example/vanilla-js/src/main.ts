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
            import("@frak-labs/components/dist/openInApp.js"),
            import("@frak-labs/components/dist/openInApp.css"),
        ]);
    }
}

init();
