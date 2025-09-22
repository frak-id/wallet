import { Elysia } from "elysia";
import { MerkleTreeRepository } from "./repositories/MerkleTreeRepository";
import { OracleWebhookService } from "./services/hookService";
import { OracleProofService } from "./services/proofService";
import { UpdateOracleService } from "./services/updateService";

export const oracleContext = new Elysia({
    name: "Context.oracle",
})
    .decorate(() => {
        const merkleRepository = new MerkleTreeRepository();
        return {
            oracle: {
                repositories: {
                    merkleTree: merkleRepository,
                },
                services: {
                    webhook: new OracleWebhookService(),
                    proof: new OracleProofService(merkleRepository),
                    update: new UpdateOracleService(merkleRepository),
                },
            },
        };
    })
    .as("scoped");

export type OracleContextApp = typeof oracleContext;
