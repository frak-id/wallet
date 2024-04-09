import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { userThemeAtom } from "@/module/settings/atoms/theme";
import { RequestGenericModal } from "@/module/wallet-connect/component/ModalRequest/Components";
import styles from "@/module/wallet-connect/component/ModalRequest/index.module.css";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { useChainSpecificSmartWallet } from "@/module/wallet/hook/useChainSpecificSmartWallet";
import { useAtomValue } from "jotai/index";
import { FileSignature } from "lucide-react";
import { useCallback, useMemo } from "react";
import { CodeBlock, tomorrow, tomorrowNightBlue } from "react-code-blocks";
import { type TypedDataDefinition, isAddress } from "viem";

export function SignTypedDataRequestModal({
    args,
    requestedChainId,
    onHandle,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "request" }>;
    requestedChainId: number;
    onHandle: () => void;
}) {
    const { smartWallet } = useChainSpecificSmartWallet({
        chainId: requestedChainId,
    });

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
        () => !(rawTypedDataPayload && smartWallet?.address),
        [rawTypedDataPayload, smartWallet]
    );

    /**
     * Get the approval data
     */
    const getApprovalData = useCallback(() => {
        // Ensure we got everything needed
        if (!(smartWallet?.address && typedDataPayload)) {
            throw new Error("Missing data to sign the message");
        }

        // Sign the message and return the signature as approval data
        return smartWallet.signTypedData(typedDataPayload);
    }, [smartWallet, typedDataPayload]);

    return (
        <RequestGenericModal
            args={args}
            onHandle={onHandle}
            isApproveDisabled={isApproveDisabled}
            getApprovalData={getApprovalData}
            subtitle={"request a signature"}
            successMessage={"Successfully signed the payload"}
        >
            <Panel size={"normal"}>
                <Title icon={<FileSignature />}>Data to sign</Title>
                <TypedDataCodeBlocks typedData={typedDataPayload} />
            </Panel>
        </RequestGenericModal>
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
