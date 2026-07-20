import type { Flow } from "@frak-labs/wallet-shared";
import type { RefObject } from "react";
import { useCallback, useEffect } from "react";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import type {
    FlowStep,
    GoToStep,
} from "@/module/onboarding/hook/useRegisterFlow";

/**
 * Notification opt-in step handlers. Owns the push-subscription side-effect and
 * its `notification_opt_in_resolved` tracking, plus the auto-skip effect that
 * jumps past the step when permission is already granted or denied.
 *
 * All paths resolve to the `welcome` step via the provided `goToStep`.
 */
export function usePushOptIn({
    step,
    flowRef,
    goToStep,
}: {
    step: FlowStep;
    flowRef: RefObject<Flow | null>;
    goToStep: GoToStep;
}) {
    const { permissionStatus, permissionGranted, hasBackendToken } =
        useNotificationStatus();
    const { subscribeToPushAsync } = useSubscribeToPushNotification();

    // Auto-skip notification step if already granted or denied
    useEffect(() => {
        if (
            step !== "notification" ||
            !(
                permissionStatus === "denied" ||
                (permissionGranted && hasBackendToken)
            )
        )
            return;
        flowRef.current?.track("notification_opt_in_resolved", {
            outcome:
                permissionStatus === "denied"
                    ? "auto_skipped_denied"
                    : "auto_skipped_granted",
        });
        goToStep("welcome");
    }, [step, permissionStatus, permissionGranted, hasBackendToken, goToStep]);

    const onEnable = useCallback(() => {
        subscribeToPushAsync()
            .then(() => {
                flowRef.current?.track("notification_opt_in_resolved", {
                    outcome: "enabled",
                });
                goToStep("welcome");
            })
            .catch((err: unknown) => {
                flowRef.current?.track("notification_opt_in_resolved", {
                    outcome: "denied",
                    reason: err instanceof Error ? err.message : String(err),
                });
                goToStep("welcome");
            });
    }, [subscribeToPushAsync, goToStep]);

    const onSkip = useCallback(() => {
        flowRef.current?.track("notification_opt_in_resolved", {
            outcome: "skipped",
        });
        goToStep("welcome");
    }, [goToStep]);

    return { onEnable, onSkip };
}
