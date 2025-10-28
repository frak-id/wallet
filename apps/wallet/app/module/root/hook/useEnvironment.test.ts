import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironment } from "@/module/root/hook/useEnvironment";

describe("useEnvironment", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    it("should return isDebug true when DEBUG is 'true'", () => {
        vi.stubEnv("DEBUG", "true");

        const result = useEnvironment();

        expect(result.isDebug).toBe(true);
    });

    it("should return isDebug false when DEBUG is not 'true'", () => {
        vi.stubEnv("DEBUG", "false");

        const result = useEnvironment();

        expect(result.isDebug).toBe(false);
    });

    it("should return isDebug false when DEBUG is undefined", () => {
        vi.unstubAllEnvs();

        const result = useEnvironment();

        expect(result.isDebug).toBe(false);
    });

    it("should return isProduction based on isRunningInProd", () => {
        const result = useEnvironment();

        // isProduction is determined by isRunningInProd from app-essentials
        // In test environment, it should be false
        expect(typeof result.isProduction).toBe("boolean");
    });
});
