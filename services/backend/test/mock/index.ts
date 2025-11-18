/**
 * Mock exports for backend tests
 *
 * This file re-exports mock objects that tests can use to configure
 * mock behavior and verify mock calls.
 *
 * Usage in tests:
 * ```typescript
 * import { viemActionsMocks, oxMocks } from "../../../../test/mock";
 *
 * viemActionsMocks.readContract.mockResolvedValue({ ... });
 * expect(viemActionsMocks.readContract).toHaveBeenCalled();
 * ```
 */

export { oxMocks, permissionlessActionsMocks, viemActionsMocks } from "./viem";
