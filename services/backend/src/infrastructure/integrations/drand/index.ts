import { log } from "@backend-infrastructure/external/logger";

/** Same League of Entropy network behind each; tried in order. */
const DRAND_RELAYS = [
    "https://api.drand.sh",
    "https://api2.drand.sh",
    "https://api3.drand.sh",
    "https://drand.cloudflare.com",
];

export type DrandBeacon =
    | { kind: "found"; signature: string }
    | { kind: "too_early" }
    | { kind: "unavailable" };

export class DrandClient {
    constructor(private readonly relays: readonly string[] = DRAND_RELAYS) {}

    /** The first relay answer `accept` validates; a relay serving a bad signature is skipped. */
    async fetchBeacon(
        chainHash: string,
        round: number,
        accept: (signature: string) => boolean
    ): Promise<DrandBeacon> {
        let tooEarly = false;
        for (const relay of this.relays) {
            const url = `${relay}/${chainHash}/public/${round}`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5_000),
            }).catch((err: unknown) => {
                log.warn({ err, url }, "drand relay unreachable");
                return null;
            });
            if (!response) continue;
            // Relays answer 425 Too Early for a round not emitted yet.
            if (response.status === 425) {
                tooEarly = true;
                continue;
            }
            if (!response.ok) continue;
            const body = (await response.json().catch(() => null)) as {
                round?: number;
                signature?: string;
            } | null;
            if (body?.round === round && body.signature) {
                if (accept(body.signature)) {
                    return { kind: "found", signature: body.signature };
                }
                log.error({ url }, "drand relay served an invalid signature");
            }
        }
        return tooEarly ? { kind: "too_early" } : { kind: "unavailable" };
    }
}
