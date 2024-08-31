//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// InteractionDelegator
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const interactionDelegatorAbi = [
    {
        type: 'constructor',
        inputs: [{ name: '_owner', internalType: 'address', type: 'address' }],
        stateMutability: 'nonpayable',
    },
    { type: 'fallback', stateMutability: 'payable' },
    { type: 'receive', stateMutability: 'payable' },
    {
        type: 'function',
        inputs: [],
        name: 'cancelOwnershipHandover',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [
            { name: 'pendingOwner', internalType: 'address', type: 'address' },
        ],
        name: 'completeOwnershipHandover',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [
            {
                name: '_delegatedInteractions',
                internalType: 'struct InteractionDelegator.DelegatedInteraction[]',
                type: 'tuple[]',
                components: [
                    { name: 'wallet', internalType: 'address', type: 'address' },
                    {
                        name: 'interaction',
                        internalType: 'struct Interaction',
                        type: 'tuple',
                        components: [
                            { name: 'productId', internalType: 'uint256', type: 'uint256' },
                            { name: 'data', internalType: 'bytes', type: 'bytes' },
                        ],
                    },
                ],
            },
        ],
        name: 'execute',
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [
            {
                name: '_delegatedInteractions',
                internalType:
                    'struct InteractionDelegator.DelegatedBatchedInteraction[]',
                type: 'tuple[]',
                components: [
                    { name: 'wallet', internalType: 'address', type: 'address' },
                    {
                        name: 'interactions',
                        internalType: 'struct Interaction[]',
                        type: 'tuple[]',
                        components: [
                            { name: 'productId', internalType: 'uint256', type: 'uint256' },
                            { name: 'data', internalType: 'bytes', type: 'bytes' },
                        ],
                    },
                ],
            },
        ],
        name: 'executeBatched',
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [
            { name: 'user', internalType: 'address', type: 'address' },
            { name: 'roles', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'grantRoles',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [
            { name: 'user', internalType: 'address', type: 'address' },
            { name: 'roles', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'hasAllRoles',
        outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [
            { name: 'user', internalType: 'address', type: 'address' },
            { name: 'roles', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'hasAnyRole',
        outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [],
        name: 'owner',
        outputs: [{ name: 'result', internalType: 'address', type: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [
            { name: 'pendingOwner', internalType: 'address', type: 'address' },
        ],
        name: 'ownershipHandoverExpiresAt',
        outputs: [{ name: 'result', internalType: 'uint256', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [],
        name: 'renounceOwnership',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [{ name: 'roles', internalType: 'uint256', type: 'uint256' }],
        name: 'renounceRoles',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [],
        name: 'requestOwnershipHandover',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [
            { name: 'user', internalType: 'address', type: 'address' },
            { name: 'roles', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'revokeRoles',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
        name: 'rolesOf',
        outputs: [{ name: 'roles', internalType: 'uint256', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
        name: 'transferOwnership',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'event',
        anonymous: false,
        inputs: [
            {
                name: 'pendingOwner',
                internalType: 'address',
                type: 'address',
                indexed: true,
            },
        ],
        name: 'OwnershipHandoverCanceled',
    },
    {
        type: 'event',
        anonymous: false,
        inputs: [
            {
                name: 'pendingOwner',
                internalType: 'address',
                type: 'address',
                indexed: true,
            },
        ],
        name: 'OwnershipHandoverRequested',
    },
    {
        type: 'event',
        anonymous: false,
        inputs: [
            {
                name: 'oldOwner',
                internalType: 'address',
                type: 'address',
                indexed: true,
            },
            {
                name: 'newOwner',
                internalType: 'address',
                type: 'address',
                indexed: true,
            },
        ],
        name: 'OwnershipTransferred',
    },
    {
        type: 'event',
        anonymous: false,
        inputs: [
            { name: 'user', internalType: 'address', type: 'address', indexed: true },
            {
                name: 'roles',
                internalType: 'uint256',
                type: 'uint256',
                indexed: true,
            },
        ],
        name: 'RolesUpdated',
    },
    { type: 'error', inputs: [], name: 'AlreadyInitialized' },
    { type: 'error', inputs: [], name: 'NewOwnerIsZeroAddress' },
    { type: 'error', inputs: [], name: 'NoHandoverRequest' },
    { type: 'error', inputs: [], name: 'Unauthorized' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// InteractionDelegatorAction
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const interactionDelegatorActionAbi = [
    {
        type: 'constructor',
        inputs: [
            {
                name: '_interactionManager',
                internalType: 'contract ProductInteractionManager',
                type: 'address',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [
            {
                name: '_interaction',
                internalType: 'struct Interaction',
                type: 'tuple',
                components: [
                    { name: 'productId', internalType: 'uint256', type: 'uint256' },
                    { name: 'data', internalType: 'bytes', type: 'bytes' },
                ],
            },
        ],
        name: 'sendInteraction',
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        inputs: [
            {
                name: '_interactions',
                internalType: 'struct Interaction[]',
                type: 'tuple[]',
                components: [
                    { name: 'productId', internalType: 'uint256', type: 'uint256' },
                    { name: 'data', internalType: 'bytes', type: 'bytes' },
                ],
            },
        ],
        name: 'sendInteractions',
        outputs: [],
        stateMutability: 'nonpayable',
    },
    { type: 'error', inputs: [], name: 'InteractionFailed' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// InteractionDelegatorValidator
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const interactionDelegatorValidatorAbi = [
    {
        type: 'constructor',
        inputs: [
            { name: '_delegatorAddress', internalType: 'address', type: 'address' },
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
        inputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
        name: 'enable',
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        inputs: [
            { name: '_caller', internalType: 'address', type: 'address' },
            { name: '_data', internalType: 'bytes', type: 'bytes' },
        ],
        name: 'validCaller',
        outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
        stateMutability: 'view',
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
                name: '',
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
            { name: '', internalType: 'bytes32', type: 'bytes32' },
            { name: '', internalType: 'uint256', type: 'uint256' },
        ],
        name: 'validateUserOp',
        outputs: [{ name: '', internalType: 'ValidationData', type: 'uint256' }],
        stateMutability: 'payable',
    },
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
