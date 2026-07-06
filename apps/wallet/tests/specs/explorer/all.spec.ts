import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN, backendApi }) => {
    await mockedWebAuthN.setup();
    await backendApi.mockExplorerMerchants();
});

// Opening the sort sheet, applying a non-default option, and reopening keeps
// that option selected (the applied sort is remembered for the session).
test("applies a sort and remembers it on reopen", async ({ explorerPage }) => {
    await explorerPage.navigateToExplorer();

    await explorerPage.openSortSheet();
    await explorerPage.selectSortOption("Highest reward");
    await explorerPage.applySort();

    await explorerPage.openSortSheet();
    await explorerPage.verifySortOptionChecked("Highest reward");
});

// A real-signal sort actually reorders the list: the default "Most popular"
// (campaign count desc) leads with Merchant Two; "Most recent" (reverse) leads
// with Merchant Three.
test("reorders the merchant list on a real-signal sort", async ({
    explorerPage,
}) => {
    await explorerPage.navigateToExplorer();
    await explorerPage.verifyFirstMerchant("Merchant Two");

    await explorerPage.openSortSheet();
    await explorerPage.selectSortOption("Most recent");
    await explorerPage.applySort();

    await explorerPage.verifyFirstMerchant("Merchant Three");
});
