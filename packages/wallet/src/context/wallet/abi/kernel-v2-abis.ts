//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// InteractionSessionValidator
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const interactionSessionValidatorAbi = [
    {
        type: 'constructor',
        inputs: [
            {
                name: '_interactionManager',
                internalType: 'contract ContentInteractionManager',
                type: 'address',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
        name: 'disable',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [],
        name: 'eip712Domain',
        outputs: [
            { name: 'fields', internalType: 'bytes1', type: 'bytes1' },
            { name: 'name', internalType: 'string', type: 'string' },
            { name: 'version', internalType: 'string', type: 'string' },
            { name: 'chainId', internalType: 'uint256', type: 'uint256' },
            { name: 'verifyingContract', internalType: 'address', type: 'address' },
            { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
            { name: 'extensions', internalType: 'uint256[]', type: 'uint256[]' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [{ name: '_data', internalType: 'bytes', type: 'bytes' }],
        name: 'enable',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [{ name: '_wallet', internalType: 'address', type: 'address' }],
        name: 'getCurrentSession',
        outputs: [
            {
                name: '',
                internalType: 'struct InteractionSessionValidatorStorage',
                type: 'tuple',
                components: [
                    { name: 'sessionStart', internalType: 'uint48', type: 'uint48' },
                    { name: 'sessionEnd', internalType: 'uint48', type: 'uint48' },
                    {
                        name: 'sessionValidator',
                        internalType: 'address',
                        type: 'address',
                    },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [],
        name: 'getDomainSeparator',
        outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [
            { name: '', internalType: 'address', type: 'address' },
            { name: '', internalType: 'bytes', type: 'bytes' },
        ],
        name: 'validCaller',
        outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        inputs: [
            { name: '', internalType: 'bytes32', type: 'bytes32' },
            { name: '', internalType: 'bytes', type: 'bytes' },
        ],
        name: 'validateSignature',
        outputs: [{ name: '', internalType: 'ValidationData', type: 'uint256' }],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        inputs: [
            {
                name: '_userOp',
                internalType: 'struct UserOperation',
                type: 'tuple',
                components: [
                    { name: 'sender', internalType: 'address', type: 'address' },
                    { name: 'nonce', internalType: 'uint256', type: 'uint256' },
                    { name: 'initCode', internalType: 'bytes', type: 'bytes' },
                    { name: 'callData', internalType: 'bytes', type: 'bytes' },
                    { name: 'callGasLimit', internalType: 'uint256', type: 'uint256' },
                    {
                        name: 'verificationGasLimit',
                        internalType: 'uint256',
                        type: 'uint256',
                    },
                    {
                        name: 'preVerificationGas',
                        internalType: 'uint256',
                        type: 'uint256',
                    },
                    { name: 'maxFeePerGas', internalType: 'uint256', type: 'uint256' },
                    {
                        name: 'maxPriorityFeePerGas',
                        internalType: 'uint256',
                        type: 'uint256',
                    },
                    { name: 'paymasterAndData', internalType: 'bytes', type: 'bytes' },
                    { name: 'signature', internalType: 'bytes', type: 'bytes' },
                ],
            },
            { name: '_userOpHash', internalType: 'bytes32', type: 'bytes32' },
            { name: '', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'validateUserOp',
        outputs: [{ name: '', internalType: 'ValidationData', type: 'uint256' }],
        stateMutability: 'payable',
    },
    {
        type: 'event',
        anonymous: false,
        inputs: [
            {
                name: 'wallet',
                internalType: 'address',
                type: 'address',
                indexed: true,
            },
            {
                name: 'sessionValidator',
                internalType: 'address',
                type: 'address',
                indexed: false,
            },
            {
                name: 'sessionStart',
                internalType: 'uint256',
                type: 'uint256',
                indexed: false,
            },
            {
                name: 'sessionEnd',
                internalType: 'uint256',
                type: 'uint256',
                indexed: false,
            },
        ],
        name: 'InteractionSessionEnabled',
    },
    { type: 'error', inputs: [], name: 'InvalidEnableParams' },
    { type: 'error', inputs: [], name: 'NotImplemented' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MultiWebAuthNRecoveryAction
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const multiWebAuthNRecoveryActionAbi = [
    {
        type: 'constructor',
        inputs: [
            { name: '_webAuthNValidator', internalType: 'address', type: 'address' },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [
            { name: 'authenticatorId', internalType: 'bytes32', type: 'bytes32' },
            { name: 'x', internalType: 'uint256', type: 'uint256' },
            { name: 'y', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'doAddPasskey',
        outputs: [],
        stateMutability: 'nonpayable',
    },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MultiWebAuthNValidatorV2
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const multiWebAuthNValidatorV2Abi = [
    {
        type: 'constructor',
        inputs: [
            { name: '_p256Verifier', internalType: 'address', type: 'address' },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [
            { name: 'authenticatorId', internalType: 'bytes32', type: 'bytes32' },
            { name: 'x', internalType: 'uint256', type: 'uint256' },
            { name: 'y', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'addPassKey',
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
        name: 'disable',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [{ name: '_data', internalType: 'bytes', type: 'bytes' }],
        name: 'enable',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [
            { name: '_smartWallet', internalType: 'address', type: 'address' },
        ],
        name: 'getPasskey',
        outputs: [
            { name: '', internalType: 'bytes32', type: 'bytes32' },
            {
                name: '',
                internalType: 'struct WebAuthNPubKey',
                type: 'tuple',
                components: [
                    { name: 'x', internalType: 'uint256', type: 'uint256' },
                    { name: 'y', internalType: 'uint256', type: 'uint256' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [
            { name: '_smartWallet', internalType: 'address', type: 'address' },
            { name: '_authenticatorId', internalType: 'bytes32', type: 'bytes32' },
        ],
        name: 'getPasskey',
        outputs: [
            { name: '', internalType: 'bytes32', type: 'bytes32' },
            {
                name: '',
                internalType: 'struct WebAuthNPubKey',
                type: 'tuple',
                components: [
                    { name: 'x', internalType: 'uint256', type: 'uint256' },
                    { name: 'y', internalType: 'uint256', type: 'uint256' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [
            { name: 'authenticatorId', internalType: 'bytes32', type: 'bytes32' },
        ],
        name: 'removePassKey',
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [
            { name: 'authenticatorId', internalType: 'bytes32', type: 'bytes32' },
        ],
        name: 'setPrimaryPassKey',
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [
            { name: '', internalType: 'address', type: 'address' },
            { name: '', internalType: 'bytes', type: 'bytes' },
        ],
        name: 'validCaller',
        outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        inputs: [
            { name: '_hash', internalType: 'bytes32', type: 'bytes32' },
            { name: '_data', internalType: 'bytes', type: 'bytes' },
        ],
        name: 'validateSignature',
        outputs: [{ name: '', internalType: 'ValidationData', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [
            {
                name: '_userOp',
                internalType: 'struct UserOperation',
                type: 'tuple',
                components: [
                    { name: 'sender', internalType: 'address', type: 'address' },
                    { name: 'nonce', internalType: 'uint256', type: 'uint256' },
                    { name: 'initCode', internalType: 'bytes', type: 'bytes' },
                    { name: 'callData', internalType: 'bytes', type: 'bytes' },
                    { name: 'callGasLimit', internalType: 'uint256', type: 'uint256' },
                    {
                        name: 'verificationGasLimit',
                        internalType: 'uint256',
                        type: 'uint256',
                    },
                    {
                        name: 'preVerificationGas',
                        internalType: 'uint256',
                        type: 'uint256',
                    },
                    { name: 'maxFeePerGas', internalType: 'uint256', type: 'uint256' },
                    {
                        name: 'maxPriorityFeePerGas',
                        internalType: 'uint256',
                        type: 'uint256',
                    },
                    { name: 'paymasterAndData', internalType: 'bytes', type: 'bytes' },
                    { name: 'signature', internalType: 'bytes', type: 'bytes' },
                ],
            },
            { name: '_userOpHash', internalType: 'bytes32', type: 'bytes32' },
            { name: '', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'validateUserOp',
        outputs: [{ name: '', internalType: 'ValidationData', type: 'uint256' }],
        stateMutability: 'payable',
    },
    {
        type: 'event',
        anonymous: false,
        inputs: [
            {
                name: 'smartAccount',
                internalType: 'address',
                type: 'address',
                indexed: true,
            },
            {
                name: 'authenticatorIdHash',
                internalType: 'bytes32',
                type: 'bytes32',
                indexed: true,
            },
        ],
        name: 'PrimaryPassKeyChanged',
    },
    {
        type: 'event',
        anonymous: false,
        inputs: [
            {
                name: 'smartAccount',
                internalType: 'address',
                type: 'address',
                indexed: true,
            },
            {
                name: 'authenticatorIdHash',
                internalType: 'bytes32',
                type: 'bytes32',
                indexed: true,
            },
            { name: 'x', internalType: 'uint256', type: 'uint256', indexed: false },
            { name: 'y', internalType: 'uint256', type: 'uint256', indexed: false },
        ],
        name: 'WebAuthnPublicKeyAdded',
    },
    {
        type: 'event',
        anonymous: false,
        inputs: [
            {
                name: 'smartAccount',
                internalType: 'address',
                type: 'address',
                indexed: true,
            },
            {
                name: 'authenticatorIdHash',
                internalType: 'bytes32',
                type: 'bytes32',
                indexed: true,
            },
        ],
        name: 'WebAuthnPublicKeyRemoved',
    },
    {
        type: 'error',
        inputs: [
            { name: 'smartAccount', internalType: 'address', type: 'address' },
            { name: 'authenticatorIdHash', internalType: 'bytes32', type: 'bytes32' },
        ],
        name: 'CantRemoveMainPasskey',
    },
    {
        type: 'error',
        inputs: [
            { name: 'x', internalType: 'uint256', type: 'uint256' },
            { name: 'y', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'InvalidInitData',
    },
    { type: 'error', inputs: [], name: 'InvalidWebAuthNData' },
    { type: 'error', inputs: [], name: 'NotImplemented' },
    {
        type: 'error',
        inputs: [
            { name: 'smartAccount', internalType: 'address', type: 'address' },
        ],
        name: 'NotInitialized',
    },
    {
        type: 'error',
        inputs: [
            { name: 'smartAccount', internalType: 'address', type: 'address' },
            { name: 'authenticatorIdHash', internalType: 'bytes32', type: 'bytes32' },
        ],
        name: 'PassKeyAlreadyExist',
    },
    {
        type: 'error',
        inputs: [
            { name: 'smartAccount', internalType: 'address', type: 'address' },
            { name: 'authenticatorIdHash', internalType: 'bytes32', type: 'bytes32' },
        ],
        name: 'PassKeyDontExist',
    },
] as const
