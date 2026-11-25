import type { action } from "app/routes/app.settings.subscriptions";
import type {
    SubscriptionProvider,
    SubscriptionStatus,
} from "app/services.server/subscriptions";
import {
    connectErrorKey,
    formatErrorDate,
    isTokenSubmittable,
} from "app/utils/subscriptions";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

const ACTION_PATH = "/app/settings/subscriptions";

export function Subscriptions({
    status,
}: {
    status: SubscriptionStatus | null;
}) {
    const { t } = useTranslation();

    if (!status) {
        return (
            <s-banner tone="warning">
                <s-paragraph>{t("subscriptions.unavailable")}</s-paragraph>
            </s-banner>
        );
    }

    return (
        <s-stack gap="base">
            <s-text>{t("subscriptions.description")}</s-text>
            {status.lastError && <LastErrorBanner at={status.lastError.at} />}
            {status.provider && (
                <ConnectedProvider
                    provider={status.provider}
                    tokenRejected={status.lastError !== null}
                />
            )}
            {(!status.provider || status.lastError) && (
                <ConnectForm reconnect={status.provider !== null} />
            )}
        </s-stack>
    );
}

function LastErrorBanner({ at }: { at: string }) {
    const { t, i18n } = useTranslation();
    const date = formatErrorDate(at, i18n.language);

    return (
        <s-banner
            tone="critical"
            heading={t("subscriptions.lastError.heading")}
        >
            <s-paragraph>
                {date
                    ? t("subscriptions.lastError.bodyAt", { date })
                    : t("subscriptions.lastError.body")}
            </s-paragraph>
        </s-banner>
    );
}

function ConnectedProvider({
    provider,
    tokenRejected,
}: {
    provider: SubscriptionProvider;
    tokenRejected: boolean;
}) {
    const { t } = useTranslation();
    const fetcher = useFetcher<typeof action>();
    const busy = fetcher.state !== "idle";

    useEffect(() => {
        if (fetcher.data?.intent !== "disconnectSubscription") return;

        if (fetcher.data.success) {
            window.shopify?.toast.show(
                t("subscriptions.messages.disconnected")
            );
        } else {
            window.shopify?.toast.show(t("subscriptions.errors.disconnect"), {
                isError: true,
            });
        }
    }, [fetcher.data, t]);

    return (
        <s-stack gap="small">
            <s-box paddingBlockStart="small" paddingBlockEnd="small">
                <s-badge tone={tokenRejected ? "warning" : "success"}>
                    {t(
                        tokenRejected
                            ? "subscriptions.connectedTokenRejected"
                            : "subscriptions.connected",
                        {
                            provider: t(`subscriptions.providers.${provider}`),
                        }
                    )}
                </s-badge>
            </s-box>
            <s-button
                variant="primary"
                tone="critical"
                loading={busy}
                disabled={busy}
                onClick={() =>
                    fetcher.submit(
                        { intent: "disconnectSubscription" },
                        { method: "POST", action: ACTION_PATH }
                    )
                }
            >
                {t("subscriptions.actions.disconnect")}
            </s-button>
        </s-stack>
    );
}

function ConnectForm({ reconnect }: { reconnect: boolean }) {
    const { t } = useTranslation();
    const fetcher = useFetcher<typeof action>();
    const [token, setToken] = useState("");
    const busy = fetcher.state !== "idle";

    const outcome =
        fetcher.data?.intent === "connectSubscription"
            ? fetcher.data.result
            : null;

    useEffect(() => {
        if (outcome !== "connected") return;

        setToken("");
        window.shopify?.toast.show(t("subscriptions.messages.connected"));
    }, [outcome, t]);

    const tokenRejected = !busy && outcome === "invalid_token";
    const bannerKey =
        !busy && outcome && outcome !== "invalid_token"
            ? connectErrorKey(outcome)
            : null;

    return (
        <s-stack gap="base">
            <s-password-field
                label={t("subscriptions.fields.token")}
                details={t("subscriptions.fields.tokenDetails")}
                value={token}
                autocomplete="off"
                disabled={busy}
                error={
                    tokenRejected
                        ? t("subscriptions.errors.invalidToken")
                        : undefined
                }
                onInput={(e) => setToken(e.currentTarget.value ?? "")}
            />
            {bannerKey && (
                <s-banner tone="critical">
                    <s-paragraph>{t(bannerKey)}</s-paragraph>
                </s-banner>
            )}
            <s-button
                variant="primary"
                loading={busy}
                disabled={busy || !isTokenSubmittable(token)}
                onClick={() =>
                    fetcher.submit(
                        { intent: "connectSubscription", token },
                        { method: "POST", action: ACTION_PATH }
                    )
                }
            >
                {reconnect
                    ? t("subscriptions.actions.reconnect")
                    : t("subscriptions.actions.connect")}
            </s-button>
        </s-stack>
    );
}
