import { test as base } from "@playwright/test";
import { AnalyticsApi } from "./api/analytics.api";
import { BackendApi } from "./api/backend.api";
import { MockedWebAuthNHelper } from "./helpers/mockedWebauthn.helper";
import { StorageHelper } from "./helpers/sotrage.helper";
import { WebAuthNHelper } from "./helpers/webauthn.helper";
import { AuthPage } from "./pages/auth.page";
import { HistoryPage } from "./pages/history.page";
import { HomePage } from "./pages/home.page";
import { SettingsPage } from "./pages/settings.page";

type TestFixtures = {
    // Helpers
    webAuthN: WebAuthNHelper;
    mockedWebAuthN: MockedWebAuthNHelper;
    storageHelper: StorageHelper;
    // APIs
    backendApi: BackendApi;
    analyticsApi: AnalyticsApi;
    // Pages
    authPage: AuthPage;
    settingsPage: SettingsPage;
    homePage: HomePage;
    historyPage: HistoryPage;
};

// WebAuthN should switched to worker scope, with a pre existing authenticator + credentials so we can test login + pairing easily
// biome-ignore lint/complexity/noBannedTypes: will be filled in the long run
type WorkerFixture = {};

export const test = base.extend<TestFixtures, WorkerFixture>({
    // Helpers
    webAuthN: async ({ page }, use) => {
        const helper = new WebAuthNHelper(page);
        await helper.setup();
        await use(helper);
        // todo: when to trigger the cleanup?
        // await helper.cleanup();
    },
    mockedWebAuthN: async ({ page }, use) => {
        const helper = new MockedWebAuthNHelper(page);
        await use(helper);
    },
    storageHelper: async ({ page }, use) => {
        await use(new StorageHelper(page));
    },
    // APIs
    backendApi: async ({ page }, use) => {
        await use(new BackendApi(page));
    },
    analyticsApi: [
        async ({ page }, use) => {
            const analyticsApi = new AnalyticsApi(page);
            await analyticsApi.mockAnalyticsRoute();
            await use(analyticsApi);
        },
        { auto: true },
    ],
    // Helpers
    authPage: async ({ page }, use) => {
        await use(new AuthPage(page));
    },
    settingsPage: async ({ page }, use) => {
        await use(new SettingsPage(page));
    },
    homePage: async ({ page }, use) => {
        await use(new HomePage(page));
    },
    historyPage: async ({ page }, use) => {
        await use(new HistoryPage(page));
    },
});

export { expect } from "@playwright/test";
