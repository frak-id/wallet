/**
 * Vitest Setup File for Business App Unit Tests
 *
 * Test Organization:
 * - Tests are co-located with source files (e.g., src/stores/campaignStore.test.ts)
 * - Use .test.ts or .test.tsx extension for test files
 * - Run tests with: bun run test (or bun run test:ui for Vitest UI)
 *
 * This file imports shared React setup and provides business-specific mocks:
 * - react-testing-library-setup.ts: RTL cleanup and jest-dom matchers
 * - react-setup.ts: BigInt serialization for Zustand
 * - shared-setup.ts: Browser API mocks (crypto, IntersectionObserver, MessageChannel)
 * - apps-setup.ts: Environment variables
 *
 * Business-specific mocks:
 * - TanStack Router hooks (useNavigate, useRouter, etc.) - via router-mocks.ts
 * - TanStack Start hooks
 */

import { vi } from "vitest";
import { setupTanStackRouterMock } from "../../../test-setup/router-mocks";

// Import shared React Testing Library setup (cleanup + jest-dom)
import "../../../test-setup/react-testing-library-setup";

// Import shared React setup (BigInt serialization)
import "../../../test-setup/react-setup";

// Mock TanStack Router hooks (using shared router-mocks.ts abstraction)
await setupTanStackRouterMock();

// Mock TanStack Start specific hooks if needed
vi.mock("@tanstack/react-start", async () => {
    const actual = await vi.importActual<
        typeof import("@tanstack/react-start")
    >("@tanstack/react-start");
    return {
        ...actual,
    };
});

// Don't mock TanStack Query globally - tests will create their own QueryClient
// and mock only the API calls they need. This allows proper query state management.

// Note: OpenPanel, crypto.randomUUID, window.matchMedia, IntersectionObserver,
// ResizeObserver, and document.cookie mocks are now handled by shared-setup.ts
// and apps-setup.ts
