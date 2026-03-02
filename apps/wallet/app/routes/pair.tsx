import { triggerDeepLinkWithFallback } from "@frak-labs/core-sdk";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { pairingStore } from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "./pair.module.css";

type NavigateFn = ReturnType<typeof useNavigate>;

/**
 * Max pairing id length — must match deepLink.ts validation and backend constraint.
 */
const maxIdLength = 128;

/**
 * Time to wait for the native app to open before falling back to web pairing.
 */
export const DEEP_LINK_TIMEOUT_MS = 2500;

/**
 * Validates search parameters for the pair route.
 * Ensures id is a non-empty string within the allowed length.
 */
export function validatePairSearch(search: Record<string, unknown>) {
    const id = search.id;
    if (typeof id !== "string" || id.length === 0 || id.length > maxIdLength) {
        throw new Error("Missing or invalid id parameter");
    }
    return { id };
}

/**
 * Redirect the user to the web-based pairing flow
 */
export function redirectToWebPairing(id: string, navigate: NavigateFn) {
    pairingStore.getState().setPendingPairingId(id);
    navigate({ to: "/pairing", search: { mode: "embedded" }, replace: true });
}

export const Route = createFileRoute("/pair")({
    component: PairTrampolinePage,
    validateSearch: validatePairSearch,
    errorComponent: PairErrorComponent,
});

/**
 * Error component shown when validateSearch fails (missing/invalid id)
 */
function PairErrorComponent() {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <p className={styles.text}>{t("wallet.pairing.error.title")}</p>
        </div>
    );
}

/**
 * PairTrampolinePage
 *
 * Trampoline route: QR code → /pair?id=xxx → deep link → /pairing (web fallback).
 *
 * Flow:
 *  1. QR code points to `/pair?id=xxx`
 *  2. Attempt `frakwallet://pair?id=xxx` deep link (native app)
 *  3. If tab becomes hidden → native app opened, cancel fallback
 *  4. If timeout fires or tab becomes visible again → fall back to `/pairing` web flow
 */
function PairTrampolinePage() {
    const { id } = Route.useSearch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const didRedirect = useRef(false);

    useEffect(() => {
        // If page opened in a background tab, skip deep link and go straight to web
        if (document.hidden) {
            didRedirect.current = true;
            redirectToWebPairing(id, navigate);
            return;
        }

        // Attempt to open the app via deep link (encode id to prevent URL injection)
        triggerDeepLinkWithFallback(
            `frakwallet://pair?id=${encodeURIComponent(id)}`
        );

        // Fallback: redirect to web pairing after timeout
        const timeoutId = setTimeout(() => {
            if (!didRedirect.current) {
                didRedirect.current = true;
                redirectToWebPairing(id, navigate);
            }
        }, DEEP_LINK_TIMEOUT_MS);

        // Track visibility changes — app open makes tab hidden
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // App likely opened — cancel the fallback timer
                clearTimeout(timeoutId);
            } else if (!didRedirect.current) {
                // User returned to browser — proceed to web pairing
                didRedirect.current = true;
                redirectToWebPairing(id, navigate);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [id, navigate]);

    return (
        <div className={styles.container}>
            <Spinner />
            <p className={styles.text}>{t("mobile-sso.waiting")}</p>
        </div>
    );
}
