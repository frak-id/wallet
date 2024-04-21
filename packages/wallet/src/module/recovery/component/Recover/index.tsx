import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { usePerformRecoveryOnChain } from "@/module/recovery/hook/activate/usePerformRecoveryOnChain";
import { useRecoveryLocalAccount } from "@/module/recovery/hook/activate/useRecoveryLocalAccount";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useCallback } from "react";
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
    const { getRecoveryLocalAccountAsync } = useRecoveryLocalAccount();
    const { performRecoveryAsync } = usePerformRecoveryOnChain(
        arbitrumSepolia.id
    );

    const doRecover = useCallback(async () => {
        const file: RecoveryFileContent = {
            initialWallet: {
                address: "0x19999B107570AbC3Ae66b6DE84f90987c8c00294",
                publicKey: {
                    x: "0xb71fd5bbfd98566c4e41d0249b4c797ee0ba06c89caf12d06c3d302440c2a80f",
                    y: "0x036d62743d3e7ea7df7c40cc0767412c20a4cfb0bcca7ff5f671c860ece981ae",
                },
                authenticatorId: "VA8bwe2Z5F7prQNqEmjgUlQ4qvUONyCSA70YXE8ZQPY",
            },
            guardianAddress: "0xd7133260566B6E548ec5DEa682eC8951EBD65218",
            guardianPrivateKeyEncrypted:
                "FhcqkH4vdKZvXSLkWRG0jaaKFv9hWlgl5QhMA71jWUFKblZeVMYhq-Wpghc2uq2ToxAkxVP5ZPIL83xUdLlu4riW0BoydvUS2Dz56xZNLH6t_ftITQQvCPNhqwOeAZ1p8VZ3W7IyjV6uw2ztsUTXcj0v-GxjHd8RanTTIsp2A_UXTvprGOpKZolagwUzM_J2GmFNWfgaUVYnOoVjKgrlXmxIxxryHk_c7x_ODqVEkg",
        };

        // Extract the local account
        const localAccount = await getRecoveryLocalAccountAsync({
            file,
            pass: "achanger",
        });

        // Perform the recovery
        const txHash = await performRecoveryAsync({
            file,
            recoveryAccount: localAccount,
            newWallet: {
                publicKey: {
                    x: "0xb71fd5bbfd98566c4e41d0249b4c797ee0ba06c89caf12d06c3d302440c2a80f",
                    y: "0x036d62743d3e7ea7df7c40cc0767412c20a4cfb0bcca7ff5f671c860ece981ae",
                },
                authenticatorId: "test",
            },
        });

        console.log("recovered tx hash", txHash);
    }, [getRecoveryLocalAccountAsync, performRecoveryAsync]);

    return <ButtonRipple onClick={doRecover}>Recover</ButtonRipple>;
}
