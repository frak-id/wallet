import { test as base } from "@playwright/test";
import { AnalyticsApi } from "./api/analytics.api";
import { BackendApi } from "./api/backend.api";
import { IndexerApi } from "./api/indexer.api";
import { RpcApi } from "./api/rpc.api";
import { BlockchainHelper } from "./helpers/blockchain.helper";
import { ClipboardHelper } from "./helpers/clipboard.helper";
import { MockedWebAuthNHelper } from "./helpers/mockedWebauthn.helper";
import { PairingTabHelper } from "./helpers/pairingTab.helper";
import { StorageHelper } from "./helpers/sotrage.helper";
import { WebAuthNHelper } from "./helpers/webauthn.helper";
import { AuthPage } from "./pages/auth.page";
import { HistoryPage } from "./pages/history.page";
import { HomePage } from "./pages/home.page";
import { PairingPage } from "./pages/pairing.page";
import { SettingsPage } from "./pages/settings.page";

type TestFixtures = {
    // Helpers
    webAuthN: WebAuthNHelper;
    mockedWebAuthN: MockedWebAuthNHelper;
    storageHelper: StorageHelper;
    clipboardHelper: ClipboardHelper;
    blockchainHelper: BlockchainHelper;
    // APIs
    backendApi: BackendApi;
    analyticsApi: AnalyticsApi;
    indexerApi: IndexerApi;
    rpcApi: RpcApi;
    // Pages
    authPage: AuthPage;
    pairingPage: PairingPage;
    settingsPage: SettingsPage;
    homePage: HomePage;
    historyPage: HistoryPage;
};

// WebAuthN should switched to worker scope, with a pre existing authenticator + credentials so we can test login + pairing easily
type WorkerFixture = {
    pairingTab: PairingTabHelper;
};
export const test = base.extend<TestFixtures, WorkerFixture>({
    // Worker-level fixtures
    pairingTab: [
        async ({ browser }, use) => {
            // Create a new context for the pairing tab
            const context = await browser.newContext();
            const pairingTab = new PairingTabHelper(context);

            // Setup the pairing tab
            await pairingTab.setup();

            await use(pairingTab);

            // Cleanup
            await pairingTab.close();
            await context.close();
        },
        { scope: "worker" },
    ],
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
    clipboardHelper: async ({ page }, use) => {
        await use(new ClipboardHelper(page));
    },
    blockchainHelper: async ({ page }, use) => {
        await use(new BlockchainHelper(page));
    },
    // APIs
    backendApi: async ({ page }, use) => {
        await use(new BackendApi(page));
    },
    indexerApi: async ({ page }, use) => {
        await use(new IndexerApi(page));
    },
    rpcApi: async ({ page }, use) => {
        await use(new RpcApi(page));
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
    pairingPage: async ({ page }, use) => {
        await use(new PairingPage(page));
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
