import { type Page, test } from "@playwright/test";

export class DeviceHelper {
    constructor(private page: Page) {}

    isMobile() {
        return (this.page.viewportSize()?.width ?? 0) < 768;
    }

    isDesktop() {
        return !this.isMobile();
    }

    skipOnMobile(reason = "Test not applicable on mobile") {
        test.skip(this.isMobile(), reason);
    }

    skipOnDesktop(reason = "Test not applicable on desktop") {
        test.skip(this.isDesktop(), reason);
    }
}
