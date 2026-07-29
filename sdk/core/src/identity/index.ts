/**
 * Public surface of `@frak-labs/core-sdk/identity`.
 *
 * The SDK only ever *signs*. Verification is the backend's job and lives
 * there (`IdentityProofService`); what is shared is the frozen material
 * both sides must agree on to the byte — the canonical message layout and
 * the id derivation. The golden fixtures that pin them ship under the
 * separate `./identity/fixtures` subpath.
 */

export {
    buildProofMessage,
    decodeProof,
    deriveClientIdFromHash,
} from "./canonical";
export type { ProofOp, ProofVerification } from "./types";
