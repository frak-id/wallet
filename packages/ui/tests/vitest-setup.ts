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
import "../../../test-setup/react-testing-library-setup";

// Import shared React setup (BigInt serialization)
import "../../../test-setup/react-setup";

// Import shared browser API mocks
import "../../../test-setup/shared-setup";
