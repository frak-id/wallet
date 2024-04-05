"use client";

import { getStartUnlockResponseRedirectUrl } from "@/context/sdk/utils/startUnlock";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { Panel } from "@/module/common/component/Panel";
import { clearPaywallAtom } from "@/module/paywall/atoms/paywall";
import type { PaywallContext } from "@/module/paywall/atoms/paywallContext";
import { isPaywallUnlockActionDisabledAtom } from "@/module/paywall/atoms/unlockUiState";
import { AccordionInformation } from "@/module/paywall/component/AccordionInformation";
import { ArticlePreview } from "@/module/paywall/component/ArticlePreview";
import {
    UnlockConfirmation,
    UnlockError,
    UnlockIdle,
    UnlockLoading,
} from "@/module/paywall/component/Unlock/ButtonInfo";
import {
    InformationBalance,
    InformationError,
    InformationOpHash,
    InformationUnlockPriceOrExpiration,
} from "@/module/paywall/component/Unlock/DetailsInformation";
import { usePaywallRedirection } from "@/module/paywall/hook/usePaywallRedirection";
import { useUnlockArticle } from "@/module/paywall/hook/useUnlockArticle";
import { useFrkBalance } from "@/module/wallet/hook/useFrkBalance";
import { useAtomValue, useSetAtom } from "jotai/index";
import { BookText } from "lucide-react";
import { useCallback, useMemo } from "react";
import styles from "./index.module.css";

export function PaywallUnlock({ context }: { context: PaywallContext }) {
    const { balance } = useFrkBalance();
    const redirect = usePaywallRedirection();
    const { launchArticleUnlock, uiState } = useUnlockArticle({
        context,
    });

    const clearPaywall = useSetAtom(clearPaywallAtom);
    const isDisabled = useAtomValue(isPaywallUnlockActionDisabledAtom);

    /**
     * The main action to do when the user click on the main button
     */
    const mainAction = useCallback(async () => {
        if (uiState.success || uiState.already) {
            redirect({ redirectUrl: context.redirectUrl });
        } else {
            await launchArticleUnlock();
        }
    }, [
        uiState.success,
        uiState.already,
        context,
        launchArticleUnlock,
        redirect,
    ]);

    /**
     * The main action to do when the user click on the main button
     */
    const discardAction = useCallback(async () => {
        // Build the redirection url
        const unlockResponseUrl = await getStartUnlockResponseRedirectUrl({
            redirectUrl: context.redirectUrl,
            response: {
                key: "cancelled",
                status: "locked",
                reason: "User discarded the unlock request",
            },
        });

        // Clear the current paywall context
        clearPaywall();

        // And go to the redirect url
        redirect({ redirectUrl: unlockResponseUrl });
    }, [clearPaywall, redirect, context]);

    /**
     * The expiration date if already unlocked
     */
    const alreadyUnlockedExpirationDate = useMemo(
        () => uiState.already?.expireIn,
        [uiState.already]
    );

    return (
        <>
            {!(uiState.success || uiState.already) && (
                <Back onClick={discardAction} disabled={isDisabled}>
                    Back to the locked article
                </Back>
            )}

            <Grid>
                <ArticlePreview />

                <AuthFingerprint
                    icon={
                        (uiState.success || uiState.already) && (
                            <BookText size={100} absoluteStrokeWidth={true} />
                        )
                    }
                    disabled={isDisabled}
                    action={mainAction}
                    className={styles.unlock__fingerprints}
                >
                    <UnlockIdle idle={uiState.idle} />
                    <UnlockLoading loading={uiState.loading} />
                    <UnlockError error={uiState.error} />
                    <UnlockConfirmation
                        success={uiState.success}
                        already={uiState.already}
                    />
                </AuthFingerprint>

                <Panel size={"small"}>
                    <AccordionInformation trigger={"Informations"}>
                        <InformationBalance balance={balance} />
                        <InformationUnlockPriceOrExpiration
                            price={context.price.frkAmount}
                            alreadyUnlockedExpiration={
                                alreadyUnlockedExpirationDate
                            }
                        />
                        {/*<p className={styles.unlock__row}>
                            <span>Unlock duration</span>
                        </p>*/}
                        <InformationOpHash
                            userOpHash={uiState.success?.userOpHash}
                        />
                        <InformationError reason={uiState.error?.reason} />
                    </AccordionInformation>
                </Panel>
            </Grid>
        </>
    );
}
