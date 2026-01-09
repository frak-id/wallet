/**
 * Attestation event structure for on-chain proof.
 */
export type AttestationEvent = {
    event: string;
    timestampInSecond: number;
};

/**
 * Build attestation for on-chain proof.
 * Encodes events as base64 JSON for RewardsHub contract.
 */
export function buildAttestation(
    events: Array<{ event: string; timestamp: Date }>
): string {
    const payload: AttestationEvent[] = events.map((e) => ({
        event: e.event,
        timestampInSecond: Math.floor(e.timestamp.getTime() / 1000),
    }));
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}
