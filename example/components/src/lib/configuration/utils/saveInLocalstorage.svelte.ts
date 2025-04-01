import { config } from "../state/config.svelte";
import { cleanObjects } from "./cleanObjects";

function removeLanguageIfAuto(metadata: typeof config.metadata) {
    const { lang, ...rest } = metadata;
    return lang === "auto" ? rest : metadata;
}

function removeCurrencyIfEur(metadata: typeof config.metadata) {
    const { currency, ...rest } = metadata;
    return currency === "eur" ? rest : metadata;
}

function removeDefaultValues(metadata: typeof config.metadata) {
    return removeLanguageIfAuto(removeCurrencyIfEur(metadata));
}

const code = $derived.by(() => {
    return JSON.stringify(
        {
            ...config,
            metadata: cleanObjects(removeDefaultValues(config.metadata)),
            customizations: cleanObjects(config.customizations),
        },
        null,
        2
    );
});

export function getCode() {
    return code;
}

export function saveInLocalstorage() {
    localStorage.setItem("frak-wallet-sdk-config", code);
}
