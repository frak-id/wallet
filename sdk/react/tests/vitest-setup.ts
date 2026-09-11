/**
 * Vitest setup for the React SDK unit tests: shared RTL cleanup, jest-dom
 * matchers and BigInt serialization. Tests are co-located with their source.
 */

import { afterEach, vi } from "vitest";

import "@frak-labs/test-foundation/react-testing-library-setup";
import "@frak-labs/test-foundation/react-setup";

afterEach(() => {
    vi.clearAllMocks();
});
