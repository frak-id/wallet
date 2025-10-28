import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW server for testing
 * Sets up request interception for API mocking in Node.js environment
 */
export const server = setupServer(...handlers);
