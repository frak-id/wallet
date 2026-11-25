import { describe, expect, it } from "vitest";
import {
    cropOutputSize,
    maxCropZoom,
    planCrop,
    ratioRangeLabels,
} from "./imageRatio";

const labels = (plan: ReturnType<typeof planCrop>) =>
    plan?.presets.map((p) => p.label);

describe("planCrop", () => {
    it("offers the crop on in-range images, flagged as usable as-is", () => {
        const logo = planCrop({ width: 512, height: 512 }, "logo");
        expect(logo?.fits).toBe(true);
        expect(logo?.initial.label).toBe("1:1");
        const hero = planCrop({ width: 1600, height: 900 }, "hero");
        expect(hero?.fits).toBe(true);
        expect(hero?.initial.label).toBe("16:9");
    });

    it("flags out-of-range images as needing the crop", () => {
        expect(planCrop({ width: 1200, height: 300 }, "logo")?.fits).toBe(
            false
        );
    });

    it("starts a too-wide logo on the widest accepted ratio", () => {
        const plan = planCrop({ width: 1200, height: 300 }, "logo");
        expect(plan?.initial.label).toBe("2:1");
        expect(labels(plan)).toEqual(["1:2", "1:1", "2:1"]);
    });

    it("starts a too-tall logo on the tallest accepted ratio", () => {
        expect(
            planCrop({ width: 300, height: 1200 }, "logo")?.initial.label
        ).toBe("1:2");
    });

    it("starts a square hero on 4:3", () => {
        expect(
            planCrop({ width: 2000, height: 2000 }, "hero")?.initial.label
        ).toBe("4:3");
    });

    it("drops ratios whose largest crop is under the minimum size", () => {
        // 4:3 of a 460px-tall strip is 613px wide, under the 800px minimum.
        expect(labels(planCrop({ width: 3000, height: 460 }, "hero"))).toEqual([
            "16:9",
            "2:1",
        ]);
    });

    it("returns null when no crop can reach the minimum size", () => {
        expect(planCrop({ width: 600, height: 600 }, "hero")).toBeNull();
        expect(planCrop({ width: 100, height: 400 }, "logo")).toBeNull();
    });
});

describe("maxCropZoom", () => {
    it("stops zooming before the crop gets under the minimum size", () => {
        // 2:1 crop of 1200×300 is 600×300 → 300 / 128.
        expect(maxCropZoom({ width: 1200, height: 300 }, 2, "logo")).toBe(
            300 / 128
        );
    });

    it("caps at 4 for large images and never goes under 1", () => {
        expect(maxCropZoom({ width: 8000, height: 2000 }, 2, "logo")).toBe(4);
        expect(maxCropZoom({ width: 100, height: 100 }, 1, "logo")).toBe(1);
    });
});

describe("cropOutputSize", () => {
    it("clamps the output into the accepted range", () => {
        expect(
            cropOutputSize({ width: 1206, height: 600 }, 2.01, "hero")
        ).toEqual({ width: 1200, height: 600 });
        expect(
            cropOutputSize({ width: 790, height: 600 }, 1.3167, "hero")
        ).toEqual({ width: 798, height: 600 });
    });

    it("never rounds under the tallest hero ratio", () => {
        for (let h = 450; h < 470; h++) {
            const { width, height } = cropOutputSize(
                { width: (h * 4) / 3, height: h },
                4 / 3,
                "hero"
            );
            expect(width / height).toBeGreaterThanOrEqual(1.33);
        }
    });

    it("downscales huge crops to 2048px on the longest side", () => {
        expect(
            cropOutputSize({ width: 6000, height: 3000 }, 2, "hero")
        ).toEqual({ width: 2048, height: 1024 });
    });
});

it("labels the accepted range from the presets", () => {
    expect(ratioRangeLabels("hero")).toEqual({ min: "4:3", max: "2:1" });
    expect(ratioRangeLabels("icon")).toEqual({ min: "1:2", max: "2:1" });
});
