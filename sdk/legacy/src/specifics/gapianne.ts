export function gapianne() {
    setConfig();
    replaceNexusShareButton();
}

/**
 * Set gapianne config
 */
function setConfig() {
    const logo =
        "https://gapianne.com/cdn/shop/files/logo-gapianne_7a65f4c4-54e8-4831-afa2-0849e4c5f8de.png";

    window.FrakSetup.config = {
        walletUrl: "https://wallet.frak.id",
        metadata: {
            name: "Gapianne",
        },
        domain: window.location.host,
    };
    window.FrakSetup.modalConfig = {
        login: {
            allowSso: true,
            ssoMetadata: {
                logoUrl: logo,
                homepageLink: "https://gapianne.com/",
            },
        },
        metadata: {
            header: {
                icon: logo,
            },
            isDismissible: true,
            lang: "fr",
        },
    };
    window.FrakSetup.modalShareConfig = {
        popupTitle: "Pr\xEAt(e) \xE0 r\xE9v\xE9ler un secret bien-\xEAtre ?",
        text: "D\xE9couvre ce produit chez Gapianne",
        link: window.location.href,
    };
}

/**
 * Replace all #nexus-share-button with frak-button-share
 */
function replaceNexusShareButton() {
    const nexusShareButtons = document.querySelectorAll(
        "#nexus-share-button > button"
    );
    for (const button of Array.from(nexusShareButtons)) {
        const buttonShare = document.createElement("frak-button-share");
        buttonShare.setAttribute("text", "PARTAGE ET GAGNE");
        buttonShare.setAttribute("classname", "button w-full");
        button.replaceWith(buttonShare);
    }
}
