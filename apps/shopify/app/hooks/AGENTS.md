# hooks/ — Client-Side Data Hooks

8 hooks. Three patterns: React Query data fetching, `useMemo` URL builders, utility listeners.

## INVENTORY

| Hook                     | Pattern            | External   | Purpose                                                                      |
| ------------------------ | ------------------ | ---------- | ---------------------------------------------------------------------------- |
| `useOnChainShopInfo`     | React Query        | indexerApi | Shop/bank/campaign data from indexer, 30s polling                            |
| `useOnChainCampaignInfo` | React Query + viem | viemClient | Campaign metadata/status via multicall                                       |
| `usetokenInfo`           | React Query + viem | viemClient | ERC20 name/symbol/decimals/balance via multicall (`useTokenInfoWithBalance`) |
| `useConversionRate`      | React Query        | backendApi | Token→fiat rates, hardcoded fallback (USD 1, EUR 0.85, GBP 0.72)             |
| `useCreateCampaignLink`  | useMemo            | none       | Builds business.frak.id campaign URL from loader data                        |
| `useFrakWebhookLink`     | useMemo            | none       | Builds business.frak.id webhook URL with merchantId                          |
| `useRefreshData`         | useCallback        | none       | Dual refresh: React Query `refetchQueries` + React Router `revalidate`       |
| `useVisibilityChange`    | useEffect          | none       | Fires callback when tab becomes visible                                      |

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
- **Types over interfaces**: Prefer `type` aliases. Use `interface` only when declaration merging is required.

## VIEM MULTICALL PATTERN

```ts
const results = await multicall(viemClient, {
  contracts: [
    { address, abi: interactionCampaignAbi, functionName: "getMetadata" },
    { address, abi: interactionCampaignAbi, functionName: "isActive" },
  ],
  allowFailure: false,
});
```

- `allowFailure: false` — strict mode, fails if any call fails.
- ABIs from `utils/abis/campaignAbis.ts` (7 contracts).
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
- **No direct fetch calls** — use `backendApi` or `indexerApi` clients from `utils/`.
- **No `useState` + `useEffect` for derived state** — use `useMemo`.
