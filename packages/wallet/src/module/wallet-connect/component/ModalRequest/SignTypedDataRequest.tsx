import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { userThemeAtom } from "@/module/settings/atoms/theme";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/component/EventsWalletConnect";
import {
    WcModal,
    WcModalAction,
    WcModalHeader,
    WcModalRequestContext,
} from "@/module/wallet-connect/component/ModalRequest/index";
import styles from "@/module/wallet-connect/component/ModalRequest/index.module.css";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import { getSdkError } from "@walletconnect/utils";
import { useAtomValue } from "jotai/index";
import { FileSignature } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CodeBlock, tomorrow, tomorrowNightBlue } from "react-code-blocks";
import { type TypedDataDefinition, isAddress } from "viem";

export function SignTypedDataRequestModal({
    args,
    onClose,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "request" }>;
    onClose: () => void;
}) {
    const { smartWallet } = useWallet();
    const { walletConnectInstance } = useWalletConnect();

    const [isOpen, setIsOpen] = useState(true);

    const close = useCallback(() => {
        setIsOpen(false);
        onClose();
    }, [onClose]);

    /**
     * Extract the data used for the signature
     */
    const { rawTypedDataPayload, typedDataPayload } = useMemo(() => {
        const rawParams = args.params.request.params as string[];
        const address = rawParams.find((p) => isAddress(p));

        // Extract the raw typed data definition
        const rawTypedDataPayload = rawParams.find((p) => !isAddress(p));
        if (!rawTypedDataPayload) {
            throw new Error("Unable to decode typed data params");
        }

        // Parse it
        const typedDataPayload: TypedDataDefinition =
            JSON.parse(rawTypedDataPayload);

        return {
            address,
            rawTypedDataPayload,
            typedDataPayload,
        };
    }, [args.params.request.params]);

    /**
     * Check if the approve button should be disabled
     */
    const isApproveDisabled = useMemo(
        () =>
            !(
                rawTypedDataPayload &&
                walletConnectInstance &&
                smartWallet?.address
            ),
        [rawTypedDataPayload, smartWallet, walletConnectInstance]
    );

    /**
     * Mutation to approve the pairing
     * TODO: Error should be displayed to propose to retry
     */
    const {
        mutate: onApprove,
        isPending: isApproving,
        isSuccess: isApproveInSuccess,
        error: approveError,
    } = useMutation({
        mutationKey: [
            "session-sign-typed-data-request",
            args.id,
            smartWallet?.address ?? "no-smart-wallet-address",
            rawTypedDataPayload ?? "no-payload",
        ],
        mutationFn: async () => {
            // Ensure we got everything needed
            if (
                !(
                    walletConnectInstance &&
                    smartWallet?.address &&
                    args.id &&
                    typedDataPayload
                )
            ) {
                return false;
            }

            // Try to sign the message
            const signature = await smartWallet.signTypedData(typedDataPayload);

            // Send the signature
            await walletConnectInstance.respondSessionRequest({
                topic: args.topic,
                response: {
                    id: args.id,
                    jsonrpc: "2.0",
                    result: signature,
                },
            });

            // And close the modal after 3 seconds
            setTimeout(close, 3_000);

            return true;
        },
    });

    /**
     * Mutation when the user rejects the pairing
     */
    const { mutate: onReject, isPending: isRejecting } = useMutation({
        mutationKey: ["session-rejection", args.id],
        onMutate: async () => {
            // Ensure we got everything needed
            if (!(walletConnectInstance && args.id)) {
                return false;
            }

            // Reject the sign proposal
            await walletConnectInstance.respondSessionRequest({
                topic: args.topic,
                response: {
                    id: args.id,
                    jsonrpc: "2.0",
                    error: {
                        // Code indicating a server error
                        code: -32000,
                        message: getSdkError("USER_REJECTED").message,
                    },
                },
            });

            // And close the modal
            close();

            return true;
        },
    });

    useEffect(() => {
        if (approveError) {
            console.error("Wallet connect session sign error", approveError);
        }
    }, [approveError]);

    const isLoading = useMemo(
        () => isRejecting || isApproving,
        [isRejecting, isApproving]
    );

    return (
        <WcModal
            open={isOpen}
            onOpenChange={(value) => {
                if (value === false) {
                    onReject();
                }
            }}
        >
            <WcModalHeader
                metadata={args.session.peer.metadata}
                verifyContext={args.verifyContext}
                subTitle={"request a typed data signature"}
            />

            <WcModalRequestContext
                chain={args.params.chainId}
                protocol={args.session.relay.protocol}
            />

            {/*Format this stuff, maybe small panel for each parts? */}
            <Panel size={"normal"}>
                <Title icon={<FileSignature />}>Data to sign</Title>
                <TypedDataCodeBlocks typedData={typedDataPayload} />
            </Panel>

            {approveError && (
                <p className={`error ${styles.modalPairing__error}`}>
                    {approveError.message}
                </p>
            )}

            {isApproveInSuccess ? (
                <p className={styles.modalPairing__success}>
                    Successfully signed the payload
                </p>
            ) : (
                <WcModalAction
                    isLoading={isLoading}
                    isApproveDisabled={isApproveDisabled}
                    onApprove={onApprove}
                    onReject={onReject}
                />
            )}
        </WcModal>
    );
}

function TypedDataCodeBlocks({
    typedData,
}: { typedData: TypedDataDefinition }) {
    const theme = useAtomValue(userThemeAtom);
    const codeBlockTheme = theme === "dark" ? tomorrowNightBlue : tomorrow;

    return (
        <Accordion
            type={"single"}
            collapsible
            className={styles.modalWc__accordion}
            defaultValue={"domain"}
        >
            <AccordionItem value={"domain"}>
                <AccordionTrigger className={styles.modalWc__accordionTrigger}>
                    Domain
                </AccordionTrigger>
                <AccordionContent>
                    <CodeBlock
                        showLineNumbers={false}
                        text={JSON.stringify(typedData?.domain ?? {}, null, 2)}
                        theme={codeBlockTheme}
                        language="json"
                    />
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value={"types"}>
                <AccordionTrigger className={styles.modalWc__accordionTrigger}>
                    Types
                </AccordionTrigger>
                <AccordionContent>
                    <p>Primary type: {typedData?.primaryType}</p>

                    <CodeBlock
                        showLineNumbers={false}
                        text={JSON.stringify(typedData?.types ?? {}, null, 2)}
                        theme={codeBlockTheme}
                        language="json"
                    />
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value={"message"}>
                <AccordionTrigger className={styles.modalWc__accordionTrigger}>
                    Message
                </AccordionTrigger>
                <AccordionContent>
                    <CodeBlock
                        showLineNumbers={false}
                        text={JSON.stringify(typedData?.message ?? {}, null, 2)}
                        theme={codeBlockTheme}
                        language="json"
                    />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
