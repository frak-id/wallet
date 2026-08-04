/**
 * Shared types for the identity proof-of-possession wire format.
 *
 * Imported by both the browser signer (`sign.ts`) and the backend verifier
 * (`IdentityProofService`), so it must stay a pure type module with no
 * runtime code and no crypto import. See `canonical.ts` for the frozen
 * byte layout.
 */

/**
 * Domain-separated proof operations. A signature produced for one op must
 * never verify for another — this is what stops a proof harvested from a
 * leaky channel (e.g. the install URL) from being replayed against a more
 * sensitive endpoint (e.g. merge).
 */
export type ProofOp =
    | "frak-merge-v1"
    | "frak-ensure-v1"
    | "frak-install-v1"
    | "frak-sso-v1";

/**
 * Decoded wire envelope. `pk` and `sig` are raw bytes here — the
 * base64url/JSON encoding only exists on the wire, see `encodeProof` /
 * `decodeProof` in `canonical.ts`.
 */
export type ProofEnvelope = {
    /** Envelope version. Always 1 today. */
    v: 1;
    /** Uncompressed P-256 public key: 65 bytes, 0x04 prefix. */
    pk: Uint8Array;
    /** Unix seconds the proof was signed at. */
    ts: number;
    /**
     * Raw r‖s ECDSA signature, 64 bytes. Low-S normalisation is not
     * guaranteed — it depends on which signer backend produced it — so
     * verifiers must accept either form. Plain ECDSA verifiers do, and the
     * malleability low-S prevents is irrelevant here because the signature is
     * never hashed into an identifier. See the byte layout in `canonical.ts`.
     */
    sig: Uint8Array;
};

/** Result of verifying a decoded proof against a claimed identity. */
export type ProofVerification =
    | { valid: true }
    | {
          valid: false;
          reason: "malformed" | "id_mismatch" | "bad_signature" | "expired";
      };
