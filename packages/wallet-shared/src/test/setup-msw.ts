import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

/**
 * MSW setup for Vitest
 * Establishes API mocking for all tests
 */

// Start server before all tests
beforeAll(() => {
    server.listen({ onUnhandledRequest: "warn" });
});

// Reset handlers after each test
afterEach(() => {
    server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
    server.close();
});
