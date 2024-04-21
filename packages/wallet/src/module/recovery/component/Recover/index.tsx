import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { usePerformRecoveryOnChain } from "@/module/recovery/hook/activate/usePerformRecoveryOnChain";
import { useRecoveryLocalAccount } from "@/module/recovery/hook/activate/useRecoveryLocalAccount";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useCallback, useState } from "react";
import { FileUploader } from "react-drag-drop-files";
import { arbitrumSepolia } from "viem/chains";

/**
 * Recover a wallet component
 * @constructor
 */
export function RecoverWallet() {
    return (
        <Panel>
            <Title>Recover a wallet</Title>
            <PerformRecovery />
        </Panel>
    );
}

function PerformRecovery() {
    const [fileContent, setFileContent] = useState<RecoveryFileContent | null>(
        null
    );

    /**
     * Handle the upload of a file
     */
    const handleChange = useCallback(async (file: File | null) => {
        console.log("recovery file", file);
        if (!file) {
            setFileContent(null);
            return null;
        }
        const fileText = await file.text();
        const fileContent = JSON.parse(fileText) as RecoveryFileContent;
        // Ensure all the fields are presents
        if (
            !(
                fileContent.initialWallet &&
                fileContent.guardianAddress &&
                fileContent.guardianPrivateKeyEncrypted
            )
        ) {
            // Should display a user message
            setFileContent(null);
            throw new Error("Invalid file content");
        }
        // If all good here, should check that the guardian address match the wallet address recovery options
        // A backend actions checking possible recovery chains???
        setFileContent(fileContent);
    }, []);

    return (
        <>
            <FileUploader
                handleChange={handleChange}
                label={"Upload or drag recovery file"}
                types={["json"]}
                disabled={fileContent !== null}
            />
            {fileContent && (
                <TriggerRecovery recoveryFileContent={fileContent} />
            )}
        </>
    );
}

function TriggerRecovery({
    recoveryFileContent,
}: { recoveryFileContent: RecoveryFileContent }) {
    const { getRecoveryLocalAccountAsync } = useRecoveryLocalAccount();
    const { performRecoveryAsync } = usePerformRecoveryOnChain(
        arbitrumSepolia.id
    );

    const doRecover = useCallback(async () => {
        // Extract the local account
        const localAccount = await getRecoveryLocalAccountAsync({
            file: recoveryFileContent,
            pass: "achanger",
        });

        // Perform the recovery
        const txHash = await performRecoveryAsync({
            file: recoveryFileContent,
            recoveryAccount: localAccount,
            newWallet: {
                publicKey: recoveryFileContent.initialWallet.publicKey,
                authenticatorId: "test",
            },
        });

        console.log("recovered tx hash", txHash);
    }, [
        getRecoveryLocalAccountAsync,
        performRecoveryAsync,
        recoveryFileContent,
    ]);

    return <ButtonRipple onClick={doRecover}>Recover</ButtonRipple>;
}
