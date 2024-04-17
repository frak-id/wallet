/**
 * ABI to initialize a KernelV3 account
 */
export const KernelV3InitAbi = [
    {
        type: "function",
        name: "initialize",
        inputs: [
            {
                name: "_rootValidator",
                type: "bytes21",
                internalType: "ValidationId",
            },
            { name: "hook", type: "address", internalType: "contract IHook" },
            { name: "validatorData", type: "bytes", internalType: "bytes" },
            { name: "hookData", type: "bytes", internalType: "bytes" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
] as const;

/**
 * The account creation ABI for a nexus smart account (using kernel v3 under the hood))
 */
export const CreateAccountAbi = [
    {
        inputs: [
            {
                internalType: "address",
                name: "_implementation",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "_data",
                type: "bytes",
            },
            {
                internalType: "uint256",
                name: "_index",
                type: "uint256",
            },
        ],
        name: "createAccount",
        outputs: [
            {
                internalType: "address",
                name: "proxy",
                type: "address",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
] as const;

/**
 * Deploy the kernel smart account with a factory
 */
export const DeployWithFactoryAbi = [
    {
        type: "function",
        name: "deployWithFactory",
        inputs: [
            {
                name: "factory",
                type: "address",
                internalType: "contract KernelFactory",
            },
            { name: "createData", type: "bytes", internalType: "bytes" },
            { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
        outputs: [{ name: "", type: "address", internalType: "address" }],
        stateMutability: "payable",
    },
];

/**
 * Method used to perform kernel execution
 */
export const KernelV3Execute = [
    {
        type: "function",
        name: "execute",
        inputs: [
            { name: "execMode", type: "bytes32", internalType: "ExecMode" },
            { name: "executionCalldata", type: "bytes", internalType: "bytes" },
        ],
        outputs: [],
        stateMutability: "payable",
    },
];
