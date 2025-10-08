import { MerkleTreeRepository } from "./repositories/MerkleTreeRepository";
import { OracleWebhookService } from "./services/hookService";
import { OracleProofService } from "./services/proofService";
import { UpdateOracleService } from "./services/updateService";

/**
 * The context for the oracle domain
 */
export namespace OracleContext {
    const merkleRepository = new MerkleTreeRepository();

    export const repositories = {
        merkleTree: merkleRepository,
    };

    export const services = {
        webhook: new OracleWebhookService(),
        proof: new OracleProofService(merkleRepository),
        update: new UpdateOracleService(merkleRepository),
    };
}
