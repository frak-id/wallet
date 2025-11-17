/**
 * Centralized Test Utilities Index
 *
 * This file provides a single entry point for importing test utilities from the test-foundation package,
 * simplifying imports across test files and reducing boilerplate.
 *
 * Usage:
 * ```ts
 * import {
 *     setupTanStackRouterMock,
 *     mockWindowOrigin,
 *     getReactTestPlugins
 * } from '@frak-labs/test-foundation';
 * ```
 *
 * Instead of:
 * ```ts
 * import { setupTanStackRouterMock } from '../../../packages/test-foundation/src/router-mocks';
 * import { mockWindowOrigin } from '../../../packages/test-foundation/src/dom-mocks';
 * import { getReactTestPlugins } from '../../packages/test-foundation/src/vitest.shared';
 * ```
 *
 * Note: For factory functions and fixtures from wallet-shared, import directly:
 * ```ts
 * import { createMockSession } from '@frak-labs/wallet-shared/test';
 * import { test, expect } from '@frak-labs/wallet-shared/tests/vitest-fixtures';
 * ```
 */

// DOM mocking utilities
export {
    mockDocumentReferrer,
    mockWindowHistory,
    mockWindowOrigin,
    setupListenerDomMocks,
} from "./dom-mocks";

// Router mocking utilities
export {
    createTanStackRouterMock,
    setupTanStackRouterMock,
} from "./router-mocks";

// Vitest plugin configuration helpers
export { getReactOnlyPlugins, getReactTestPlugins } from "./vitest.shared";
