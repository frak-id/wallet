import type { Address } from "viem";
import { vi } from "vitest";

/* -------------------------------------------------------------------------- */
/*                        DNS Check Repository Mocks                          */
/* -------------------------------------------------------------------------- */

export const dnsCheckRepositoryMocks = {
    getNormalizedDomain: vi.fn((domain: string) => domain),
    getDnsTxtString: vi.fn(
        (_args: { domain: string; owner: Address }) =>
            `frak-business; hash=0x123`
    ),
    isValidDomain: vi.fn(() => Promise.resolve(false)),
};

/* -------------------------------------------------------------------------- */
/*                          Mint Repository Mocks                             */
/* -------------------------------------------------------------------------- */

export const mintRepositoryMocks = {
    precomputeProductId: vi.fn((_domain: string) => BigInt(0)),
    isExistingProduct: vi.fn((_productId: bigint) => Promise.resolve(false)),
    mintProduct: vi.fn(() =>
        Promise.resolve({
            mintTxHash: "0x123" as `0x${string}`,
            productId: BigInt(1),
            interactionResult: undefined,
            bankResult: undefined,
        })
    ),
};

/* -------------------------------------------------------------------------- */
/*                            Viem Actions Mocks                              */
/* -------------------------------------------------------------------------- */

export const readContractMock = vi.fn(() => Promise.resolve());
export const simulateContractMock = vi.fn(() => Promise.resolve());
export const writeContractMock = vi.fn(() => Promise.resolve());
export const getTransactionCountMock = vi.fn(() => Promise.resolve(0));
export const waitForTransactionReceiptMock = vi.fn(() => Promise.resolve());

// Mock the domain modules that use these repositories
vi.mock("../../src/domain/business/context", () => ({
    BusinessContext: {
        repositories: {
            dnsCheck: dnsCheckRepositoryMocks,
            mint: mintRepositoryMocks,
        },
    },
}));

// Export for common mock usage if needed
export const businessContextMocks = {
    dnsCheck: dnsCheckRepositoryMocks,
    mint: mintRepositoryMocks,
};
