import { test as base, expect } from "@playwright/test";
import { mockDefaultApiRoutes } from "./mocks/api";
import {
    sessionStoreValue,
    unauthenticatedSessionStoreValue,
} from "./mocks/sessions";

type LightFixtures = {
    mockApis: undefined;
    injectAuthState: (options?: { authenticated?: boolean }) => Promise<void>;
};

export const test = base.extend<LightFixtures>({
    mockApis: [
        async ({ page }, use) => {
            await mockDefaultApiRoutes(page);
            await use(undefined);
        },
        { auto: true },
    ],

    injectAuthState: async ({ page }, use) => {
        const inject = async (
            options: { authenticated?: boolean } = { authenticated: true }
        ) => {
            const sessionValue =
                options.authenticated === false
                    ? unauthenticatedSessionStoreValue
                    : sessionStoreValue;

            await page.addInitScript((session) => {
                localStorage.setItem(
                    "frak_session_store",
                    JSON.stringify(session)
                );
            }, sessionValue);
        };

        await use(inject);
    },
});

export { expect };
