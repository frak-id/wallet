import { db } from "@backend-common";
import { and, eq, isNotNull } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { MerkleTree } from "merkletreejs";
import { type Hex, hexToBytes, keccak256 } from "viem";
import { productOracleTable, purchaseStatusTable } from "../db/schema";

/**
 * Repository used to manage the merkle tree
 */
export class MerkleTreeRepository {
    // Since merklee tree can be super heavy, only keep max 32 in memory
    private readonly cache = new LRUCache<Hex, MerkleTree>({
        max: 32,
    });

    /**
     * Build the merkle tree for a product
     * @param productId
     * @returns
     */
    private async buildMerkleTreeForProduct(productId: Hex) {
        // Fetch every leaf from the databases
        const leavesFromDb = await db
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
        const cachedTree = this.cache.get(productId);
        if (cachedTree) {
            return cachedTree as MerkleTree;
        }
        const tree = await this.buildMerkleTreeForProduct(productId);
        this.cache.set(productId, tree);
        return tree;
    }

    /**
     * Get the merkle root for a product
     */
    public async getMerkleRoot({
        productId,
    }: {
        productId: Hex;
    }): Promise<Hex> {
        const tree = await this.getMerkleTreeFromCacheOrBuild(productId);
        return tree.getHexRoot() as Hex;
    }

    /**
     * Get the merkle root for a product
     */
    public async getMerkleProof({
        productId,
        purchaseLeaf,
    }: {
        productId: Hex;
        purchaseLeaf: Hex;
    }): Promise<Hex[] | undefined> {
        const tree = await this.getMerkleTreeFromCacheOrBuild(productId);
        const hashedLeaf = keccak256(purchaseLeaf);
        const index = tree.getLeafIndex(hexToBytes(hashedLeaf) as Buffer);
        if (index === -1) {
            return undefined;
        }
        return tree.getHexProof(hashedLeaf) as Hex[];
    }

    /**
     * Invalidate a few products tree
     */
    public invalidateProductTrees({ productIds }: { productIds: Hex[] }) {
        for (const productId of productIds) {
            this.cache.delete(productId);
        }
    }

    /**
     * Get the cache size
     */
    get cacheSize() {
        return this.cache.size;
    }

    get cachedTrees() {
        return this.cache.keys();
    }
}
