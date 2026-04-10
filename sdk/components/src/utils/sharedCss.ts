// Shadow DOM base styles (ButtonWallet)
export const sharedCss = `
:host {
    display: contents;
}

:host([hidden]) {
    display: none;
}

.button:disabled {
    opacity: 0.7;
    cursor: default;
}

.button__fadeIn {
    animation: frak-fadeIn 300ms ease-in;
}

@keyframes frak-fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}
`;

export function buildStyleContent(
    componentCss: string,
    placementCss?: string
): string {
    return placementCss
        ? `${sharedCss}\n${componentCss}\n${placementCss}`
        : `${sharedCss}\n${componentCss}`;
}

// Light DOM base styles (ButtonShare, OpenInAppButton) — :where() = specificity 0
export const lightDomBaseCss = `
:where(frak-button-share, frak-open-in-app) {
    display: contents;
}

:where(frak-button-share .button, frak-open-in-app .button) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

:where(frak-button-share .button:disabled, frak-open-in-app .button:disabled) {
    opacity: 0.7;
    cursor: default;
}

:where(frak-button-share .button__fadeIn, frak-open-in-app .button__fadeIn) {
    animation: frak-fadeIn 300ms ease-in;
}

@keyframes frak-fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}
`;
