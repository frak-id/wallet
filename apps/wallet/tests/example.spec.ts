// test.only("e2e registration", async ({ page }) => {
//     // webauthn shit
//     const cdpSession = await page.context().newCDPSession(page);
//     await cdpSession.send("WebAuthn.enable");
//     const authenticator = await cdpSession.send(
//         "WebAuthn.addVirtualAuthenticator",
//         {
//             options: {
//                 protocol: "ctap2",
//                 ctap2Version: "ctap2_1",
//                 transport: "usb",
//                 hasUserVerification: true,
//                 hasResidentKey: true,
//                 automaticPresenceSimulation: true,
//                 isUserVerified: true,
//             },
//         }
//     );
//     // await cdpSession.send("WebAuthn.setUserVerified", {
//     //     authenticatorId: authenticator.authenticatorId,
//     //     isUserVerified: true,
//     // });
//     // await cdpSession.send("WebAuthn.setAutomaticPresenceSimulation", {
//     //     authenticatorId: authenticator.authenticatorId,
//     //     enabled: true,
//     // });

//     // Check that the browser has authenticator
//     // const authenticatorIds = await cdpSession.send("WebAuthn.getAuthenticatorIDs");
//     console.log(authenticator);

//     await page.goto("/register");
//     await page.waitForSelector("button:has-text('Create your wallet')");
//     await page.click("button:has-text('Create your wallet')");

//     // Wait for login completion - likely redirect to wallet
//     // await Bun.sleep(10000);

//     // Log all the credentials in the authenticator
//     const credentials = await cdpSession.send("WebAuthn.getCredentials", {
//         authenticatorId: authenticator.authenticatorId,
//     });
//     console.log(credentials);
// });

// test("e2e new fixtures", async ({ webAuthN, authPage }) => {
//     await authPage.navigateToRegister();
//     await authPage.clickRegister();

//     // Ensure we got a credential created
//     const credentials = await webAuthN.getCredentials();
//     expect(credentials).toHaveLength(1);

//     // Ensure we navigated to the wallet dashboard
//     await authPage.verifyWalletPage();
// });
