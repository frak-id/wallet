import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import { useEffect } from "react";
import { useDemoNav } from "@/core/store";
import { useT } from "@/i18n";
import type { PasskeyCreationProps } from "@/surfaces/contracts";
import { BottomSheet } from "../components/BottomSheet";
import { PasskeyPrompt, usePasskeyFlow } from "../components/PasskeyPrompt";
import { WalletReady } from "../components/WalletReady";
import { walletMessages } from "../messages";
import { OnboardingPage } from "../Onboarding";
import * as styles from "../Onboarding/onboarding.css";

/** Lets the wallet's keypass drawer land before the OS sheet covers it. */
const SYSTEM_SHEET_DELAY_MS = 750;

function KeypassContent({
    busy,
    onContinue,
}: {
    busy: boolean;
    onContinue: () => void;
}) {
    const t = useT(walletMessages);
    return (
        <Stack space="l" paddingY="s">
            <Stack space="m" align="center">
                <FaceIdIcon width={48} height={48} />
                <Text as="h1" variant="heading1" align="center">
                    {t("keypass.title")}
                </Text>
                <Text color="secondary" align="center">
                    {t("keypass.description")}
                </Text>
            </Stack>
            <Button onClick={onContinue} loading={busy}>
                {t("keypass.continue")}
            </Button>
        </Stack>
    );
}

/** Onboarding's last step, the keypass drawer, then the iOS passkey sheet. */
export function PasskeyCreation({ persona }: PasskeyCreationProps) {
    const t = useT(walletMessages);
    const { next } = useDemoNav();
    const flow = usePasskeyFlow(next);
    const { open } = flow;

    useEffect(() => {
        const timer = window.setTimeout(open, SYSTEM_SHEET_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [open]);

    return (
        <div className={styles.screen}>
            <OnboardingPage step="three" onContinue={open} />
            <BottomSheet open={true} look="frak" label={t("keypass.title")}>
                {flow.stage === "ready" ? (
                    <WalletReady />
                ) : (
                    <KeypassContent
                        busy={flow.stage !== "idle"}
                        onContinue={open}
                    />
                )}
            </BottomSheet>
            <PasskeyPrompt
                persona={persona}
                stage={flow.stage}
                onContinue={flow.confirm}
            />
        </div>
    );
}
