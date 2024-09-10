import { describe, expect, test } from "vitest";
import { NexusContextManager } from "./NexusContext";

describe("NexusContextManager.parse", () => {
    test("should return context from url", async () => {
        const parsed = await NexusContextManager.parse({
            url: "https://news-paper.xyz/article?id=66b39cb432308c3dd2ee8308&nCtx=N4IgTiBcIAwB4FEAsBOVSBsATAxhgrPgKYDsATAIICGZZAYvgIwZkAcdAwmQMwBCSAM1YoyjUhVYgAvkA%3D%3D%3D",
        });
        expect(parsed).toStrictEqual({
            r: "0xE494946dc655e72Aa22F51628FC23B4f8921e7A8",
        });
    });
});
