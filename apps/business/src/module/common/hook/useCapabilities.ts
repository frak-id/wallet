import { useAuthStore } from "@/stores/authStore";

/**
 * Design doc §4.9: walletless accounts can do everything except the
 * user-wallet-signed onchain actions (bank withdraw, allowance, open/close,
 * legacy migration). `canOnchain` gates exactly those four surfaces.
 */
export function useCapabilities() {
    const canOnchain = useAuthStore((state) => state.wallet !== null);
    return { canOnchain };
}
