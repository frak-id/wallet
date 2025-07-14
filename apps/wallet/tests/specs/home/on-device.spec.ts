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

//return to the home-page on click on back from received page
test("should handle back to wallet from receive page", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickReceive();
    await homePage.verifyDisplayReceivedPage();
    await homePage.clickBackToWalletPage();
    await homePage.verifyBasicsInformations();
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

//return to the home-page on click on back to wallet from send page
test("should handle back to wallet from send page", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickSend();
    await homePage.verifyDisplaySendPage();
    await homePage.clickBackToWalletPage();
    await homePage.verifyBasicsInformations();
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

//verify clipboard text to be true
test("should copy address on receive page", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickReceive();

    // Click the copy address button
    await homePage.clickCopyAddressButton();

    // Verify that the address is copied to clipboard
    await homePage.verifyClipboardText();
});
