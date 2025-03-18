import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import type { Hex } from "viem";

/**
 * Query keys for SSO-related queries
 */
const base = {
    sso: ["sso"] as const,
    demo: ["demo"] as const,
} as const;

export const ssoQueryKeys = {
    base: base.sso,
    params: {
        base: [...base.sso, "params-decompression"] as const,
        bySearchParams: (searchParams: string) =>
            [...base.sso, "params-decompression", searchParams] as const,
    },
    demo: {
        base: base.demo,
        login: {
            base: [...base.demo, "login"] as const,
        },
    },
    consume: ["sso", "consume"] as const,
    link: {
        base: ["sso", "link"] as const,
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
