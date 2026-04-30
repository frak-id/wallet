import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ConfirmationTooltip } from "@frak-labs/design-system/components/ConfirmationTooltip";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ToastSurface } from "@frak-labs/design-system/components/ToastSurface";
import {
    CalendarIcon,
    CopyIcon,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import {
    useCopyToClipboardWithState,
    useReferralStatus,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { modalStore } from "@/module/stores/modalStore";
import { ReferralPageShell } from "../ReferralPageShell";
import * as styles from "./index.css";

// Toast unmount delay — matches `ConfirmationTooltip`'s 200 ms exit
// animation plus a small buffer so the fade-out plays before React
// unmounts. Shared by the copy-toast and saved-toast lifecycles.
const TOAST_EXIT_MS = 220;
// Saved-toast visible duration before transitioning to `leaving`.
const SAVED_TOAST_VISIBLE_MS = 1700;

export function ShareReferralCodePage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const openModal = modalStore((s) => s.openModal);

    const { data: status } = useReferralStatus();
    const ownedCode = status?.ownedCode ?? null;
    const shouldRedirect = status !== undefined && !ownedCode;

    useEffect(() => {
        if (shouldRedirect) {
            navigate({
                to: "/profile/referral/create",
                replace: true,
            });
        }
    }, [shouldRedirect, navigate]);

    const formattedDate = ownedCode
        ? new Intl.DateTimeFormat(i18n.language, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
          }).format(new Date(ownedCode.createdAt))
        : "";

    const { copied, copy } = useCopyToClipboardWithState();
    // `copied` flips back to false after the hook's internal 2 s timer.
    // We keep the toast mounted long enough for the exit animation to play.
    const [showToast, setShowToast] = useState(false);
    useEffect(() => {
        if (copied) {
            setShowToast(true);
            return;
        }
        if (!showToast) return;
        const timeoutId = window.setTimeout(
            () => setShowToast(false),
            TOAST_EXIT_MS
        );
        return () => window.clearTimeout(timeoutId);
    }, [copied, showToast]);

    // Saved toast — fired by `EditReferralCodeSheet.onSaved` once a new
    // code has replaced the old one.
    const [savedState, setSavedState] = useState<"idle" | "shown" | "leaving">(
        "idle"
    );
    useEffect(() => {
        if (savedState === "idle") return;
        const delay =
            savedState === "shown" ? SAVED_TOAST_VISIBLE_MS : TOAST_EXIT_MS;
        const next = savedState === "shown" ? "leaving" : "idle";
        const timeoutId = window.setTimeout(() => setSavedState(next), delay);
        return () => window.clearTimeout(timeoutId);
    }, [savedState]);

    const handleEdit = () => {
        openModal({
            id: "editReferralCode",
            onSaved: () => setSavedState("shown"),
        });
    };

    const handleCopy = () => {
        if (!ownedCode) return;
        copy(ownedCode.code);
    };

    const handleShare = async () => {
        if (!ownedCode) return;
        const shareText = t("wallet.referral.share.shareText", {
            code: ownedCode.code,
        });
        // Pass `text` only — combining `title` + `text` makes macOS Safari
        // treat them as two share items ("2 Images") with auto-rendered
        // previews instead of a plain text share.
        if (navigator.share) {
            // Swallow rejections (the user dismissing the share sheet
            // throws AbortError); falling through to `copy()` here would
            // re-fire the "copied" toast they didn't ask for.
            await navigator.share({ text: shareText }).catch(() => {});
            return;
        }
        copy(shareText);
    };

    return (
        <ReferralPageShell
            title={t("wallet.referral.create.title")}
            description={t("wallet.referral.create.description")}
        >
            {showToast ? (
                <ToastSurface>
                    <ConfirmationTooltip isLeaving={!copied}>
                        {t("wallet.referral.share.copiedToast")}
                    </ConfirmationTooltip>
                </ToastSurface>
            ) : null}
            {savedState !== "idle" ? (
                <ToastSurface>
                    <ConfirmationTooltip isLeaving={savedState === "leaving"}>
                        {t("wallet.referral.share.savedToast")}
                    </ConfirmationTooltip>
                </ToastSurface>
            ) : null}

            {ownedCode ? (
                <>
                    <Box className={styles.card}>
                        <Box className={styles.row}>
                            <Text
                                as="span"
                                variant="body"
                                weight="medium"
                                className={styles.codeLabel}
                            >
                                {ownedCode.code}
                            </Text>
                            <Box
                                as="button"
                                type="button"
                                aria-label={t("wallet.referral.share.copyCode")}
                                className={styles.copyButton}
                                onClick={handleCopy}
                            >
                                <CopyIcon />
                            </Box>
                        </Box>
                        <Box className={styles.row}>
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                                className={styles.codeLabel}
                            >
                                {t("wallet.referral.share.activeSince")}
                            </Text>
                            <Box className={styles.dateValue}>
                                <CalendarIcon
                                    width={16}
                                    height={16}
                                    className={styles.dateIcon}
                                />
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    weight="medium"
                                >
                                    {formattedDate}
                                </Text>
                            </Box>
                        </Box>
                    </Box>

                    <Stack space="m">
                        <Button
                            type="button"
                            variant="primary"
                            size="large"
                            width="full"
                            onClick={handleShare}
                        >
                            {t("wallet.referral.share.shareCta")}
                            <ShareIcon />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="small"
                            width="full"
                            onClick={handleEdit}
                        >
                            {t("wallet.referral.share.modifyCta")}
                        </Button>
                    </Stack>
                </>
            ) : null}
        </ReferralPageShell>
    );
}
