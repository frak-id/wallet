import { PairingRepository } from "./repositories/PairingRepository";
import { PairingSignatureRepository } from "./repositories/PairingSignatureRepository";

export namespace PairingContext {
    const pairingRepository = new PairingRepository();
    const pairingSignatureRepository = new PairingSignatureRepository();

    export const repositories = {
        pairing: pairingRepository,
        pairingSignature: pairingSignatureRepository,
    };
}
