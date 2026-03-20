export type MoneriumTokenResponse = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    profile: string;
    token_type: string;
    userId: string;
};

export type MoneriumProfile = {
    id: string;
    name: string;
    kind: "personal" | "corporate";
    state: "created" | "pending" | "approved" | "rejected" | "blocked";
};

export type MoneriumProfilesResponse = {
    profiles: MoneriumProfile[];
};

export type MoneriumIban = {
    iban: string;
    bic: string;
    profile: string;
    address: string;
    chain: string;
    state: "requested" | "approved" | "pending" | "rejected" | "closed";
    emailNotifications: boolean;
};

export type MoneriumIbansResponse = {
    ibans: MoneriumIban[];
};

export type MoneriumNewOrder = {
    amount: string;
    signature: string;
    currency: string;
    address: string;
    chain: string;
    counterpart: {
        identifier: {
            standard: string;
            iban: string;
        };
        details: Record<string, unknown>;
    };
    message: string;
    memo?: string;
};

export type MoneriumOrder = {
    id: string;
    profile: string;
    address: string;
    kind: string;
    chain: string;
    amount: string;
    currency: string;
    counterpart: {
        identifier: {
            standard: string;
            iban?: string;
        };
        details: Record<string, unknown>;
    };
    memo: string;
    meta: {
        placedAt: string;
        processedAt?: string;
        rejectedReason?: string;
    };
    state: string;
};
