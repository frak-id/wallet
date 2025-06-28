# Frak Wallet E2E Testing Strategy

## Overview

This document outlines the comprehensive end-to-end testing strategy for the Frak Wallet - a sophisticated blockchain smart wallet that leverages **pure biometric authentication** via WebAuthn with no traditional usernames, passwords, or forms.

## 🎯 **Key Insights from Implementation**

### Authentication Model
- **Pure Biometric**: No usernames, emails, or passwords - only WebAuthn/biometrics
- **Register Button**: `"Create your wallet * in a second with biometry"`
- **Login Button**: `"Recover your wallet"`
- **Success Indicator**: Redirect to `/wallet` page

### UI Structure Discoveries
- **No `data-testid` attributes**: Use text content selectors instead
- **CSS Modules**: Generated class names with hashes (e.g., `_buttonAuth_14w03_1`)
- **ButtonAuth Component**: Main authentication UI component
- **Wallet Dashboard**: Located at `/wallet` route with grid-based layout

## Architecture Understanding

### User Types
- **On-Device Users**: Users authenticating with biometry directly on their device via WebAuthn
- **Remote Users**: Users scanning QR codes to pair their session with another browser/device

### Deployment Modes  
- **Standalone Mode**: Full wallet webapp with complete feature access
- **Embedded Mode**: iframe integration within external websites via SDK

### Core Authentication Flows
- **Registration**: Biometric setup with WebAuthn credential creation
- **Login**: WebAuthn authentication with existing credentials
- **Recovery**: Account recovery mechanisms  
- **Pairing**: QR code-based cross-device authentication

## 🚀 **Working Test Implementation**

### Test Matrix

| Flow | Status | Test File | Key Insights |
|------|--------|-----------|--------------|
| ✅ Basic Registration | Working | `on-device-register.spec.ts` | Uses `"Create your wallet"` button text |
| ✅ Basic Login | Working | `on-device-login.spec.ts` | Uses `"Recover your wallet"` button text |
| ✅ Registration + Login | Working | `example.spec.ts` | Complete flow validation |
| ⚠️ Error Scenarios | Partial | Various | Need better error detection |
| ❌ Analytics | Failing | Various | No analytics endpoints found |

### Working Selectors

```typescript
// ✅ WORKING - Use these selectors
"button:has-text('Create your wallet')"  // Registration
"button:has-text('Recover your wallet')" // Login

// ❌ DON'T USE - These don't exist
"[data-testid='register-button']"        // No data-testids
"button.buttonAuth"                      // CSS modules hash classes
"button:has-text('Login')"               // Wrong text content
```

## Test Organization Structure

```
tests/
├── README.md                          # This file
├── fixtures.ts                        # Main fixture exports
├── fixtures/                          # Test utilities
│   ├── webauthn.fixture.ts            # ✅ Working WebAuthn testing
│   ├── qrcode.fixture.ts              # QR code generation/scanning
│   └── i18n.fixture.ts                # i18n fixtures
├── specs/
│   └── authentication/               # Auth flow tests
│       ├── on-device-register.spec.ts  # ✅ Working registration
│       └── on-device-login.spec.ts     # ✅ Working login
├── helpers/                          # Test utilities
│   └── auth.helper.ts                 # ✅ Working navigation/interaction helpers
└── example.spec.ts                   # ✅ Working complete flow example
```

## 🔧 **Best Practices for Frak Wallet Testing**

### 1. Selector Strategy
```typescript
// ✅ DO: Use text content selectors
await page.click("button:has-text('Create your wallet')");

// ✅ DO: Use partial class matching for CSS modules
await page.waitForSelector("button[class*='buttonAuth']");

// ❌ DON'T: Rely on exact CSS class names
await page.click("button._buttonAuth_14w03_1"); // Hash changes

// ❌ DON'T: Expect data-testid attributes
await page.click("[data-testid='register-button']"); // Don't exist
```

### 2. WebAuthn Testing Setup
```typescript
// ✅ Virtual Authenticator Configuration
await webAuthn.enableVirtualAuthenticator({
    protocol: "ctap2",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
});
```

### 3. Success Detection
```typescript
// ✅ Check for wallet page redirect
await page.waitForURL(/.*\/wallet.*/, { timeout: 15000 });

// ✅ Verify wallet components loaded
await Promise.race([
    page.waitForSelector('[class*="grid"]', { timeout: 10000 }),
    page.waitForSelector('[class*="balance"]', { timeout: 10000 }),
    page.waitForSelector('main', { timeout: 10000 }),
]);
```

### 4. Error Handling
```typescript
// ✅ Look for generic error indicators
const errorSelectors = [
    "text=error",
    "text=failed", 
    "[class*='error']",
    "[class*='notice']",
];

// ⚠️ Be flexible with error messages
// The app may not show detailed error messages for security
```

### 5. Test Isolation
```typescript
// ✅ Clean up after each test
test.afterEach(async ({ webAuthn }) => {
    await webAuthn.cleanup(); // Removes virtual authenticator
});

// ⚠️ Storage clearing is commented out in auth helper
// The wallet may handle persistence differently
```

## 🏃 **Running the Tests**

### Environment Commands
```bash
# Local development (default)
bun run test:e2e

# Against dev environment
bun run test:e2e:dev

# Against production (for verification)
bun run test:e2e:prod

# Interactive UI mode (dev env)
bun run test:e2e:dev:ui

# View test reports
bun run test:e2e:report
```

### Running Specific Tests
```bash
# Core working tests
bun run test:e2e:dev --grep "should register new wallet"
bun run test:e2e:dev --grep "should login existing wallet"
bun run test:e2e:dev --grep "Example Biometric Wallet Tests"

# All authentication tests (some may fail)
bun run test:e2e:dev --grep "authentication"

# Single test file
bun run test:e2e:dev tests/example.spec.ts
```

## 🐛 **Common Issues & Solutions**

### Issue: Button Not Found
```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log: - waiting for locator('button.buttonAuth') to be visible
```
**Solution**: Use text content selectors instead:
```typescript
await page.waitForSelector("button:has-text('Create your wallet')");
```

### Issue: CSS Module Classes
```
Error: Button class '_buttonAuth_abc123_1' not found
```
**Solution**: Use partial class matching:
```typescript
await page.waitForSelector("button[class*='buttonAuth']");
```

### Issue: WebAuthn Ceremony Fails
```
Error: Virtual authenticator not enabled
```
**Solution**: Ensure virtual authenticator is set up before navigation:
```typescript
await webAuthn.enableVirtualAuthenticator();
await authHelper.navigateToRegister();
```

### Issue: Test Flakiness
**Solutions**:
- Use longer timeouts for WebAuthn operations (15-20 seconds)
- Wait for `networkidle` before interactions
- Use `Promise.race()` for multiple success indicators

## 📊 **Test Environments**

| Environment | URL | Purpose | Status |
|-------------|-----|---------|--------|
| Local | `http://127.0.0.1:3000` | Development | ✅ Working |
| Dev | `https://wallet-dev.frak.id` | Integration | ✅ Working |
| Prod | `https://wallet.frak.id` | E2E Validation | ⚠️ Use carefully |

## 🔐 **Security Considerations**

1. **Test Data**: Virtual authenticators only - no real biometric data
2. **Credentials**: Test credentials are automatically cleaned up
3. **Network**: Tests use dev environment by default
4. **Storage**: Be careful with persistent storage clearing

## 🎯 **Current Implementation Status**

### ✅ Phase 1: Foundation (COMPLETE)
- ✅ WebAuthn fixture with virtual authenticator
- ✅ Real selectors for register/login buttons
- ✅ Basic authentication flow tests
- ✅ Wallet access verification

### 🔄 Phase 2: Core Features (IN PROGRESS)
- ⚠️ Error scenario testing (needs better error detection)
- ❌ Analytics tracking tests (endpoints not found)
- ❌ Different authenticator types (USB test failing)
- ❌ Network error simulation (not showing errors)

### 📋 Phase 3: Advanced Scenarios (PLANNED)
- QR code pairing tests
- Cross-device authentication
- Embedded mode testing
- Recovery flow testing

### 🚀 Phase 4: CI/CD Integration (PLANNED)
- GitHub Actions integration
- Automated test runs on PR
- Performance regression detection

## 🏗️ **Extending the Test Suite**

### Adding New Authentication Tests
```typescript
test("should test new auth scenario", async ({ webAuthn, authHelper }) => {
    // 1. Setup virtual authenticator
    await webAuthn.enableVirtualAuthenticator();
    
    // 2. Navigate and verify page ready
    await authHelper.navigateToRegister();
    await authHelper.verifyRegistrationReady();
    
    // 3. Perform action
    await webAuthn.registerWallet();
    
    // 4. Verify result
    await authHelper.verifyRegistrationSuccess();
    
    // 5. Cleanup happens automatically in afterEach
});
```

### Adding New Fixtures
```typescript
// Create new fixture in fixtures/ directory
export class NewFixture {
    constructor(private page: Page) {}
    
    async newMethod(): Promise<void> {
        // Implementation
    }
}

// Add to fixtures.ts
export const test = base.extend<WalletFixtures>({
    // ... existing fixtures
    newFixture: async ({ page }, use) => {
        await use(new NewFixture(page));
    },
});
```

## 📈 **Metrics & Monitoring**

### Test Success Metrics
- **Core Auth Success Rate**: ✅ 100% (register + login working)
- **Error Scenario Coverage**: ⚠️ ~20% (needs better error detection)
- **Cross-Device Compatibility**: ❌ 0% (not implemented yet)
- **Performance**: Fast (2-4 seconds per test)

### Known Limitations
1. **Error Messages**: App doesn't show detailed error messages
2. **Analytics**: No analytics endpoints found in dev environment
3. **Storage**: Persistence behavior not fully understood
4. **Recovery**: Recovery flow testing not implemented

## 🤝 **Contributing to Tests**

### Before Adding Tests
1. Run existing tests to understand current behavior
2. Use the debug pattern to inspect page structure:
   ```typescript
   // Take screenshot
   await page.screenshot({ path: "debug.png", fullPage: true });
   
   // Log buttons
   const buttons = await page.locator("button").all();
   for (const button of buttons) {
       console.log(await button.textContent());
   }
   ```

### Test Review Checklist
- [ ] Uses text content selectors, not CSS classes
- [ ] Handles WebAuthn virtual authenticator properly
- [ ] Includes proper cleanup in `afterEach`
- [ ] Has realistic timeouts (10-15 seconds for auth operations)
- [ ] Tests actual wallet behavior, not assumptions

### Performance Guidelines
- Keep tests focused and atomic
- Use parallel execution when possible
- Avoid unnecessary waits or sleeps
- Clean up resources properly

---

**This testing strategy provides a solid foundation for testing the Frak Wallet's biometric authentication flows while working with the real app structure and constraints.** 