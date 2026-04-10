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

// Light DOM base styles for Banner — :where() = specificity 0
export const bannerBaseCss = `
:where(frak-banner) {
    display: block;
}

:where(frak-banner .frak-banner) {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-top: 2px solid #3b82f6;
    border-bottom: 2px solid #3b82f6;
    font-family: inherit;
    line-height: 1.4;
}

:where(frak-banner .frak-banner__fadeIn) {
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

:where(frak-banner .frak-banner__icon) {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: #3b82f6;
}

:where(frak-banner .frak-banner__icon svg) {
    width: 100%;
    height: 100%;
}

:where(frak-banner .frak-banner__content) {
    flex: 1;
    min-width: 0;
}

:where(frak-banner .frak-banner__title) {
    font-weight: 700;
    font-size: 0.875rem;
    margin: 0 0 2px;
}

:where(frak-banner .frak-banner__description) {
    font-size: 0.75rem;
    margin: 0;
    opacity: 0.7;
}

:where(frak-banner .frak-banner__cta) {
    flex-shrink: 0;
    padding: 8px 16px;
    font-weight: 700;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 2px solid #eab308;
    border-radius: 0;
    background: #eab308;
    color: #1e293b;
    cursor: pointer;
    white-space: nowrap;
}

:where(frak-banner .frak-banner__cta:hover) {
    opacity: 0.9;
}
`;
