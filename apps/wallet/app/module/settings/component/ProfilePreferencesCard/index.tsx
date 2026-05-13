import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { Button } from "@frak-labs/design-system/components/Button";
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
    type NotificationTogglePhase,
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

function trackOutcome(outcome: NotificationOptInOutcome, err?: unknown) {
    trackEvent("notification_opt_in_resolved", {
        outcome,
        ...(err
            ? { reason: err instanceof Error ? err.message : String(err) }
            : {}),
    });
}

function trackPhase(
    phase: NotificationTogglePhase,
    extras: {
        permission?: "granted" | "denied" | "prompt" | "prompt-with-rationale";
        has_local_capability?: boolean;
        checked?: boolean;
        reason?: string;
    } = {}
) {
    trackEvent("notification_toggle_phase", { phase, ...extras });
}

/**
 * Tauri row: a single button whose label/action is driven by the OS-level
 * permission state. The OS panel is the only place the user can flip the
 * switch off, so we delegate "Manage" to `openSettings()` and only use the
 * in-app subscribe mutation when we actually need to surface the native
 * permission prompt (status === "prompt"/"prompt-with-rationale").
 */
function TauriNotificationRow() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { permissionStatus, hasLocalCapability } = useNotificationStatus();
    const { subscribeToPushAsync, isPending: isSubscribePending } =
        useSubscribeToPushNotification();

    const isGranted = permissionStatus === "granted";
    const label = isGranted
        ? t("wallet.profile.manageNotifications")
        : t("wallet.profile.enableNotifications");

    const handleSubscribe = async () => {
        trackPhase("subscribe_start", {
            permission: permissionStatus,
            has_local_capability: hasLocalCapability,
            checked: true,
        });
        try {
            await subscribeToPushAsync();
            trackPhase("subscribe_done", {
                permission: permissionStatus,
                checked: true,
            });
            trackOutcome("settings_subscribed");
        } catch (err) {
            trackPhase("subscribe_failed", {
                permission: permissionStatus,
                checked: true,
                reason: err instanceof Error ? err.message : String(err),
            });
            trackOutcome("settings_failed", err);
        }
    };

    // Used for both "Manage" (granted → tweak OS-level settings) and the
    // denied recovery path (iOS won't re-prompt once denied, so the only
    // way back is the OS panel). Permission/token queries are invalidated
    // on return so `useNotificationStatus` reflects whatever the user did.
    const handleOpenSettings = async () => {
        trackPhase("open_settings_start", {
            permission: permissionStatus,
            has_local_capability: hasLocalCapability,
        });
        try {
            await notificationAdapter.openSettings();
        } catch (err) {
            trackPhase("open_settings_failed", {
                permission: permissionStatus,
                reason: err instanceof Error ? err.message : String(err),
            });
            trackOutcome("settings_failed", err);
            return;
        }
        trackPhase("open_settings_done", { permission: permissionStatus });
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: notificationKey.push.permission,
            }),
            queryClient.invalidateQueries({
                queryKey: notificationKey.push.localToken,
            }),
        ]);
        trackOutcome("settings_opened");
    };

    const handleClick = () => {
        if (isGranted) return handleOpenSettings();
        if (permissionStatus === "denied") return handleOpenSettings();
        return handleSubscribe();
    };

    return (
        <InfoCard>
            <Button
                variant="ghost"
                icon={<BellIcon width={24} height={24} />}
                onClick={handleClick}
                loading={isSubscribePending}
            >
                {label}
            </Button>
        </InfoCard>
    );
}

/**
 * Web row: classic switch. The browser is the single source of truth for
 * permission and there's no OS-side panel outside it, so the in-app toggle
 * directly drives subscribe/unsubscribe.
 */
function WebNotificationRow() {
    const { t } = useTranslation();
    const { permissionStatus, hasLocalCapability } = useNotificationStatus();
    const { subscribeToPushAsync, isPending: isSubscribePending } =
        useSubscribeToPushNotification();
    const { unsubscribeFromPushAsync, isPending: isUnsubPending } =
        useUnsubscribeFromPushNotification();

    const handleUnsubscribe = async () => {
        trackPhase("unsubscribe_start", {
            permission: permissionStatus,
            has_local_capability: hasLocalCapability,
            checked: false,
        });
        try {
            await unsubscribeFromPushAsync();
            trackPhase("unsubscribe_done", {
                permission: permissionStatus,
                checked: false,
            });
            trackOutcome("settings_unsubscribed");
        } catch (err) {
            trackPhase("unsubscribe_failed", {
                permission: permissionStatus,
                checked: false,
                reason: err instanceof Error ? err.message : String(err),
            });
            trackOutcome("settings_failed", err);
        }
    };

    const handleSubscribe = async () => {
        trackPhase("subscribe_start", {
            permission: permissionStatus,
            has_local_capability: hasLocalCapability,
            checked: true,
        });
        try {
            await subscribeToPushAsync();
            trackPhase("subscribe_done", {
                permission: permissionStatus,
                checked: true,
            });
            trackOutcome("settings_subscribed");
        } catch (err) {
            trackPhase("subscribe_failed", {
                permission: permissionStatus,
                checked: true,
                reason: err instanceof Error ? err.message : String(err),
            });
            trackOutcome("settings_failed", err);
        }
    };

    const handleToggle = async (checked: boolean) => {
        trackPhase("tap", {
            permission: permissionStatus,
            has_local_capability: hasLocalCapability,
            checked,
        });
        if (!checked) return handleUnsubscribe();
        if (permissionStatus !== "denied") return handleSubscribe();
        // Browser denied: no OS-side panel to bounce to — surface that the
        // user must unblock in their browser settings.
        trackOutcome("settings_blocked");
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
            {permissionStatus === "denied" ? (
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

function NotificationRow() {
    return IS_TAURI ? <TauriNotificationRow /> : <WebNotificationRow />;
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
