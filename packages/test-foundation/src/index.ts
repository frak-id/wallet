/**
 * Entry point for the shared test utilities. Wallet fixtures and factories
 * are NOT re-exported here — import them from `@frak-labs/wallet-shared/test`.
 */

export {
    mockDocumentReferrer,
    mockWebLocks,
    mockWindowHistory,
    mockWindowOrigin,
    setupListenerDomMocks,
} from "./dom-mocks";

export { getReactOnlyPlugins, getReactTestPlugins } from "./vitest.shared";
