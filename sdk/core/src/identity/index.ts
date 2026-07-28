/**
 * Public surface of `@frak-labs/core-sdk/identity`.
 *
 * Browser code (SDK actions, clients, utils) must NOT import this barrel —
 * import `./canonical` and `./sign` by deep path instead, so verification
 * code (`./verify`, backend-only) never reaches the CDN bundle. See
 * `bundle-isolation.test.ts` and
 * `docs/plans/identity-proof-of-possession/DECISIONS.md` §2.1.
 */

export type { ProofMessageParams } from "./canonical";
export {
    base64UrlToBytes,
    buildProofMessage,
    bytesToBase64Url,
    decodeProof,
    deriveClientIdFromHash,
    encodeProof,
    normalizeUuid,
} from "./canonical";
export { deriveClientId } from "./derive";
export type { ProofEnvelope, ProofOp, ProofVerification } from "./types";
