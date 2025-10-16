import type { SiweAuthenticateModalStepType } from "@frak-labs/core-sdk";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import { useMemo } from "react";
import { createSiweMessage, type SiweMessage } from "viem/siwe";
import { useAccount, useSignMessage } from "wagmi";
import { TextData } from "@frak-labs/wallet-shared/common/component/TextData";
import { HandleErrors } from "@/module/component/HandleErrors";
import styles from "@/module/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";

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
