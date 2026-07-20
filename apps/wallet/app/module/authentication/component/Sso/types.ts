import type { SsoMetadata } from "@frak-labs/core-sdk";

/**
 * Metadata actually stored on the SSO context — base SsoMetadata plus the
 * optional `name` field injected by the wallet-shared store layer.
 */
export type Metadata = SsoMetadata & { name?: string };
