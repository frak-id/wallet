// import { expect, test } from "../../fixtures";

// test.describe("On-Device Biometric Login", () => {
//     // Setup and teardown for each test
//     test.beforeEach(async ({ authHelper, webAuthn }) => {
//         // Clear any existing storage and credentials
//         await authHelper.clearStorage();
//         await webAuthn.clearCredentials().catch(() => {
//             // Ignore errors if no authenticator is set up yet
//         });
//     });

//     test.afterEach(async ({ webAuthn }) => {
//         // Clean up WebAuthn resources
//         await webAuthn.cleanup();
//     });

//     test("should login existing wallet with biometrics successfully", async ({
//         webAuthn,
//         authHelper,
//     }) => {
//         // Setup virtual authenticator
//         await webAuthn.enableVirtualAuthenticator({
//             protocol: "ctap2",
//             transport: "internal",
//             hasResidentKey: true,
//             hasUserVerification: true,
//             isUserVerified: true,
//             automaticPresenceSimulation: true,
//         });

//         // First register a wallet
//         await authHelper.navigateToRegister();
//         await authHelper.verifyRegistrationReady();
//         await webAuthn.registerWallet();
//         await authHelper.verifyRegistrationSuccess();

//         // Clear session to simulate returning user
//         await authHelper.clearStorage();

//         // Now test login
//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();
//         await webAuthn.loginWallet();

//         // Verify successful login
//         await authHelper.verifyWalletDashboard();
//         expect(await authHelper.isAuthenticated()).toBeTruthy();
//     });

//     test("should handle login with no registered wallet", async ({
//         webAuthn,
//         authHelper,
//     }) => {
//         await webAuthn.enableVirtualAuthenticator();

//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();
//         await authHelper.clickLogin();

//         // Should show error about no wallet found
//         const error = await authHelper.checkForAuthErrors();
//         expect(error).toBeTruthy();
//         expect(error).toMatch(
//             /wallet.*not.*found|no.*wallet.*registered|register.*first/i
//         );
//     });

//     test("should handle WebAuthn authentication failure", async ({
//         webAuthn,
//         authHelper,
//     }) => {
//         // Setup authenticator for registration
//         await webAuthn.enableVirtualAuthenticator({
//             protocol: "ctap2",
//             transport: "internal",
//             hasResidentKey: true,
//             hasUserVerification: true,
//             isUserVerified: true,
//             automaticPresenceSimulation: true,
//         });

//         // Register wallet first
//         await authHelper.navigateToRegister();
//         await authHelper.verifyRegistrationReady();
//         await webAuthn.registerWallet();
//         await authHelper.verifyRegistrationSuccess();

//         // Clear session
//         await authHelper.clearStorage();

//         // Modify authenticator to fail verification
//         await webAuthn.setUserVerified(false);

//         // Attempt login
//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();
//         await authHelper.clickLogin();

//         // Should show WebAuthn failure error
//         const error = await authHelper.checkForAuthErrors();
//         expect(error).toBeTruthy();
//         expect(error).toMatch(
//             /authentication.*failed|biometric.*failed|verification.*failed/i
//         );
//     });

//     test("should support multiple login sessions", async ({
//         webAuthn,
//         authHelper,
//     }) => {
//         await webAuthn.enableVirtualAuthenticator();

//         // Register wallet
//         await authHelper.navigateToRegister();
//         await authHelper.verifyRegistrationReady();
//         await webAuthn.registerWallet();
//         await authHelper.verifyRegistrationSuccess();

//         // First login session
//         await authHelper.clearStorage();
//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();
//         await webAuthn.loginWallet();
//         await authHelper.verifyWalletDashboard();

//         // Second login session (simulate new tab/window)
//         await authHelper.clearStorage();
//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();
//         await webAuthn.loginWallet();
//         await authHelper.verifyWalletDashboard();
//     });

//     test("should handle network issues during login", async ({
//         page,
//         webAuthn,
//         authHelper,
//     }) => {
//         await webAuthn.enableVirtualAuthenticator();

//         // Register wallet first
//         await authHelper.navigateToRegister();
//         await authHelper.verifyRegistrationReady();
//         await webAuthn.registerWallet();
//         await authHelper.verifyRegistrationSuccess();

//         // Clear session
//         await authHelper.clearStorage();

//         // Simulate network failure for login
//         await page.route("**/api/auth/login", (route) => route.abort());

//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();
//         await authHelper.clickLogin();

//         // Should show network error
//         const error = await authHelper.checkForAuthErrors();
//         expect(error).toBeTruthy();
//         expect(error).toMatch(
//             /network.*error|connection.*failed|server.*error/i
//         );
//     });

//     test("should maintain session after successful login", async ({
//         webAuthn,
//         authHelper,
//     }) => {
//         await webAuthn.enableVirtualAuthenticator();

//         // Register and login wallet
//         await authHelper.navigateToRegister();
//         await authHelper.verifyRegistrationReady();
//         await webAuthn.registerWallet();
//         await authHelper.verifyRegistrationSuccess();

//         // Clear session and login
//         await authHelper.clearStorage();
//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();
//         await webAuthn.loginWallet();
//         await authHelper.verifyWalletDashboard();

//         // Navigate away and back to verify session persistence
//         await authHelper.navigateToWallet();
//         await authHelper.verifyWalletDashboard();
//         expect(await authHelper.isAuthenticated()).toBeTruthy();
//     });

//     test("should handle rapid login attempts", async ({
//         webAuthn,
//         authHelper,
//     }) => {
//         await webAuthn.enableVirtualAuthenticator();

//         // Register wallet
//         await authHelper.navigateToRegister();
//         await authHelper.verifyRegistrationReady();
//         await webAuthn.registerWallet();
//         await authHelper.verifyRegistrationSuccess();

//         // Clear session
//         await authHelper.clearStorage();

//         // Attempt rapid successive logins
//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();

//         // Multiple rapid clicks should be handled gracefully
//         await authHelper.clickLogin();
//         await authHelper.clickLogin(); // Second click should be ignored

//         await authHelper.verifyWalletDashboard();
//     });

//     test("should track login analytics", async ({
//         page,
//         webAuthn,
//         authHelper,
//     }) => {
//         await webAuthn.enableVirtualAuthenticator();

//         // Register wallet first
//         await authHelper.navigateToRegister();
//         await authHelper.verifyRegistrationReady();
//         await webAuthn.registerWallet();
//         await authHelper.verifyRegistrationSuccess();

//         // Clear session
//         await authHelper.clearStorage();

//         // Monitor analytics for login
//         const analyticsRequests: string[] = [];
//         await page.route("**/analytics/**", (route) => {
//             analyticsRequests.push(route.request().url());
//             route.continue();
//         });

//         await authHelper.navigateToLogin();
//         await authHelper.verifyLoginReady();
//         await webAuthn.loginWallet();
//         await authHelper.verifyWalletDashboard();

//         // Verify analytics events were tracked
//         expect(analyticsRequests.length).toBeGreaterThan(0);
//         const hasLoginEvent = analyticsRequests.some(
//             (url) => url.includes("login") || url.includes("signin")
//         );
//         expect(hasLoginEvent).toBeTruthy();
//     });
// });
