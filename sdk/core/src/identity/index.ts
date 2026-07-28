/**
 * Public surface of `@frak-labs/core-sdk/identity`.
 *
 * The SDK only ever *signs*. Verification is the backend's job and lives
 * there (`IdentityProofService`); what is shared is the frozen material
 * both sides must agree on to the byte — the canonical message layout and
 * the id derivation — plus the golden fixtures that pin them.
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
