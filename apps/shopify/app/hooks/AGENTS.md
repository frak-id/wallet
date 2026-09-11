# hooks/ — Client-Side Data Hooks

Three patterns: React Query data fetching, `useMemo` URL builders, utility listeners.

## INVENTORY

| Hook                               | Pattern            | External   | Purpose                                                                      |
| ---------------------------------- | ------------------ | ---------- | ---------------------------------------------------------------------------- |
| `useMerchantBank`                  | React Query + viem | viemClient | Bank metadata/status via multicall                                           |
| `useBankActions`                   | useMutation        | none       | Open/close bank, update/revoke allowance, withdraw                           |
| `useWaitForTxAndInvalidateQueries` | useCallback        | viemClient | Waits for tx receipt then invalidates React Query cache                      |
| `useRefreshData`                   | useCallback        | none       | Dual refresh: React Query `refetchQueries` + React Router `revalidate`       |
| `useVisibilityChange`              | useEffect          | none       | Fires callback when tab becomes visible                                      |

## REACT QUERY PATTERN

```ts
export function useOnChainShopInfo() {
    const { data: shopInfo, ...query } = useQuery({
        queryKey: ["shopInfo", domain],
        queryFn: async () => { ... },
        enabled: !!domain,
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
    });
    return { shopInfo, ...query };
}
```

**Conventions**:

- `queryKey`: `["feature", ...params]` — starts with feature name.
- `enabled`: Guard with `!!param` to prevent queries when data missing.
- Return: Destructure `data` into named field + spread `...query`.
- Error: Return fallback data (e.g., hardcoded rates), never throw.

## VIEM MULTICALL PATTERN

```ts
const results = await multicall(viemClient, {
  contracts: [
    { address, abi: campaignBankAbi, functionName: "getConfig" },
    { address, abi: erc20Abi, functionName: "balanceOf", args: [address] },
  ],
  allowFailure: false,
});
```

- `allowFailure: false` — strict mode, fails if any call fails.
- ABIs from `@frak-labs/app-essentials/blockchain` — there is no local `abis/` dir.
- Chain: Arbitrum (prod) or Arbitrum Sepolia (dev). RPC via erpc.gcp.frak.id with 50ms batching.

## URL BUILDER PATTERN

```ts
const link = useMemo(() => {
  const url = new URL(process.env.BUSINESS_URL);
  url.pathname = "/path";
  url.searchParams.set("key", value);
  return url.toString();
}, [value]);
```

## ANTI-PATTERNS

- **No `useEffect` for data fetching** — always React Query.
- **No direct fetch calls** — use `backendApi` client from `utils/`.
- **No `useState` + `useEffect` for derived state** — use `useMemo`.
