const frakConfig = {
    walletUrl: "https://localhost:3000",
    metadata: {
        name: "Your App Name",
    },
    domain: window.location.host,
};

const loginModalStep = {
    allowSso: true as true,
    ssoMetadata: {
        logoUrl: "https://news-paper.xyz/assets/logo-good-vibes.svg",
        homepageLink: "https://news-paper.xyz/",
    },
};

const modalConfig = {
    metadata: {
        lang: "fr",
        isDismissible: true,
    },
    login: loginModalStep,
} as const;

const modalShareConfig = {
    popupTitle: "Share this article with your friends",
    text: "Discover this awesome article",
    link: typeof window !== "undefined" ? window.location.href : "",
};

window.FrakSetup = {
    config: frakConfig,
    modalConfig,
    modalShareConfig,
};
