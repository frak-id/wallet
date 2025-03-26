export function gapianne() {
    setConfig();
    replaceNexusShareButton();
    addWalletButton();
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
            lang: "fr",
            currency: "eur",
            logoUrl: logo,
            homepageLink: "https://gapianne.com/",
        },
        customizations: {
            i18n: {
                "sharing.title": "Prêt(e) à révéler un secret bien-être ?",
                "sharing.text": "Découvre ce produit chez Gapianne",
                "sdk.wallet.login.text":
                    "Créez votre porte-monnaie avec **{{ productName }}** et recevez **{{ estimatedReward }}** par ami(e) parrainé(e)",
            },
        },
        domain: window.location.host,
    };
    window.FrakSetup.modalConfig = {
        login: {
            allowSso: true,
        },
        metadata: {
            isDismissible: true,
        },
    };
    window.FrakSetup.modalShareConfig = {
        link: window.location.href,
    };
    window.FrakSetup.modalWalletConfig = {
        metadata: {
            position: "left",
        },
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
        buttonShare.setAttribute("text", "PARTAGE ET GAGNE {REWARD} !");
        buttonShare.setAttribute("no-reward-text", "PARTAGE ET GAGNE");
        buttonShare.setAttribute("use-reward", "true");
        buttonShare.setAttribute("show-wallet", "true");
        buttonShare.setAttribute("classname", "button w-full");
        button.replaceWith(buttonShare);
    }
}

/**
 * Add frak-button-wallet to the body
 */
function addWalletButton() {
    // Inject only if the cookie button is disabled (has the disabled html tag) (since it's also on the bottom left of the page)
    const id = "axeptio_main_button";
    const cookieButton = document.getElementById(id);

    // If we didn't find it, consider it's not present
    const isDisabled = cookieButton
        ? cookieButton.hasAttribute("disabled")
        : true;
    if (!isDisabled) return;

    const buttonWallet = document.createElement("frak-button-wallet");
    buttonWallet.setAttribute("use-reward", "true");
    document.body.appendChild(buttonWallet);
}
