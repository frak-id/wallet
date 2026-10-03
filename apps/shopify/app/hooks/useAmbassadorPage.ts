import type { action as ambassadorAction } from "app/routes/app.ambassador";
import {
    type AmbassadorPageActionResult,
    type AmbassadorPageIntent,
    scopesForIntent,
} from "app/utils/ambassadorPage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";
import { useOptionalScopes } from "./useOptionalScopes";

const AMBASSADOR_FETCHER_KEY = "ambassador-page";

const SUCCESS_TOAST: Record<AmbassadorPageIntent, string> = {
    publish: "ambassadorPage.toast.published",
    switch: "ambassadorPage.toast.switched",
    hide: "ambassadorPage.toast.hidden",
    addToMenu: "ambassadorPage.toast.menuAdded",
};

export type AmbassadorPageToast = { key: string; isError: boolean };

/** The toast an action result shows; warnings are left to the screen. */
export function ambassadorResultToast(
    result: AmbassadorPageActionResult
): AmbassadorPageToast {
    if (!result.ok) {
        return {
            key:
                result.error === "scopeMissing"
                    ? "ambassadorPage.toast.permissionNeeded"
                    : "ambassadorPage.toast.failed",
            isError: true,
        };
    }
    if (result.menu === "failed") {
        return { key: "ambassadorPage.toast.menuFailed", isError: false };
    }
    return { key: SUCCESS_TOAST[result.intent], isError: false };
}

/**
 * Runs the ambassador page actions behind their Shopify permission prompt.
 * Mount it once per screen, or every toast fires twice.
 */
export function useAmbassadorPage() {
    const { t, i18n } = useTranslation();
    const { ensureScopes } = useOptionalScopes();
    const fetcher = useFetcher<typeof ambassadorAction>({
        key: AMBASSADOR_FETCHER_KEY,
    });
    const { submit } = fetcher;
    // The ref blocks a same-tick second click; the state only re-renders.
    const runningRef = useRef(false);
    const [busyIntent, setBusyIntent] = useState<AmbassadorPageIntent | null>(
        null
    );
    const result = fetcher.data;
    const toastedRef = useRef<AmbassadorPageActionResult | undefined>(
        undefined
    );

    useEffect(() => {
        if (!result || toastedRef.current === result) return;
        toastedRef.current = result;
        const { key, isError } = ambassadorResultToast(result);
        shopify.toast.show(t(key), { isError });
    }, [result, t]);

    const run = useCallback(
        async (
            intent: AmbassadorPageIntent,
            { addToMenu = false }: { addToMenu?: boolean } = {}
        ) => {
            if (runningRef.current) return;
            runningRef.current = true;
            setBusyIntent(intent);
            try {
                const granted = await ensureScopes(
                    scopesForIntent(intent, { addToMenu })
                );
                if (!granted) {
                    shopify.toast.show(
                        t("ambassadorPage.toast.permissionNeeded"),
                        { isError: true }
                    );
                    return;
                }
                await submit(
                    {
                        intent,
                        addToMenu: addToMenu ? "true" : "false",
                        language: i18n.language,
                    },
                    { method: "POST", action: "/app/ambassador" }
                );
            } finally {
                runningRef.current = false;
                setBusyIntent(null);
            }
        },
        [ensureScopes, submit, t, i18n.language]
    );

    return {
        run,
        busyIntent,
        isBusy: busyIntent !== null || fetcher.state !== "idle",
        result,
    };
}

export type AmbassadorPageActions = ReturnType<typeof useAmbassadorPage>;
