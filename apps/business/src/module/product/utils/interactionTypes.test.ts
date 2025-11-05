import { describe, expect, it } from "vitest";
import { interactionTypesInfo } from "./interactionTypes";

describe("interactionTypes", () => {
    describe("interactionTypesInfo", () => {
        it("should have entries for all interaction types", () => {
            expect(interactionTypesInfo.openArticle).toBeDefined();
            expect(interactionTypesInfo.readArticle).toBeDefined();
            expect(interactionTypesInfo.open).toBeDefined();
            expect(interactionTypesInfo.referred).toBeDefined();
            expect(interactionTypesInfo.completed).toBeDefined();
            expect(interactionTypesInfo.unsafeCompleted).toBeDefined();
            expect(
                interactionTypesInfo.proofVerifiableStorageUpdate
            ).toBeDefined();
            expect(
                interactionTypesInfo.callableVerifiableStorageUpdate
            ).toBeDefined();
            expect(interactionTypesInfo.started).toBeDefined();
            expect(interactionTypesInfo.createLink).toBeDefined();
            expect(interactionTypesInfo.customerMeeting).toBeDefined();
        });

        it("should have name for each interaction type", () => {
            for (const [_key, info] of Object.entries(interactionTypesInfo)) {
                expect(info.name).toBeTruthy();
                expect(typeof info.name).toBe("string");
            }
        });

        it("should have unique names for each interaction type", () => {
            const names = Object.values(interactionTypesInfo).map(
                (info) => info.name
            );
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(names.length);
        });

        it("should have exactly 11 interaction types", () => {
            const keys = Object.keys(interactionTypesInfo);
            expect(keys).toHaveLength(11);
        });
    });

    describe("related goals", () => {
        it("should map traffic-related interactions", () => {
            expect(interactionTypesInfo.openArticle.relatedGoal).toBe(
                "traffic"
            );
            expect(interactionTypesInfo.readArticle.relatedGoal).toBe(
                "traffic"
            );
            expect(interactionTypesInfo.open.relatedGoal).toBe("traffic");
        });

        it("should map registration-related interactions", () => {
            expect(interactionTypesInfo.referred.relatedGoal).toBe(
                "registration"
            );
            expect(interactionTypesInfo.customerMeeting.relatedGoal).toBe(
                "registration"
            );
        });

        it("should map sales-related interactions", () => {
            expect(interactionTypesInfo.completed.relatedGoal).toBe("sales");
            expect(interactionTypesInfo.unsafeCompleted.relatedGoal).toBe(
                "sales"
            );
        });

        it("should have undefined goal for hidden utility interactions", () => {
            expect(
                interactionTypesInfo.proofVerifiableStorageUpdate.relatedGoal
            ).toBeUndefined();
            expect(
                interactionTypesInfo.callableVerifiableStorageUpdate.relatedGoal
            ).toBeUndefined();
            expect(interactionTypesInfo.started.relatedGoal).toBeUndefined();
            expect(interactionTypesInfo.createLink.relatedGoal).toBeUndefined();
        });
    });

    describe("hidden interactions", () => {
        it("should mark unsafe interactions as hidden", () => {
            expect(interactionTypesInfo.unsafeCompleted.hidden).toBe(true);
        });

        it("should mark storage update interactions as hidden", () => {
            expect(
                interactionTypesInfo.proofVerifiableStorageUpdate.hidden
            ).toBe(true);
            expect(
                interactionTypesInfo.callableVerifiableStorageUpdate.hidden
            ).toBe(true);
        });

        it("should mark internal interactions as hidden", () => {
            expect(interactionTypesInfo.started.hidden).toBe(true);
            expect(interactionTypesInfo.createLink.hidden).toBe(true);
        });

        it("should not mark user-facing interactions as hidden", () => {
            expect(interactionTypesInfo.openArticle.hidden).toBeUndefined();
            expect(interactionTypesInfo.readArticle.hidden).toBeUndefined();
            expect(interactionTypesInfo.open.hidden).toBeUndefined();
            expect(interactionTypesInfo.referred.hidden).toBeUndefined();
            expect(interactionTypesInfo.completed.hidden).toBeUndefined();
            expect(interactionTypesInfo.customerMeeting.hidden).toBeUndefined();
        });
    });

    describe("interaction names", () => {
        it("should have descriptive names", () => {
            expect(interactionTypesInfo.openArticle.name).toBe(
                "Visited an Article"
            );
            expect(interactionTypesInfo.readArticle.name).toBe(
                "Read an Article"
            );
            expect(interactionTypesInfo.open.name).toBe("Webshop Open");
            expect(interactionTypesInfo.referred.name).toBe(
                "Referral Link Activation"
            );
            expect(interactionTypesInfo.completed.name).toBe(
                "Purchase completed"
            );
        });

        it("should have unsafe prefix for unsafe completed", () => {
            expect(interactionTypesInfo.unsafeCompleted.name).toContain(
                "[UNSAFE]"
            );
        });
    });

    describe("data integrity", () => {
        it("should have consistent structure for all entries", () => {
            for (const [_key, info] of Object.entries(interactionTypesInfo)) {
                expect(info).toHaveProperty("name");
                expect(typeof info.name).toBe("string");

                if (info.relatedGoal !== undefined) {
                    expect(typeof info.relatedGoal).toBe("string");
                }

                if (info.hidden !== undefined) {
                    expect(typeof info.hidden).toBe("boolean");
                }
            }
        });

        it("should not have empty names", () => {
            for (const info of Object.values(interactionTypesInfo)) {
                expect(info.name).not.toBe("");
                expect(info.name.length).toBeGreaterThan(0);
            }
        });
    });
});
