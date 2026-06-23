import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon } from "@frak-labs/design-system/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { versionKey } from "../../queryKeys/version";
import {
    completeNativeSoftUpdate,
    type NativeUpdateStatus,
    openNativeStore,
    startNativeSoftUpdate,
} from "../../utils/nativeUpdater";
import * as styles from "./index.css";

// Play can wedge in a state where it keeps refusing to (re)launch the flow;
// after this many dead-end taps we bail out to the store listing.
const MAX_SOFT_UPDATE_ATTEMPTS = 2;

type SoftUpdatePromptProps =
    | { mode: "available"; storeVersion?: string; onDismiss: () => void }
    | { mode: "in_progress"; onDismiss: () => void }
    | { mode: "downloaded" };

/**
 * Dismissible banner shown when a soft update is available.
 *
 * `available`    — initial CTA. On tap kicks off the FLEXIBLE flow on
 *                  Android (Play download dialog) or opens the App Store
 *                  on iOS. Banner is dismissible — user can keep using
 *                  the app and we'll re-show on next focus check.
 * `in_progress`  — Android only. Shows download progress while Play
 *                  pulls the update in the background.
 * `downloaded`   — Android only. Final "Restart now" CTA that calls
 *                  `completeUpdate()` to install + relaunch.
 *
 * Layout mirrors the wallet's `ResponsiveModal` confirmation modals
 * (e.g. `DeleteRedemptionConfirmModal`): heading + secondary description
 * up top, full-width stacked actions at the bottom — primary first so the
 * happy-path tap target is closest to the thumb.
 */
export function SoftUpdatePrompt(props: SoftUpdatePromptProps) {
    const { t } = useTranslation();

    if (props.mode === "available") {
        return <AvailableBanner onDismiss={props.onDismiss} t={t} />;
    }

    if (props.mode === "in_progress") {
        return (
            <Card variant="elevated" className={styles.banner}>
                <Box className={styles.body}>
                    <Box className={styles.text}>
                        <Text variant="heading4" weight="semiBold">
                            {t("version.softUpdate.inProgress.title")}
                        </Text>
                    </Box>
                    <div className={styles.progressTrack}>
                        <div className={styles.progressBar} />
                    </div>
                    <Box className={styles.actions}>
                        <Button variant="secondary" onClick={props.onDismiss}>
                            {t("version.softUpdate.dismiss")}
                        </Button>
                    </Box>
                </Box>
            </Card>
        );
    }

    return <DownloadedBanner t={t} />;
}

type Translate = ReturnType<typeof useTranslation>["t"];

/**
 * `useMutation` (vs a local `useState(busy)`) gives us a real `isPending`,
 * isolation from unmount races (the `await` resolves after the gate may
 * have re-rendered), and a uniform retry/error surface across the wallet.
 */
function AvailableBanner({
    onDismiss,
    t,
}: {
    onDismiss: () => void;
    t: Translate;
}) {
    const queryClient = useQueryClient();
    // Consecutive launch failures, so we can escalate to the store listing
    // instead of leaving the user tapping a dead "Update" button.
    const failedStarts = useRef(0);

    // The native flow refused to start/resume (Play already flipped the update
    // out of UPDATE_AVAILABLE, the consent dialog was dismissed, or the bridge
    // threw). Reconcile against Play's real state so the banner stops lying,
    // and after repeated dead-ends fall back to the store.
    const onStartFailed = () => {
        failedStarts.current += 1;
        if (failedStarts.current >= MAX_SOFT_UPDATE_ATTEMPTS) {
            failedStarts.current = 0;
            void openNativeStore();
            return;
        }
        queryClient.invalidateQueries({ queryKey: versionKey.nativeStatus });
    };

    const start = useMutation({
        mutationKey: versionKey.startSoftUpdate,
        mutationFn: startNativeSoftUpdate,
        // Optimistically flip the native-status cache to `in_progress` so
        // the prompt swaps to the progress bar the instant the user taps
        // Update, instead of waiting for Play Core's first DOWNLOADING
        // event (which can lag several seconds, or never arrive if the user
        // dismisses the FLEXIBLE consent dialog). Real progress / completion
        // / cancellation lands afterwards via `listenToNativeUpdateStatus`,
        // and the `refetchInterval` safety net in `useVersionGate` recovers
        // the cache if neither channel reports back.
        onSuccess: (started) => {
            if (!started) {
                onStartFailed();
                return;
            }
            failedStarts.current = 0;
            queryClient.setQueryData<NativeUpdateStatus>(
                versionKey.nativeStatus,
                (previous) => ({
                    status: "in_progress",
                    currentVersion:
                        previous && "currentVersion" in previous
                            ? previous.currentVersion
                            : "",
                    bytesDownloaded: 0,
                    totalBytes: 0,
                })
            );
        },
        // A thrown invoke error is at least as bad as `started: false` —
        // recover the same way so the optimistic state can't get stuck.
        onError: onStartFailed,
    });

    return (
        <Card variant="elevated" className={styles.banner}>
            <Box className={styles.body}>
                <Box className={styles.text}>
                    <Text variant="heading4" weight="semiBold">
                        {t("version.softUpdate.available.title")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("version.softUpdate.available.description")}
                    </Text>
                </Box>
                <Box className={styles.actions}>
                    <Button
                        onClick={() => start.mutate()}
                        disabled={start.isPending}
                    >
                        {t("version.softUpdate.available.cta")}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={onDismiss}
                        disabled={start.isPending}
                    >
                        {t("version.softUpdate.dismiss")}
                    </Button>
                </Box>
            </Box>
        </Card>
    );
}

function DownloadedBanner({ t }: { t: Translate }) {
    const queryClient = useQueryClient();
    const complete = useMutation({
        mutationKey: versionKey.completeSoftUpdate,
        mutationFn: completeNativeSoftUpdate,
        // `completed: false`/error means the install didn't take; reconcile
        // against Play so the user isn't stranded on a dead "Restart now".
        onSuccess: (completed) => {
            if (!completed) {
                queryClient.invalidateQueries({
                    queryKey: versionKey.nativeStatus,
                });
            }
        },
        onError: () => {
            queryClient.invalidateQueries({
                queryKey: versionKey.nativeStatus,
            });
        },
    });

    return (
        <Card variant="elevated" className={styles.banner}>
            <Box className={styles.body}>
                <Box className={styles.successContent}>
                    <IconCircle>
                        <CheckIcon
                            width={24}
                            height={24}
                            className={styles.downloadedIcon}
                        />
                    </IconCircle>
                    <Text variant="heading4" weight="semiBold" align="center">
                        {t("version.softUpdate.downloaded.title")}
                    </Text>
                </Box>
                <Box className={styles.actions}>
                    <Button
                        onClick={() => complete.mutate()}
                        disabled={complete.isPending}
                    >
                        {t("version.softUpdate.downloaded.cta")}
                    </Button>
                </Box>
            </Box>
        </Card>
    );
}
