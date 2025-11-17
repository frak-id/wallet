/**
 * Vitest Setup File for wallet-shared Package Unit Tests
 *
 * This file imports shared setup files and mocks:
 * - react-testing-library-setup.ts: RTL cleanup and jest-dom matchers
 * - react-setup.ts: BigInt serialization for Zustand
 * - wallet-mocks.ts: Wagmi, React Router, WebAuthn, IndexedDB mocks
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
