import type { Address, Hex } from "viem";

/**
 * Custom alchemy rpc methods
 */
export type AlchemyRpcSchema = [
    {
        Method: "alchemy_getTokenBalances";
        Parameters: [address: Address, type: "erc20"];
        ReturnType: GetTokenBalancesRawResponse;
    },
    {
        Method: "alchemy_getTokenMetadata";
        Parameters: [address: Address];
        ReturnType: GetTokenBalancesRawResponse;
    },
    {
        Method: "alchemy_requestGasAndPaymasterAndData";
        Parameters: [RequestGasAndPaymasterAndDataRequest];
        ReturnType: {
            paymasterAndData: Hex;
            callGasLimit: Hex;
            verificationGasLimit: Hex;
            preVerificationGas: Hex;
            maxFeePerGas: Hex;
            maxPriorityFeePerGas: Hex;
        };
    },
    {
        Method: "rundler_maxPriorityFeePerGas";
        Parameters: [];
        ReturnType: Hex;
    },
];

/**
 * Raw response of the get token balances method
 */
export type GetTokenBalancesRawResponse = {
    address: Address;
    tokenBalances: {
        contractAddress: Address;
        tokenBalance: Hex;
    }[];
};

/**
 * Raw response of the get token balances method
 */
export type GetTokenMetadataResponse = {
    name: string;
    symbol: string;
    decimals: number;
    logo: string | null;
};

export interface UserOperationRequest {
    /* the origin of the request */
    sender: Address;
    /* nonce (as hex) of the transaction, returned from the entry point for this Address */
    nonce: Hex;
    /* the initCode for creating the sender if it does not exist yet, otherwise "0x" */
    initCode: Hex | "0x00";
    /* the callData passed to the target */
    callData: Hex;
    /* Gas value (as hex) used by inner account execution */
    callGasLimit: Hex;
    /* Actual gas (as hex) used by the validation of this UserOperation */
    verificationGasLimit: Hex;
    /* Gas overhead (as hex) of this UserOperation */
    preVerificationGas: Hex;
    /* Maximum fee per gas (similar to EIP-1559 max_fee_per_gas) (as hex)*/
    maxFeePerGas: Hex;
    /* Maximum priority fee per gas (similar to EIP-1559 max_priority_fee_per_gas) (as hex)*/
    maxPriorityFeePerGas: Hex;
    /* Address of paymaster sponsoring the transaction, followed by extra data to send to the paymaster ("0x" for self-sponsored transaction) */
    paymasterAndData: Hex | "0x00";
    /* Data passed into the account along with the nonce during the verification step */
    signature: Hex;
}

/**
 * Raw response of the get token balances method
 */
export type RequestGasAndPaymasterAndDataRequest = {
    policyId: string;
    entryPoint: Address;
    userOperation: {
        sender: Address;
        nonce: Hex;
        initCode: Hex;
        callData: Hex;
    };
    dummySignature: Hex;
};
