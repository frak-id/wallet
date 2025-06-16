import { afterAll, beforeAll, mock } from "bun:test";
import { mockAll } from ".";
import "./common";
import "./viem";
import "./webauthn";

/**
 * Before all tests even runs
 */
beforeAll(() => {
    mockAll();
});

/**
 * After all tests, global teardown
 *  - mock restore not rly useful here, as it restores the mocks for the entire test file
 */
afterAll(() => {
    mock.restore();
});
