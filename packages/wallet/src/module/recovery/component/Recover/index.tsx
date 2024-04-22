import {
    type AvailableChainIds,
    availableChains,
} from "@/context/common/blockchain/provider";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useAvailableChainsForRecovery } from "@/module/recovery/hook/useAvailableChainsForRecovery";
import { usePerformRecoveryOnChain } from "@/module/recovery/hook/usePerformRecoveryOnChain";
import { useRecoveryLocalAccount } from "@/module/recovery/hook/useRecoveryLocalAccount";
import type { RecoveryFileContent } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { useCallback, useMemo, useState } from "react";
import { FileUploader } from "react-drag-drop-files";
import { type LocalAccount, extractChain } from "viem";

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
    // Build the target wallet for the migration
    const targetWallet = useMemo(
        () => ({
            ...recoveryFileContent.initialWallet,
            authenticatorId: "test-1",
        }),
        [recoveryFileContent]
    );

    // Get the available chains for recovery
    const { availableChains, isLoading } = useAvailableChainsForRecovery({
        file: recoveryFileContent,
        newAuthenticatorId: targetWallet.authenticatorId,
    });
    const [guardianAccount, setGuardianAccount] =
        useState<LocalAccount<string> | null>(null);

    // Extract the local account from the file
    const { getRecoveryLocalAccountAsync } = useRecoveryLocalAccount();
    useMemo(() => {
        console.log("Loading recovery account", recoveryFileContent);
        if (!recoveryFileContent) {
            return null;
        }
        getRecoveryLocalAccountAsync({
            file: recoveryFileContent,
            pass: "achanger",
        }).then(setGuardianAccount);
    }, [recoveryFileContent, getRecoveryLocalAccountAsync]);

    if (!guardianAccount) {
        return <p>Loading the guardian account</p>;
    }

    if (isLoading) {
        return <p>Loading recovery chains...</p>;
    }

    return (
        <>
            {availableChains?.length === 0 && (
                <p>No available chains for recovery</p>
            )}

            {availableChains?.map(
                ({ chainId, available, alreadyRecovered }) => {
                    if (!available) {
                        return null;
                    }

                    if (alreadyRecovered === true) {
                        return (
                            <p key={`alreadyRecovered-${chainId}`}>
                                Wallet already recovered on chain {chainId}
                            </p>
                        );
                    }

                    return (
                        <TriggerRecoveryForChain
                            key={chainId}
                            recoveryFileContent={recoveryFileContent}
                            guardianAccount={guardianAccount}
                            chainId={chainId}
                            targetWallet={targetWallet}
                        />
                    );
                }
            )}
        </>
    );
}

function TriggerRecoveryForChain({
    recoveryFileContent,
    guardianAccount,
    chainId,
    targetWallet,
}: {
    recoveryFileContent: RecoveryFileContent;
    guardianAccount: LocalAccount<string>;
    chainId: AvailableChainIds;
    targetWallet: Omit<WebAuthNWallet, "address">;
}) {
    const { performRecoveryAsync } = usePerformRecoveryOnChain(chainId);

    const doRecover = useCallback(async () => {
        // Perform the recovery
        const txHash = await performRecoveryAsync({
            file: recoveryFileContent,
            recoveryAccount: guardianAccount,
            newWallet: targetWallet,
        });

        console.log("recovered tx hash", txHash);
    }, [
        performRecoveryAsync,
        recoveryFileContent,
        guardianAccount,
        targetWallet,
    ]);

    const chainName = useMemo(
        () => extractChain({ chains: availableChains, id: chainId }).name,
        [chainId]
    );

    return (
        <ButtonRipple onClick={doRecover}>Recover on {chainName}</ButtonRipple>
    );
}
