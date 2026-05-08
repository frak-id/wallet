import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { BellIcon, FaceIdIcon } from "@frak-labs/design-system/icons";
import {
    type NotificationOptInOutcome,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBiometryLabel } from "@/module/biometrics/hooks/useBiometryLabel";
import {
    type BiometricLockTimeout,
    biometricsStore,
    selectBiometricsEnabled,
    selectBiometricsLockTimeout,
    selectIsAvailable,
} from "@/module/biometrics/stores/biometricsStore";
import { authenticateWithBiometrics } from "@/module/biometrics/utils/biometrics";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { notificationAdapter } from "@/module/notification/adapter";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { useUnsubscribeFromPushNotification } from "@/module/notification/hook/useUnsubscribeFromPushNotification";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import * as styles from "./index.css";

function NotificationRow() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { permissionStatus, hasLocalCapability } = useNotificationStatus();
    const { subscribeToPushAsync, isPending: isSubscribePending } =
        useSubscribeToPushNotification();
    const { unsubscribeFromPushAsync, isPending: isUnsubPending } =
        useUnsubscribeFromPushNotification();

    const isNativeApp = IS_TAURI;
    const isDeniedOnWeb = !isNativeApp && permissionStatus === "denied";

    const trackOutcome = (outcome: NotificationOptInOutcome, err?: unknown) => {
        trackEvent("notification_opt_in_resolved", {
            outcome,
            ...(err
                ? { reason: err instanceof Error ? err.message : String(err) }
                : {}),
        });
    };

    const handleNativeToggle = async () => {
        await notificationAdapter.openSettings();
        await queryClient.invalidateQueries({
            queryKey: notificationKey.push.permission,
        });
        trackOutcome("settings_opened");
    };

    const handleWebSubscribe = async () => {
        try {
            await subscribeToPushAsync();
            trackOutcome("settings_subscribed");
        } catch (err) {
            trackOutcome("settings_failed", err);
        }
    };

    const handleWebUnsubscribe = async () => {
        try {
            await unsubscribeFromPushAsync();
            trackOutcome("settings_unsubscribed");
        } catch (err) {
            trackOutcome("settings_failed", err);
        }
    };

    const handleToggle = async (checked: boolean) => {
        if (isNativeApp) return handleNativeToggle();
        if (!checked) return handleWebUnsubscribe();
        if (isDeniedOnWeb) return trackOutcome("settings_blocked");
        return handleWebSubscribe();
    };

    return (
        <InfoCard>
            <InfoRow
                icon={BellIcon}
                label={t("wallet.profile.notificationSettings")}
                action={
                    <Switch
                        checked={hasLocalCapability}
                        disabled={isSubscribePending || isUnsubPending}
                        onCheckedChange={handleToggle}
                    />
                }
            />
            {isDeniedOnWeb ? (
                <Text
                    as="p"
                    variant="caption"
                    color="secondary"
                    className={styles.helperText}
                >
                    {t("wallet.profile.notificationDeniedHelp")}
                </Text>
            ) : null}
        </InfoCard>
    );
}

function BiometricRow() {
    const { t } = useTranslation();
    const biometryLabel = useBiometryLabel();
    const enabled = biometricsStore(selectBiometricsEnabled);
    const lockTimeout = biometricsStore(selectBiometricsLockTimeout);
    const setEnabled = biometricsStore((state) => state.setEnabled);
    const setLockTimeout = biometricsStore((state) => state.setLockTimeout);
    const isAvailable = biometricsStore(selectIsAvailable);

    if (!IS_TAURI || !isAvailable) {
        return null;
    }

    const handleToggle = async (checked: boolean) => {
        if (!checked) {
            setEnabled(false);
            return;
        }

        const result = await authenticateWithBiometrics({
            reason: t("biometrics.settings.enable"),
        });

        if (result.success) {
            setEnabled(true);
        }
    };

    const handleTimeoutChange = (value: string) => {
        setLockTimeout(value as BiometricLockTimeout);
    };

    return (
        <InfoCard>
            <InfoRow
                icon={FaceIdIcon}
                align="top"
                label={t("wallet.profile.biometricPrompt", {
                    defaultValue:
                        "Require {{biometryLabel}} at every app launch",
                    biometryLabel,
                })}
                action={
                    <Switch checked={enabled} onCheckedChange={handleToggle} />
                }
            />
            {enabled ? (
                <InfoRow
                    icon={ShieldCheck}
                    label={t("biometrics.settings.timeout")}
                    action={
                        <Select
                            value={lockTimeout}
                            onValueChange={handleTimeoutChange}
                        >
                            <SelectTrigger className={styles.selectTrigger}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="immediate">
                                    {t("biometrics.settings.timeoutImmediate")}
                                </SelectItem>
                                <SelectItem value="1min">
                                    {t("biometrics.settings.timeout1min")}
                                </SelectItem>
                                <SelectItem value="5min">
                                    {t("biometrics.settings.timeout5min")}
                                </SelectItem>
                                <SelectItem value="15min">
                                    {t("biometrics.settings.timeout15min")}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    }
                />
            ) : null}
        </InfoCard>
    );
}

export function ProfilePreferencesCard() {
    const isNotificationSupported = notificationAdapter.isSupported();
    const isBiometricsAvailable = biometricsStore(selectIsAvailable);

    return (
        <>
            {isNotificationSupported && <NotificationRow />}
            {isBiometricsAvailable && <BiometricRow />}
        </>
    );
}
