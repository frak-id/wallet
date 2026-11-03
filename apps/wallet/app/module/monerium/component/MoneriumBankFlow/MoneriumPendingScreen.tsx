import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { useMoneriumStatusRefresh } from "@/module/monerium/hooks/useMoneriumStatus";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumPendingScreenProps = {
    onClose: () => void;
    /**
     * - `"verification"` Monerium is reviewing the identity; offers a push opt-in
     * - `"linking"`      Monerium is registering the wallet link
     */
    variant: "verification" | "linking";
};

function PushOptIn() {
    const { t } = useTranslation();
    const { permissionStatus, permissionGranted, hasBackendToken, isReady } =
        useNotificationStatus();
    const { subscribeToPush, isPending } = useSubscribeToPushNotification();

    const pushEnabled = permissionGranted && hasBackendToken;
    if (!isReady || pushEnabled || permissionStatus === "denied") return null;

    return (
        <Card variant="elevated">
            <Stack space="s">
                <Text variant="body" weight="medium">
                    {t("monerium.bankFlow.verification.pushTitle")}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {t("monerium.bankFlow.verification.pushDescription")}
                </Text>
                <Button
                    variant="secondary"
                    size="small"
                    width="auto"
                    loading={isPending}
                    onClick={() => subscribeToPush()}
                >
                    {t("monerium.bankFlow.verification.pushCta")}
                </Button>
            </Stack>
        </Card>
    );
}

/** Waiting screens: there are no Monerium webhooks, so "Check again" asks for a fresh status. */
export function MoneriumPendingScreen({
    onClose,
    variant,
}: MoneriumPendingScreenProps) {
    const { t } = useTranslation();
    const { refresh, isRefreshing, refreshError } = useMoneriumStatusRefresh();

    return (
        <MoneriumScreen
            onClose={onClose}
            title={t(`monerium.bankFlow.${variant}.title`)}
            description={t(`monerium.bankFlow.${variant}.description`)}
            error={refreshError}
            ctaLabel={t(`monerium.bankFlow.${variant}.checkAgain`)}
            ctaOnClick={refresh}
            ctaLoading={isRefreshing}
        >
            {variant === "verification" ? <PushOptIn /> : null}
        </MoneriumScreen>
    );
}
