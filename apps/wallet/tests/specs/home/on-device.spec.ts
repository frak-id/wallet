import { test } from "../../fixtures";

//the wallet balance present in the top of the page
test("should display wallet balance", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBalance();
});
