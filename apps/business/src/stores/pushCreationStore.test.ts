import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

const mockForm: FormCreatePushNotification = {
    title: "Test Push Notification",
    payload: {
        title: "Test Title",
        body: "Test Body",
    },
    audience: {
        type: "all",
    },
    scheduledAt: new Date(),
} as unknown as FormCreatePushNotification;

describe("pushCreationStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", ({
            freshPushCreationStore,
        }: TestContext) => {
            const state = freshPushCreationStore.getState();

            expect(state.currentPushCreationForm).toBeUndefined();
        });
    });

    describe("setForm", () => {
        test("should set the push creation form", ({
            freshPushCreationStore,
        }: TestContext) => {
            freshPushCreationStore.getState().setForm(mockForm);

            expect(
                freshPushCreationStore.getState().currentPushCreationForm
            ).toEqual(mockForm);
        });

        test("should update existing form", ({
            freshPushCreationStore,
        }: TestContext) => {
            const updatedForm: FormCreatePushNotification = {
                ...mockForm,
                title: "Updated Title",
            } as FormCreatePushNotification;

            freshPushCreationStore.getState().setForm(mockForm);
            freshPushCreationStore.getState().setForm(updatedForm);

            expect(
                freshPushCreationStore.getState().currentPushCreationForm
            ).toEqual(updatedForm);
        });

        test("should persist form state", ({
            freshPushCreationStore,
        }: TestContext) => {
            freshPushCreationStore.getState().setForm(mockForm);

            // Check localStorage
            const stored = localStorage.getItem("currentPushCampaignForm");
            expect(stored).toBeTruthy();
        });

        test("should handle undefined form", ({
            freshPushCreationStore,
        }: TestContext) => {
            freshPushCreationStore.getState().setForm(mockForm);
            freshPushCreationStore.getState().setForm(undefined);

            expect(
                freshPushCreationStore.getState().currentPushCreationForm
            ).toBeUndefined();
        });
    });

    describe("clearForm", () => {
        test("should clear the form", ({
            freshPushCreationStore,
        }: TestContext) => {
            freshPushCreationStore.getState().setForm(mockForm);
            freshPushCreationStore.getState().clearForm();

            expect(
                freshPushCreationStore.getState().currentPushCreationForm
            ).toBeUndefined();
        });

        test("should work when form is already undefined", ({
            freshPushCreationStore,
        }: TestContext) => {
            freshPushCreationStore.getState().clearForm();

            expect(
                freshPushCreationStore.getState().currentPushCreationForm
            ).toBeUndefined();
        });

        test("should clear persisted form state", ({
            freshPushCreationStore,
        }: TestContext) => {
            freshPushCreationStore.getState().setForm(mockForm);
            freshPushCreationStore.getState().clearForm();

            // Zustand persist keeps the entry but with empty state
            const stored = localStorage.getItem("currentPushCampaignForm");
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(parsed.state.currentPushCreationForm).toBeUndefined();
            } else {
                // If localStorage is cleared, that's also fine
                expect(stored).toBeNull();
            }
        });
    });
});
