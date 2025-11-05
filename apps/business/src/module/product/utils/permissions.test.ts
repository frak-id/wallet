import { describe, expect, it } from "vitest";
import { permissionLabels, permissionLabelsArray } from "./permissions";

describe("permissions", () => {
    describe("permissionLabels", () => {
        it("should contain productAdministrator role", () => {
            expect(permissionLabels.productAdministrator).toBeDefined();
            expect(permissionLabels.productAdministrator.label).toBe(
                "Product administrator"
            );
            expect(permissionLabels.productAdministrator.shortLabel).toBe(
                "Administrator"
            );
            expect(
                permissionLabels.productAdministrator.description
            ).toBeTruthy();
            expect(permissionLabels.productAdministrator.color).toBe("success");
        });

        it("should contain interactionManager role", () => {
            expect(permissionLabels.interactionManager).toBeDefined();
            expect(permissionLabels.interactionManager.label).toBe(
                "Interaction manager"
            );
            expect(permissionLabels.interactionManager.shortLabel).toBe(
                "Interaction"
            );
            expect(
                permissionLabels.interactionManager.description
            ).toBeTruthy();
        });

        it("should contain campaignManager role", () => {
            expect(permissionLabels.campaignManager).toBeDefined();
            expect(permissionLabels.campaignManager.label).toBe(
                "Campaign manager"
            );
            expect(permissionLabels.campaignManager.shortLabel).toBe(
                "Campaign"
            );
            expect(permissionLabels.campaignManager.description).toBeTruthy();
        });

        it("should contain purchaseOracleUpdater role", () => {
            expect(permissionLabels.purchaseOracleUpdater).toBeDefined();
            expect(permissionLabels.purchaseOracleUpdater.label).toBe(
                "Purchase oracle updater"
            );
            expect(permissionLabels.purchaseOracleUpdater.shortLabel).toBe(
                "Purchase Oracle"
            );
            expect(
                permissionLabels.purchaseOracleUpdater.description
            ).toBeTruthy();
            expect(permissionLabels.purchaseOracleUpdater.color).toBe(
                "secondary"
            );
        });

        it("should have exactly 4 roles", () => {
            const roleKeys = Object.keys(permissionLabels);
            expect(roleKeys).toHaveLength(4);
        });

        it("should have all required fields for each role", () => {
            for (const [_key, permission] of Object.entries(permissionLabels)) {
                expect(permission.label).toBeTruthy();
                expect(permission.shortLabel).toBeTruthy();
                expect(permission.description).toBeTruthy();
                expect(typeof permission.label).toBe("string");
                expect(typeof permission.shortLabel).toBe("string");
                expect(typeof permission.description).toBe("string");
            }
        });

        it("should have unique labels for each role", () => {
            const labels = Object.values(permissionLabels).map((p) => p.label);
            const uniqueLabels = new Set(labels);
            expect(uniqueLabels.size).toBe(labels.length);
        });

        it("should have unique short labels for each role", () => {
            const shortLabels = Object.values(permissionLabels).map(
                (p) => p.shortLabel
            );
            const uniqueShortLabels = new Set(shortLabels);
            expect(uniqueShortLabels.size).toBe(shortLabels.length);
        });

        it("should have color property only for specific roles", () => {
            expect(permissionLabels.productAdministrator.color).toBe("success");
            expect(permissionLabels.purchaseOracleUpdater.color).toBe(
                "secondary"
            );
            expect(permissionLabels.interactionManager.color).toBeUndefined();
            expect(permissionLabels.campaignManager.color).toBeUndefined();
        });
    });

    describe("permissionLabelsArray", () => {
        it("should be an array", () => {
            expect(Array.isArray(permissionLabelsArray)).toBe(true);
        });

        it("should have 4 entries", () => {
            expect(permissionLabelsArray).toHaveLength(4);
        });

        it("should contain all role IDs from permissionLabels", () => {
            const arrayIds = permissionLabelsArray.map((p) => p.id);
            const labelKeys = Object.keys(permissionLabels);

            expect(arrayIds.sort()).toEqual(labelKeys.sort());
        });

        it("should have id, label, and description for each entry", () => {
            for (const permission of permissionLabelsArray) {
                expect(permission.id).toBeTruthy();
                expect(permission.label).toBeTruthy();
                expect(permission.description).toBeTruthy();
                expect(typeof permission.id).toBe("string");
                expect(typeof permission.label).toBe("string");
                expect(typeof permission.description).toBe("string");
            }
        });

        it("should match corresponding permissionLabels entries", () => {
            for (const arrayEntry of permissionLabelsArray) {
                const labelEntry = permissionLabels[arrayEntry.id];
                expect(labelEntry).toBeDefined();
                expect(arrayEntry.label).toBe(labelEntry.label);
                expect(arrayEntry.description).toBe(labelEntry.description);
            }
        });

        it("should contain productAdministrator", () => {
            const admin = permissionLabelsArray.find(
                (p) => p.id === "productAdministrator"
            );
            expect(admin).toBeDefined();
            expect(admin?.label).toBe("Product administrator");
        });

        it("should contain interactionManager", () => {
            const manager = permissionLabelsArray.find(
                (p) => p.id === "interactionManager"
            );
            expect(manager).toBeDefined();
            expect(manager?.label).toBe("Interaction manager");
        });

        it("should contain campaignManager", () => {
            const manager = permissionLabelsArray.find(
                (p) => p.id === "campaignManager"
            );
            expect(manager).toBeDefined();
            expect(manager?.label).toBe("Campaign manager");
        });

        it("should contain purchaseOracleUpdater", () => {
            const updater = permissionLabelsArray.find(
                (p) => p.id === "purchaseOracleUpdater"
            );
            expect(updater).toBeDefined();
            expect(updater?.label).toBe("Purchase oracle updater");
        });
    });

    describe("data integrity", () => {
        it("should have consistent data between object and array representations", () => {
            const objectCount = Object.keys(permissionLabels).length;
            const arrayCount = permissionLabelsArray.length;
            expect(objectCount).toBe(arrayCount);
        });

        it("should not have duplicate IDs in array", () => {
            const ids = permissionLabelsArray.map((p) => p.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it("should not have empty strings in any field", () => {
            for (const permission of permissionLabelsArray) {
                expect(permission.id).not.toBe("");
                expect(permission.label).not.toBe("");
                expect(permission.description).not.toBe("");
            }

            for (const permission of Object.values(permissionLabels)) {
                expect(permission.label).not.toBe("");
                expect(permission.shortLabel).not.toBe("");
                expect(permission.description).not.toBe("");
            }
        });
    });
});
