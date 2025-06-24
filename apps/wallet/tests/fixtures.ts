import { test as base } from "@playwright/test";
import { DeviceHelper } from "./helpers/device.helper";
import { MultiTabHelper } from "./helpers/multi-tab.helper";
import { QRCodeHelper } from "./helpers/qrcode.helper";
import { WebAuthnHelper } from "./helpers/webauthn.helper";

type MyFixtures = {
    webAuthnHelper: WebAuthnHelper;
    deviceHelper: DeviceHelper;
    multiTabHelper: MultiTabHelper;
    qrCodeHelper: QRCodeHelper;
};

export const test = base.extend<MyFixtures>({
    webAuthnHelper: async ({ page }, use) => {
        await use(new WebAuthnHelper(page));
    },
    deviceHelper: async ({ page }, use) => {
        await use(new DeviceHelper(page));
    },
    multiTabHelper: async ({ context }, use) => {
        await use(new MultiTabHelper(context));
    },
    qrCodeHelper: async ({ page }, use) => {
        await use(new QRCodeHelper(page));
    },
});

export { expect } from "@playwright/test";
