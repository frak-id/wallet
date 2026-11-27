// tours: each page tour from its Help button, every step on its data-tour target, the full tour from a page tour, and the wizard tours.
import { openFromSidebar } from "./nav.mjs";

const NAMES = {
    en: {
        help: "Help",
        next: "Next",
        done: "Done",
        fullTour: "Show the full tour",
        skip: "Skip tour",
        draft: "Draft",
        edit: "Edit campaign",
        continue: "Continue",
        progress: (current, total) => `Step ${current} of ${total}`,
    },
    fr: {
        help: "Aide",
        next: "Suivant",
        done: "Terminer",
        fullTour: "Afficher la visite complète",
        skip: "Passer la visite",
        draft: "Brouillon",
        edit: "Modifier la campagne",
        continue: "Continuer",
        progress: (current, total) => `Étape ${current} sur ${total}`,
    },
};

const DRAFT = "Draft Campaign - Registration Focus";

const WELCOME = [
    null,
    "nav-stores",
    "store-budget",
    null,
    "nav-campaigns",
    "nav-members",
    "account-menu",
    "page-tour-button",
];

const WIZARD_TOURS = [
    ["budget", "wizard-budget", "campaign-budget-amount"],
    ["reward", "wizard-reward", "campaign-reward-model"],
    ["validation", "wizard-review", "campaign-publish"],
];

export default async ({ page, step, expect }) => {
    // <html lang> stays "en" in French, so read the browser locale instead.
    const isFrench = (await page.evaluate(() => navigator.language)).startsWith(
        "fr"
    );
    const t = NAMES[isFrench ? "fr" : "en"];
    const card = page.locator(".driver-popover");
    const progress = card.locator(".driver-popover-progress-text");
    const help = page.getByRole("button", { name: t.help, exact: true });

    const expectHighlight = async (target, label) => {
        // driver.js moves the highlight after its ~400 ms step animation.
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () =>
                            document
                                .querySelector(".driver-active-element")
                                ?.getAttribute("data-tour") ?? null
                    ),
                { message: `${label} highlight` }
            )
            .toBe(target);
    };

    const openTour = async (total, { keyboard = false } = {}) => {
        if (keyboard) {
            await help.focus();
            await page.keyboard.press("Enter");
        } else {
            await help.click();
        }
        await expect(card).toHaveAttribute("role", "dialog");
        // The tour must survive the cancelled start of the one it superseded.
        await page.waitForTimeout(1500);
        await expect(card).toBeVisible();
        await expect(progress).toHaveText(t.progress(1, total));
        await expect(help).toHaveAttribute("aria-expanded", "true");
    };

    const walkTour = async (name, targets, { fullTour = true } = {}) => {
        await expect(
            card.getByRole("button", { name: t.fullTour })
        ).toHaveCount(fullTour ? 1 : 0);
        for (const [index, target] of targets.entries()) {
            await expect(progress).toHaveText(
                t.progress(index + 1, targets.length)
            );
            await expectHighlight(target, `${name} step ${index + 1}`);
            if (index === 0) await step(`${name}-first`);
            if (index < targets.length - 1) {
                await card.getByRole("button", { name: t.next }).click();
            }
        }
        await step(`${name}-last`);
        await card.getByRole("button", { name: t.done }).click();
        await expect(card).toHaveCount(0);
        await expect(help).toHaveAttribute("aria-expanded", "false");
    };

    // Opened from the keyboard: WebKit does not focus a clicked button.
    await openTour(4, { keyboard: true });
    await walkTour("stores", [null, "store-budget", "store-edit", "add-store"]);
    await expect(help).toBeFocused();

    await openTour(4);
    await card.getByRole("button", { name: t.fullTour }).click();
    for (const [index, target] of WELCOME.entries()) {
        await expect(progress).toHaveText(
            t.progress(index + 1, WELCOME.length)
        );
        await expectHighlight(target, `welcome step ${index + 1}`);
        const isLast = index === WELCOME.length - 1;
        await expect(card.getByRole("button", { name: t.skip })).toHaveCount(
            isLast ? 0 : 1
        );
        if (index === 3 || isLast) await step(`welcome-${index + 1}`);
        if (!isLast) await card.getByRole("button", { name: t.next }).click();
    }
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);

    await openFromSidebar(page, "/members");
    await openTour(3);
    await walkTour("members", [null, null, "members-push-tab"]);

    await openFromSidebar(page, "/campaigns/list");
    await openTour(4);
    await walkTour("campaigns-list", [null, null, null, "new-campaign"]);

    await page.getByRole("tab", { name: t.draft }).click();
    await page.getByRole("cell", { name: DRAFT, exact: true }).click();
    await page
        .getByRole("dialog", { name: DRAFT })
        .getByRole("link", { name: t.edit })
        .click();
    await expect(page).toHaveURL(/\/campaigns\/draft\/camp_003$/);
    await openTour(1);
    await walkTour("wizard", ["wizard-steps"], { fullTour: false });

    const heading = page.getByRole("heading", { level: 1 });
    const continueButton = page.getByRole("button", {
        name: t.continue,
        exact: true,
    });
    for (const [segment, name, target] of WIZARD_TOURS) {
        const url = new RegExp(`/camp_003/${segment}$`);
        while (!url.test(page.url())) {
            // The URL changes before the next screen renders: wait on the heading.
            const before = await heading.textContent();
            await continueButton.click();
            await expect(heading).not.toHaveText(before);
        }
        await openTour(1);
        await walkTour(name, [target], { fullTour: false });
    }
};
