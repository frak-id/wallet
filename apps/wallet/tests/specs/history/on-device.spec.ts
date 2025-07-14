import { test } from "../../fixtures";

// verify the history button and click it
test("should display history page when history button clicked", async ({
    homePage,
    historyPage,
}) => {
    // Navigate to the home page
    await homePage.navigateToHome();
    // Verify that the wallet basics information is visible on the home page

    //verify the historybutton is visible and click it
    await historyPage.clickHistoryButton();

    // Verify that the history page is displayed
    await historyPage.verifyDisplayHistoryPage();
});

//verify navigation to history page
//verify notification button  and change url
