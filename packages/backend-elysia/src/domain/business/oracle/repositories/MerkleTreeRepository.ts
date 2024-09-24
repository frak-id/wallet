import { and, eq, isNotNull } from "drizzle-orm";
import type { LRUCache } from "lru-cache";
import MerkleTree from "merkletreejs";
import { type Hex, keccak256 } from "viem";
import type { BusinessDb } from "../../context";
import { productOracleTable, purchaseStatusTable } from "../../db/schema";

/**
 * Repository used to manage the merkle tree
 */
export class MerkleTreeRepository {
    constructor(
        private readonly cache: LRUCache<string, MerkleTree>,
        private readonly businessDb: BusinessDb
    ) {}

    private productCacheKey(productId: Hex) {
        return `MerkleTreeRepository-tree-${productId}`;
    }

    /**
     * Build the merkle tree for a product
     * @param productId
     * @returns
     */
    private async buildMerkleTreeForProduct(productId: Hex) {
        // Fetch every leaf from the databases
        const leavesFromDb = await this.businessDb
            .select({
                leaf: purchaseStatusTable.leaf,
            })
            .from(purchaseStatusTable)
            .innerJoin(
                productOracleTable,
                eq(purchaseStatusTable.oracleId, productOracleTable.id)
            )
            .where(
                and(
                    eq(productOracleTable.productId, productId),
                    isNotNull(purchaseStatusTable.leaf)
                )
            );
        const leaves = leavesFromDb.map((leaf) => leaf.leaf as Hex);

        // Build and return the tree
        return new MerkleTree(leaves, keccak256, {
            sort: true,
            hashLeaves: true,
        });
    }

    /**
     * Get or build a merklee tree for a product
     */
    private async getMerkleTreeFromCacheOrBuild(productId: Hex) {
        const cacheKey = this.productCacheKey(productId);
        const cachedTree = this.cache.get(cacheKey);
        if (cachedTree) {
            return cachedTree;
        }
        const tree = await this.buildMerkleTreeForProduct(productId);
        this.cache.set(cacheKey, tree);
        return tree;
    }

    /**
     * Get the merkle root for a product
     */
    public async getMerkleRoot({
        productId,
    }: { productId: Hex }): Promise<Hex> {
        const tree = await this.getMerkleTreeFromCacheOrBuild(productId);
        return tree.getHexRoot() as Hex;
    }

    /**
     * Get the merkle root for a product
     */
    public async getMerkleProof({
        productId,
        purchaseLeaf,
    }: { productId: Hex; purchaseLeaf: Hex }): Promise<Hex[]> {
        const tree = await this.getMerkleTreeFromCacheOrBuild(productId);
        return tree.getHexProof(purchaseLeaf) as Hex[];
    }

    /**
     * Invalidate a few products tree
     */
    public invalidateProductTrees({ productIds }: { productIds: Hex[] }) {
        for (const productId of productIds) {
            this.cache.delete(this.productCacheKey(productId));
        }
    }
}
