import type { SiweAuthenticateModalStepType } from "@frak-labs/core-sdk";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { HandleErrors, prefixModalCss } from "@frak-labs/wallet-shared/common";
import { useMemo } from "react";
import { createSiweMessage, type SiweMessage } from "viem/siwe";
import { useConnection, useSignMessage } from "wagmi";
import * as styles from "@/module/modal/component/Modal/index.css";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";
import * as authStyles from "./index.css";

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
    const { address, chainId } = useConnection();
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

    const {
        mutate: signMessage,
        isPending,
        isError,
        error,
    } = useSignMessage({
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
            <div className={authStyles.textData}>
                <p>{siweMessage?.statement}</p>
                <p>Domain: {siweMessage?.domain}</p>
                <p>Uri: {siweMessage?.uri}</p>
            </div>

            <div
                className={`${styles.modalListener__buttonsWrapper} ${prefixModalCss("buttons-wrapper")}`}
            >
                <div>
                    <button
                        type={"button"}
                        className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
                        disabled={isPending}
                        onClick={() => {
                            signMessage({ message });
                        }}
                    >
                        {isPending && <Spinner />}
                        {t("sdk.modal.siweAuthenticate.primaryAction")}
                    </button>
                </div>
            </div>

            {isError && error && <HandleErrors error={error} />}
        </>
    );
}
