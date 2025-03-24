import { TextData } from "@/module/common/component/TextData";
import { trackEvent } from "@/module/common/utils/trackEvent";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import type { SiweAuthenticateModalStepType } from "@frak-labs/core-sdk";
import { Spinner } from "@shared/module/component/Spinner";
import { prefixModalCss } from "@shared/module/utils/prefixModalCss";
import { useMemo } from "react";
import { type SiweMessage, createSiweMessage } from "viem/siwe";
import { useAccount, useSignMessage } from "wagmi";

/**
 * The component for the siwe authentication step of a modal
 * @param onClose
 * @constructor
 */
export function SiweAuthenticateModalStep({
    params,
    onFinish,
}: {
    params: SiweAuthenticateModalStepType["params"];
    onFinish: (result: SiweAuthenticateModalStepType["returns"]) => void;
}) {
    const { t } = useListenerTranslation();
    const { address, chainId } = useAccount();
    const siweMessage: SiweMessage | undefined = useMemo(() => {
        if (!(address && chainId)) {
            return undefined;
        }
        return {
            ...params.siwe,
            address,
            chainId,
            expirationTime: params?.siwe?.expirationTimeTimestamp
                ? new Date(params.siwe.expirationTimeTimestamp)
                : undefined,
            notBefore: params.siwe.notBeforeTimestamp
                ? new Date(params.siwe.notBeforeTimestamp)
                : undefined,
            issuedAt: new Date(),
        };
    }, [params, address, chainId]);

    const message = useMemo(
        () => (siweMessage ? createSiweMessage(siweMessage) : "undef"),
        [siweMessage]
    );

    const { signMessage, isPending, isError, error } = useSignMessage({
        mutation: {
            // Link success and error hooks
            onSuccess: (signature) =>
                onFinish({
                    signature,
                    message,
                }),
        },
    });

    return (
        <>
            <TextData>
                <p>{siweMessage?.statement}</p>
                <p>Domain: {siweMessage?.domain}</p>
                <p>Uri: {siweMessage?.uri}</p>
            </TextData>

            <div
                className={`${styles.modalListener__buttonsWrapper} ${prefixModalCss("buttons-wrapper")}`}
            >
                <div>
                    <button
                        type={"button"}
                        className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
                        disabled={isPending}
                        onClick={() => {
                            signMessage({
                                message,
                            });
                            trackEvent("cta-authenticate");
                        }}
                    >
                        {isPending && <Spinner />}
                        {t("sdk.modal.siweAuthenticate.primaryAction")}
                    </button>
                </div>
            </div>

            {isError && error && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}
