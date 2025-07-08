import { test } from "../../fixtures";

// the wallet basics informations are visible on the home page
test("should display wallet basics informations", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
});

//the page change when click on received button clicked
test("should display wallet token received page", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickReceive();
    await homePage.verifyDisplayReceivedPage();
});

//return to the home-page on click on back to wallet page link
test("should display wallet home page when back to wallet page link clicked", async ({
    homePage,
}) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickReceive();
    await homePage.verifyReturnToHome();
});

//display the token send page when the send button is clicked
test("should display token send after clicking on send button", async ({
    homePage,
}) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickSend();
    await homePage.verifyDisplaySendPage();
});

//verify the refresh button and click it
test("should refresh the wallet page when refresh button clicked", async ({
    homePage,
}) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    // Click the refresh button
    await homePage.clickRefresh();
    // Verify that the page has been refreshed
    await homePage.verifyBasicsInformations();
});

//verify the wallet button and click it
test("should display wallet page when wallet button clicked", async ({
    homePage,
}) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    // Click the wallet button
    await homePage.clickWalletButton();
    // Verify that the wallet page is displayed
    await homePage.verifyBasicsInformations();
});
// verify the history button and click it
test("should display history page when history button clicked", async ({
    homePage,
}) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    // Click the history button
    await homePage.clickHistoryButton();
    // Verify that the history page is displayed
    await homePage.verifyDisplayHistoryPage();
});

//verify the settings button click and display the settings page
test("should display settings page when settings button clicked", async ({
    homePage,
}) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickSettingsButton();

    // Verify that the settings page is displayed
    await homePage.verifyDisplaySettingsPage();
});

//verify clipboard text to be true
test.skip("should copy address to clipboard", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    // Click the copy address button
    await homePage.clickCopyAddressButton();
});
