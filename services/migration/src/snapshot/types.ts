export type OldProductOracle = {
    id: number;
    product_id: string; // hex
    hook_signature_key: string;
    created_at: string | null; // ISO timestamp
    platform: "shopify" | "woocommerce" | "custom" | "internal";
    merkle_root: string | null; // hex
    synced: boolean | null;
    last_sync_tx_hash: string | null; // hex
};

export type OldPurchase = {
    id: number;
    oracle_id: number;
    purchase_id: string; // hex (merkle-related, will be dropped)
    external_id: string;
    external_customer_id: string;
    purchase_token: string | null;
    total_price: string; // decimal as string
    currency_code: string;
    status: "pending" | "confirmed" | "cancelled" | "refunded" | null;
    leaf: string | null; // hex (merkle-related, will be dropped)
    created_at: string | null; // ISO timestamp
    updated_at: string | null; // ISO timestamp
};

export type OldPurchaseItem = {
    id: number;
    purchase_id: string; // hex (references old purchase.purchase_id)
    external_id: string;
    price: string; // decimal as string
    name: string;
    title: string;
    image_url: string | null;
    quantity: number;
    created_at: string | null; // ISO timestamp
};

export type OldPurchaseTracker = {
    id: number;
    wallet: string; // hex (Address)
    external_purchase_id: string;
    external_customer_id: string;
    token: string;
    pushed: boolean | null;
    created_at: string | null; // ISO timestamp
};

export type OracleSnapshot = {
    snapshotVersion: 1;
    createdAt: string; // ISO timestamp
    stage: string;
    tables: {
        productOracles: OldProductOracle[];
        purchases: OldPurchase[];
        purchaseItems: OldPurchaseItem[];
        purchaseTrackers: OldPurchaseTracker[];
    };
    counts: {
        productOracles: number;
        purchases: number;
        purchaseItems: number;
        purchaseTrackers: number;
        purchaseTrackersSkippedPushed: number;
    };
};
