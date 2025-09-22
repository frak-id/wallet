import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

test("should display activation toggle when wallet not activated", async ({
    homePage,
    blockchainHelper,
}) => {
    await blockchainHelper.withDisabledSession();

    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();

    await homePage.verifyActivateToggleDisplayed();
});

test("shouldn't display activation toggle when wallet activated", async ({
    homePage,
    blockchainHelper,
}) => {
    await blockchainHelper.withEnabledSession();

    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();

    await homePage.verifyActivateToggleHidden();
});

// todo: We need to find a way to reset the mocks, wait for real datas to ensure the wallet is enabled
// todo: pairing wallet is conflicting with the main one because of the signature request, we need to have a salt or something for the paired wallet
test.skip("should be able to enable session on home page", async ({
    homePage,
    blockchainHelper,
}) => {
    await blockchainHelper.withDisabledSession();

    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();

    await homePage.verifyActivateToggleDisplayed();

    await homePage.clickActivateToggle();
});
