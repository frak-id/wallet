import { usePageScopes } from "app/hooks/usePageScopes";
import type { action as ambassadorPageAction } from "app/routes/app.ambassador-page";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

const AMBASSADOR_FETCHER_KEY = "ambassador-page";

type AmbassadorIntent =
    | "create"
    | "link"
    | "apply"
    | "restore"
    | "keepStandard";

/**
 * Runs the ambassador page actions: page-scope request, keyed fetcher, busy
 * flag and error toasts. Mount it once per screen, or every toast fires twice.
 */
export function useAmbassadorPageAction() {
    const { t, i18n } = useTranslation();
    const { requestPageScopes } = usePageScopes();
    const fetcher = useFetcher<typeof ambassadorPageAction>({
        key: AMBASSADOR_FETCHER_KEY,
    });
    const pendingRef = useRef(false);
    const [pending, setPending] = useState(false);
    const data = fetcher.data;
    const [cleared, setCleared] = useState<typeof data>();
    const failure = data?.ok === false ? data.reason : null;
    // Keeping the standard layout is not a page going live.
    const liveUrl =
        data?.ok && data.intent !== "keepStandard" && data !== cleared
            ? data.url
            : null;
    // The page may have changed since: call it when the merchant comes back.
    const clearLive = useCallback(() => setCleared(data), [data]);
    const liveMessage = t(
        data?.intent === "apply"
            ? "optionalSetup.ambassador.applied"
            : data?.intent === "restore"
              ? "optionalSetup.ambassador.restored"
              : "optionalSetup.ambassador.created"
    );

    // `data` re-runs the toast when the same failure repeats.
    useEffect(() => {
        if (failure && failure !== "noPublishedPage") {
            shopify.toast.show(t(`optionalSetup.ambassador.${failure}`), {
                isError: true,
            });
        }
    }, [failure, data, t]);

    const run = async (intent: AmbassadorIntent, template?: string) => {
        // The ref blocks a same-tick second click; state only re-renders.
        if (pendingRef.current) return;
        pendingRef.current = true;
        setPending(true);
        try {
            if (intent !== "keepStandard" && !(await requestPageScopes())) {
                shopify.toast.show(t("optionalSetup.ambassador.declined"), {
                    isError: true,
                });
                return;
            }
            fetcher.submit(
                {
                    intent,
                    language: i18n.language,
                    ...(template ? { template } : {}),
                },
                { method: "POST", action: "/app/ambassador-page" }
            );
        } finally {
            pendingRef.current = false;
            setPending(false);
        }
    };

    return {
        run,
        isBusy: pending || fetcher.state !== "idle",
        failure,
        liveUrl,
        liveMessage,
        clearLive,
    };
}
