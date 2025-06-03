import type { AppSpecificSsoMetadata } from "@/module/authentication/atoms/sso";
import type { Hex } from "viem";

/**
 * Query keys for SSO-related queries
 */
export namespace ssoKey {
    /**
     * The base key
     */
    const base = "sso" as const;

    /**
     * Query keys for params
     */
    const paramsBase = "params-decompression" as const;
    export const params = {
        bySearchParams: (searchParams: string) =>
            [base, paramsBase, searchParams] as const,
    };

    /**
     * Mutation keys for consume
     */
    const consumeBase = "consume" as const;
    export const consume = {
        baseKey: [base, consumeBase] as const,
    };

    /**
     * Query keys for link
     */
    const linkBase = "link" as const;
    export const link = {
        baseKey: [base, linkBase] as const,
        full: (params: {
            productId: Hex;
            metadata: AppSpecificSsoMetadata;
            directExit?: boolean;
            redirectUrl?: string;
            lang?: "en" | "fr";
            consumeKey?: Hex;
        }) => [
            base,
            linkBase,
            params.productId,
            params.metadata,
            params.directExit,
            params.redirectUrl,
            params.lang,
            params.consumeKey,
        ],
    };

    /**
     * Mutation keys for demo
     */
    const demoBase = "demo" as const;
    export const demo = {
        login: [base, demoBase, "login"] as const,
    };
}
