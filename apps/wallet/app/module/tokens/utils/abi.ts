/**
 * Wallet-local partial ABIs used by the tokens flows (balance, claims, sends).
 *
 * Why local: shipping the full `rewarderHubAbi` (~8.5 KB raw, 50+ admin items)
 * or viem's `erc20Abi` (~1.5 KB raw, 9 fns + events) into the wallet bundle
 * just to call `getClaimable` / `claimBatch` / `decimals` / `transfer` is dead
 * weight. Co-locating the partials with their consumers keeps Rolldown's
 * auto-chunker from hoisting them into a feature-shared chunk.
 */

/** RewarderHub `getClaimable(wallet,token) -> uint256` view. */
export const rewarderGetClaimableAbi = {
    type: "function",
    name: "getClaimable",
    inputs: [
        { name: "_wallet", type: "address" },
        { name: "_token", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
    stateMutability: "view",
} as const;

/** RewarderHub `claimBatch(tokens[])` write. */
export const rewarderClaimBatchAbi = {
    type: "function",
    name: "claimBatch",
    inputs: [{ name: "_tokens", type: "address[]" }],
    outputs: [],
    stateMutability: "nonpayable",
} as const;

/**
 * RewarderHub `claim(token) -> uint256` write. Used by the merge asset
 * migration to batch per-token claims inside the loser's kernel
 * `executeBatch`. Reverts on an empty claim — the migrate mutation
 * surfaces that as a retryable error so the next attempt rebuilds calls
 * from a fresh summary read.
 */
export const rewarderClaimAbi = {
    type: "function",
    name: "claim",
    inputs: [{ name: "_token", type: "address" }],
    outputs: [{ name: "claimed", type: "uint256" }],
    stateMutability: "nonpayable",
} as const;

/** ERC20 `balanceOf(account) -> uint256` view. */
export const erc20BalanceOfAbi = {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
} as const;

/** ERC20 `decimals() -> uint8` view. */
export const erc20DecimalsAbi = {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
} as const;

/** ERC20 `transfer(to,amount) -> bool` write. */
export const erc20TransferAbi = {
    type: "function",
    name: "transfer",
    inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
} as const;
