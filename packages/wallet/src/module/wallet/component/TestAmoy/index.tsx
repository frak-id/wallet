"use client";

import { addresses } from "@/context/common/blockchain/addresses";
import {
    alchemyClient,
    pimlicoBundlerTransport,
    pimlicoPaymasterClient, rpcTransport,
    viemClient,
} from "@/context/common/blockchain/provider";
import { deleteSession } from "@/context/session/action/session";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { LogOut } from "lucide-react";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient, sendUserOperation,
} from "permissionless";
import { signerToEcdsaKernelSmartAccount } from "permissionless/accounts";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { useCallback } from "react";
import {type Hex, encodeAbiParameters, encodeFunctionData, toHex} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { useWriteContract } from "wagmi";
import {
    getRundlerFeePerGas,
    requestGasAndPaymasterAndData
} from "@/context/common/blockchain/viemActions/requestGasAndPaymasterAndData";
import type {AlchemyRpcSchema} from "@/context/common/blockchain/viemActions/AlchemyTypes";

const mintFreeFraktionAbi = [
    {
        stateMutability: "nonpayable",
        type: "function",
        inputs: [{ name: "id", internalType: "FraktionId", type: "uint256" }],
        name: "mintFreeFraktion",
        outputs: [],
    },
] as const;

const txData = encodeFunctionData({
    abi: mintFreeFraktionAbi,
    functionName: "mintFreeFraktion",
    args: [BigInt("0x022")],
});

export function TestAmoy() {
    // Test via ecdsa amd alchemy
    const testAlchemyTxViaEcdsa = useCallback(async () => {
        // Testing simple tx via amoy
        const privateKey: Hex = "0xdcd86c4e913341ee8ff823b18009b8480e1020c95ef52499634d95793737c39b";
        // Generate the ecdsa account
        const smartWallet = await signerToEcdsaKernelSmartAccount(viemClient, {
            signer: privateKeyToAccount(privateKey),
            entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
            factoryAddress: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
            accountLogicAddress: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
            ecdsaValidatorAddress: "0xd9AB5096a832b9ce79914329DAEE236f8Eea0390",
        });

        console.log("Account from private key", {
            accountAddr: smartWallet.address,
            initCode: await smartWallet.getInitCode(),
            smartWallet,
            privateKey,
        });

        const smartAccountClient = createSmartAccountClient({
            account: smartWallet,
            entryPoint: ENTRYPOINT_ADDRESS_V06,
            chain: polygonAmoy,
            bundlerTransport: rpcTransport,
            middleware: {
                gasPrice: async () => {
                    const feesData = await getRundlerFeePerGas(alchemyClient);
                    return {
                        maxFeePerGas: BigInt(feesData),
                        maxPriorityFeePerGas: BigInt(feesData),
                    }
                },
                sponsorUserOperation: async ({entryPoint, userOperation}) => {
                    console.log("Sponsoring user operation request", {entryPoint, userOperation})
                    // Get the stuff from alchemy
                    const paymasterData = await requestGasAndPaymasterAndData(alchemyClient, {
                        entryPoint,
                        dummySignature: userOperation.signature,
                        policyId: "7737468b-f03e-40f7-bbfa-503ede63f9d2",
                        userOperation: {
                            sender: userOperation.sender,
                            nonce: toHex(userOperation.nonce),
                            initCode: userOperation.initCode ?? "0x00",
                            callData: userOperation.callData,
                        },
                    });

                    console.log("Paymaster data response", {paymasterData})

                    return {
                        callGasLimit: BigInt(paymasterData.callGasLimit),
                        verificationGasLimit: BigInt(paymasterData.verificationGasLimit),
                        preVerificationGas: BigInt(paymasterData.preVerificationGas),
                        paymasterAndData: paymasterData.paymasterAndData,
                    };
                }
            },
        });

        const feesData = await getRundlerFeePerGas(alchemyClient);

        const callData = await smartWallet.encodeCallData({
            to: addresses.minter,
            value: 0n,
            data: txData,
        });

        /*await sendUserOperation(alchemyClient, {
            entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
            userOperation: {
                sender: smartWallet.address,
                nonce: 0n,
                initCode: await smartWallet.getInitCode(),
                callData: await smartWallet.encodeCallData({
                    to: addresses.minter,
                    value: 0n,
                    data: txData,
                }),
                callGasLimit: 0n,
                verificationGasLimit: 0n,
                preVerificationGas: 0n,
                maxFeePerGas: BigInt(feesData),
                maxPriorityFeePerGas: 0n,
                paymasterAndData: "0x",
                signature: "0x",
            },

        })*/

        // Send a test tx
        const txHash = await smartAccountClient.sendTransaction({
            to: addresses.minter,
            value: 0n,
            data: txData,
        });
        console.log("Tx hash", { txHash });
    }, []);

    // Test via ecdsa amd alchemy
    const testTxViaEcdsa = useCallback(async () => {
        // Testing simple tx via amoy
        const privateKey: Hex = "0xdcd86c4e913341ee8ff823b18009b8480e1020c95ef52499634d95793737c39b";
        // Generate the ecdsa account
        const smartWallet = await signerToEcdsaKernelSmartAccount(viemClient, {
            signer: privateKeyToAccount(privateKey),
            entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
            factoryAddress: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
            accountLogicAddress: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
            ecdsaValidatorAddress: "0xd9AB5096a832b9ce79914329DAEE236f8Eea0390",
        });

        console.log("Account from private key", {
            accountAddr: smartWallet.address,
            initCode: await smartWallet.getInitCode(),
            smartWallet,
            privateKey,
        });

        const smartAccountClient = createSmartAccountClient({
            account: smartWallet,
            entryPoint: ENTRYPOINT_ADDRESS_V06,
            chain: polygonAmoy,
            bundlerTransport: rpcTransport,
            middleware: {
                sponsorUserOperation: (args) => sponsorUserOperation(pimlicoPaymasterClient, args),
            }
        });

        // Send a test tx
        const txHash = await smartAccountClient.sendTransaction({
            to: addresses.minter,
            value: 0n,
            data: txData,
        });
        console.log("Tx hash", { txHash });
    }, []);

    // Get the write contract function
    const { writeContractAsync, data: hash, error } = useWriteContract();

    const txViaSmartWallet = useCallback(async () => {
        const txHash = await writeContractAsync({
            address: addresses.minter,
            abi: mintFreeFraktionAbi,
            functionName: "mintFreeFraktion",
            args: [BigInt("0x022")],
        });
        console.log("States", {
            txHash,
            hash,
            error,
        });
    }, [writeContractAsync, error]);

    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple
                size={"small"}
                onClick={async () => {
                    await testAlchemyTxViaEcdsa();
                }}
            >
                <Row>
                    <LogOut size={32} /> Test amoy
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
