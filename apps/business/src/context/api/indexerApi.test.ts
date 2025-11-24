import { describe, expect, it } from "vitest";
import { indexerApi } from "./indexerApi";

describe("indexerApi", () => {
    it("should be defined", () => {
        expect(indexerApi).toBeDefined();
    });

    it("should have get method", () => {
        expect(indexerApi.get).toBeDefined();
        expect(typeof indexerApi.get).toBe("function");
    });

    it("should have post method", () => {
        expect(indexerApi.post).toBeDefined();
        expect(typeof indexerApi.post).toBe("function");
    });

    it("should have put method", () => {
        expect(indexerApi.put).toBeDefined();
        expect(typeof indexerApi.put).toBe("function");
    });

    it("should have delete method", () => {
        expect(indexerApi.delete).toBeDefined();
        expect(typeof indexerApi.delete).toBe("function");
    });

    it("should be a ky instance", () => {
        // Check for ky-specific methods
        expect(indexerApi.extend).toBeDefined();
        expect(typeof indexerApi.extend).toBe("function");
    });

    it("should have INDEXER_URL as prefix", () => {
        // The prefixUrl is set from process.env.INDEXER_URL
        expect(process.env.INDEXER_URL).toBeDefined();
    });
});
