/**
 * Vitest Setup File for Wallet App Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., app/module/stores/recoveryStore.test.ts)
 * - Use .test.ts or .test.tsx extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file imports shared setup files and mocks:
 * - react-testing-library-setup.ts: RTL cleanup and jest-dom matchers
 * - react-setup.ts: BigInt serialization for Zustand
 * - wallet-mocks.ts: Wagmi, TanStack Router, WebAuthn, IndexedDB mocks
 * - shared-setup.ts: Browser API mocks (crypto, IntersectionObserver, MessageChannel)
 * - apps-setup.ts: Environment variables
 *
 * Projects can customize behavior using vi.mocked() to override specific mocks.
 */

// Import shared React Testing Library setup (cleanup + jest-dom)
import "@frak-labs/test-foundation/react-testing-library-setup";

// Import shared React setup (BigInt serialization)
import "@frak-labs/test-foundation/react-setup";

// Import shared wallet mocks (Wagmi, Router, WebAuthn, idb-keyval)
import "@frak-labs/test-foundation/wallet-mocks";

// Note: Don't mock TanStack Query globally - tests will create their own QueryClient
// and mock only the API calls they need. This allows proper query state management.
