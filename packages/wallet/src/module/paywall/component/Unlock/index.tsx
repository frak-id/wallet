"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { AuthFingerprint } from "@/module/authentication/component/Recover";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { Panel } from "@/module/common/component/Panel";
import { AccordionInformation } from "@/module/paywall/component/AccordionInformation";
import { UnlockConfirmation } from "@/module/paywall/component/UnlockConfirmation";
import { UnlockError } from "@/module/paywall/component/UnlockError";
import { UnlockLoading } from "@/module/paywall/component/UnlockLoading";
import { useArticlePrices } from "@/module/paywall/hook/useUnlockArticle";
import { usePaywall } from "@/module/paywall/provider";
import type { PaywallContext } from "@/module/paywall/provider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { BookText } from "lucide-react";
import { formatEther } from "viem";
import styles from "./index.module.css";

export function PaywallUnlock({ context }: { context: PaywallContext }) {
    const { balance } = useWallet();
    const { discard } = usePaywall();
    const { disabled, launchArticleUnlock, uiState } = useArticlePrices({
        context,
    });

    async function action() {
        await launchArticleUnlock();
    }

    return (
        <>
            {!(uiState.success || uiState.already) && (
                <Back onClick={discard} disabled={disabled}>
                    Back to the locked article
                </Back>
            )}

            <Grid>
                <Panel
                    size={"normal"}
                    cover={context.imageUrl}
                    className={styles.unlock__article}
                >
                    <p>
                        <strong>{context.contentTitle}</strong>
                    </p>
                    <p>
                        From: <strong>{context.articleTitle}</strong>
                    </p>
                </Panel>

                <AuthFingerprint
                    icon={
                        (uiState.success || uiState.already) && (
                            <BookText size={100} absoluteStrokeWidth={true} />
                        )
                    }
                    disabled={disabled}
                    action={
                        uiState.success || uiState.already ? undefined : action
                    }
                >
                    <UnlockLoading loading={uiState.loading} />
                    <UnlockError error={uiState.error} />
                    <UnlockConfirmation
                        success={uiState.success}
                        already={uiState.already}
                    />
                </AuthFingerprint>

                <Panel size={"small"}>
                    <AccordionInformation trigger={"Informations"}>
                        <p className={styles.unlock__row}>
                            <span>Current balance</span>
                            <span>{formatFrk(Number(balance))}</span>
                        </p>
                        {!uiState.already?.expireIn && (
                            <p className={styles.unlock__row}>
                                <span>Unlock price</span>
                                <span>
                                    {formatEther(
                                        BigInt(context.price.frkAmount)
                                    )}{" "}
                                    FRK
                                </span>
                            </p>
                        )}
                        {uiState.already?.expireIn && (
                            <p className={styles.unlock__row}>
                                <span>Expire in</span>
                                <span>{uiState.already.expireIn}</span>
                            </p>
                        )}
                        {/*<p className={styles.unlock__row}>
                            <span>Unlock duration</span>
                        </p>*/}
                        {uiState.success?.userOpHash && (
                            <p
                                className={`${styles.unlock__row} ${styles.unlock__information}`}
                            >
                                <span>User op hash</span>
                                <span>
                                    {formatHash(uiState.success?.userOpHash)}
                                </span>
                            </p>
                        )}
                        {uiState.error?.reason && (
                            <p
                                className={`${styles.unlock__information} ${styles["unlock__information--error"]}`}
                            >
                                {uiState.error.reason}
                            </p>
                        )}
                    </AccordionInformation>
                </Panel>
            </Grid>
        </>
    );
}
