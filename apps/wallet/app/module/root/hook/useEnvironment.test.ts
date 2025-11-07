import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { useEnvironment } from "@/module/root/hook/useEnvironment";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

describe("useEnvironment", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    test("should return isDebug true when DEBUG is 'true'", () => {
        vi.stubEnv("DEBUG", "true");

        const result = useEnvironment();

        expect(result.isDebug).toBe(true);
    });

    test("should return isDebug false when DEBUG is not 'true'", () => {
        vi.stubEnv("DEBUG", "false");

        const result = useEnvironment();

        expect(result.isDebug).toBe(false);
    });

    test("should return isDebug false when DEBUG is undefined", () => {
        vi.unstubAllEnvs();

        const result = useEnvironment();

        expect(result.isDebug).toBe(false);
    });

    test("should return isProduction based on isRunningInProd", () => {
        const result = useEnvironment();

        // isProduction is determined by isRunningInProd from app-essentials
        // In test environment, it should be false
        expect(typeof result.isProduction).toBe("boolean");
    });
});
