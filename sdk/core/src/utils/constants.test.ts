/**
 * Tests for constants
 * Tests backup key constant value
 */

import { describe, expect, it } from "../../tests/vitest-fixtures";
import { BACKUP_KEY } from "./constants";

describe("constants", () => {
    describe("BACKUP_KEY", () => {
        it("should have correct backup key value", () => {
            expect(BACKUP_KEY).toBe("nexus-wallet-backup");
        });

        it("should be a string", () => {
            expect(typeof BACKUP_KEY).toBe("string");
        });

        it("should not be empty", () => {
            expect(BACKUP_KEY.length).toBeGreaterThan(0);
        });
    });
});
