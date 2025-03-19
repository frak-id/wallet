import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import type { Hex } from "viem";

const base = {
    sso: ["sso"] as const,
} as const;

/**
 * Query keys for SSO-related queries
 */
export const ssoQueryKeys = {
    base: base.sso,
    params: {
        base: [...base.sso, "params-decompression"] as const,
        bySearchParams: (searchParams: string) =>
            [...base.sso, "params-decompression", searchParams] as const,
    },
    consume: [...base.sso, "consume"] as const,
    link: {
        base: [...base.sso, "link"] as const,
        full: (params: {
            productId: Hex;
            metadata: AppSpecificSsoMetadata;
            directExit?: boolean;
            redirectUrl?: string;
            lang?: "en" | "fr";
            consumeKey?: Hex;
        }) => [
            ...ssoQueryKeys.link.base,
            params.productId,
            params.metadata,
            params.directExit,
            params.redirectUrl,
            params.lang,
            params.consumeKey,
        ],
    },
} as const;

/**
 * Mutation keys for SSO-related mutations
 */
export const ssoMutationKeys = {
    demo: {
        login: [...base.sso, "demo", "login"] as const,
    },
} as const;
