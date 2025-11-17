/**
 * Vitest Setup File for UI Package Unit Tests
 *
 * This file imports shared setup files for component testing:
 * - react-testing-library-setup.ts: RTL cleanup and jest-dom matchers
 * - react-setup.ts: BigInt serialization for Zustand (if needed)
 * - shared-setup.ts: Browser API mocks (crypto, IntersectionObserver, etc.)
 *
 * The UI package is framework-agnostic and doesn't need wallet-specific mocks.
 */

// Import shared React Testing Library setup (cleanup + jest-dom)
import "@frak-labs/test-foundation/react-testing-library-setup";

// Import shared React setup (BigInt serialization)
import "@frak-labs/test-foundation/react-setup";

// Import shared browser API mocks
import "@frak-labs/test-foundation/shared-setup";
