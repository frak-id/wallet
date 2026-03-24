/// <reference types="vite/client" />

interface ImportMetaEnv {
    /**
     * Wallet display mode:
     * - `"crypto"` (default): Full wallet experience
     * - `"loyalty"`: Hides crypto UI, emphasizes rewards
     */
    readonly VITE_WALLET_MODE?: "crypto" | "loyalty";
}
