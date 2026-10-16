import type {
    MoneriumErrorCode,
    MoneriumOrderDto,
    MoneriumStatusResponse,
} from "@backend-domain/monerium/schemas";

export function moneriumStatus(
    overrides: Partial<MoneriumStatusResponse> = {}
): MoneriumStatusResponse {
    return {
        connection: "connected",
        profile: { id: "p", kind: "personal", state: "approved" },
        walletLink: "linked",
        silentReconnect: false,
        environment: "production",
        ...overrides,
    };
}

export function moneriumOrder(
    overrides: Partial<MoneriumOrderDto> = {}
): MoneriumOrderDto {
    return {
        id: "ord-1",
        address: "0x0000000000000000000000000000000000000abc",
        kind: "redeem",
        chain: "arbitrum",
        amount: "10.00",
        currency: "eur",
        counterpart: { iban: "EE52", own: false },
        memo: "",
        placedAt: "2024-01-01T10:00:00Z",
        txHashes: [],
        state: "pending",
        ...overrides,
    };
}

/** An Eden treaty success envelope. */
export const ok = <T>(data: T) => ({ data, error: null });

/** An Eden treaty failure envelope, with the backend's error code when it has one. */
export const fail = (status: number, code?: MoneriumErrorCode) => ({
    data: null,
    error: { status, value: code ? { code } : {} },
});
