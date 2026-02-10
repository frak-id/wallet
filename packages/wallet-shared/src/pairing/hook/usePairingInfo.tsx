import { useQuery } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { pairingKey } from "../queryKeys";

type PairingApiError = {
    status?: number;
    value?: {
        status?: number;
    };
    response?: {
        status?: number;
    };
};

export class PairingNotFoundError extends Error {
    readonly status = 404;

    constructor() {
        super("Pairing session not found or expired");
        this.name = "PairingNotFoundError";
    }
}

function extractErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== "object") {
        return undefined;
    }

    const typedError = error as PairingApiError;
    if (typeof typedError.status === "number") {
        return typedError.status;
    }
    if (typeof typedError.value?.status === "number") {
        return typedError.value.status;
    }
    if (typeof typedError.response?.status === "number") {
        return typedError.response.status;
    }

    return undefined;
}

export function isPairingNotFoundError(error: unknown): boolean {
    if (error instanceof PairingNotFoundError) {
        return true;
    }

    return extractErrorStatus(error) === 404;
}

/**
 * Get info for a pairing
 */
export function usePairingInfo({ id }: { id?: string }) {
    const query = useQuery({
        queryKey: pairingKey.getInfo(id),
        queryFn: async () => {
            if (!id) {
                return null;
            }

            const { data, error } = await authenticatedWalletApi.pairings
                .find({ id })
                .get();

            if (data) {
                return data;
            }

            if (isPairingNotFoundError(error)) {
                throw new PairingNotFoundError();
            }

            throw new Error(
                `Failed to fetch pairing info (status: ${extractErrorStatus(error) ?? "unknown"})`,
                { cause: error }
            );
        },
        enabled: !!id,
    });

    return query;
}
