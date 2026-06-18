import type { SiweAuthenticateModalStepType } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { HandleErrors, prefixModalCss } from "@frak-labs/wallet-shared/common";
import { useMemo } from "react";
import { createSiweMessage, type SiweMessage } from "viem/siwe";
import { useConnection, useSignMessage } from "wagmi";
import { useListenerTranslation } from "@/ui/ListenerUiProvider";
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

            <Stack space="m" className={prefixModalCss("buttons-wrapper")}>
                {/* Stay visually primary while pending (spinner + click guard)
                 * — the DS disabled state is too low-contrast on the light
                 * modal surface. */}
                <Button
                    variant="primary"
                    size="large"
                    icon={isPending ? <Spinner size="s" /> : undefined}
                    aria-busy={isPending}
                    className={prefixModalCss("button-primary")}
                    onClick={() => {
                        if (isPending) return;
                        signMessage({ message });
                    }}
                >
                    {t("sdk.modal.siweAuthenticate.primaryAction")}
                </Button>
            </Stack>

            {isError && error && (
                <HandleErrors
                    error={error}
                    operation="sign"
                    onRetry={() => signMessage({ message })}
                />
            )}
        </>
    );
}
