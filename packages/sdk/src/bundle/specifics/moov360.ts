import { loadScript } from "../../components/utils";

export function moov360() {
    setConfig();
    replaceFrakLinks();

    loadScript(
        "frak-bootstrap",
        "https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/dist/components.js"
    );
}

/**
 * Set moov360 config
 */
function setConfig() {
    window.FrakSetup.config = {
        walletUrl: "https://wallet.frak.id",
        metadata: {
            name: "Moov360",
        },
        domain: window.location.host,
    };
    window.FrakSetup.modalConfig = {
        login: {
            allowSso: true,
            ssoMetadata: {
                logoUrl:
                    "https://moov360.com/wp-content/uploads/2022/07/MOOV360noir-1.png",
                homepageLink: "https://moov360.com/",
            },
        },
        metadata: {
            header: {
                icon: "https://moov360.com/wp-content/uploads/2022/07/MOOV360noir-1.png",
            },
            lang: "fr",
        },
    };
    window.FrakSetup.modalShareConfig = {
        popupTitle: "Partage ce produit avec tes amis",
        text: "Découvre ce produit chez Moov360!",
        link: window.location.href,
    };
}

/**
 * Replace all frak-links with frak-button-share
 */
function replaceFrakLinks() {
    const frakLinks = document.querySelectorAll("a.frak-link");
    for (const link of Array.from(frakLinks)) {
        const buttonShare = document.createElement("frak-button-share");
        buttonShare.setAttribute("text", "Partage et gagne");
        buttonShare.setAttribute("classname", "button");
        buttonShare.style.display = "block";
        buttonShare.style.marginTop = "20px";
        link.replaceWith(buttonShare);
    }
}
