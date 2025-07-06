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
    await homePage.clickReveive();
    await homePage.verifyDisplayReceivedPage();
});
