import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AmbassadorPhoneTexts } from "../index";
import { AmbassadorPhonePreview } from "../index";

const texts: AmbassadorPhoneTexts = {
    heroEyebrow: "Ambassador program",
    heroTitle: "Become an ambassador for {BRAND}",
    heroLede: "Earn {REWARD} as soon as someone buys",
    heroCtaLabel: "Become an ambassador",
    heroFacesCaption: "No form, no waiting.",
    heroRewardCaption: "for you, on every sale",
    heroPill: "+ {REWARD} for your friend",
    rewardEyebrow: "Referral program",
    rewardHeading: "{REWARD} for you on every sale",
    rewardEstimateCaption: "Estimate: it depends on the order.",
    rewardLede: "No cap.",
    rewardCtaLabel: "Get my link",
    rewardFooterCaption: "Free · no commitment",
    explainerTitle: "How it works",
    explainerLede: "Three steps.",
    explainerStep1Title: "I share",
    explainerStep1Description: "My unique link",
    explainerStep2Title: "I get paid",
    explainerStep2Description: "Credited automatically",
    explainerStep3Title: "I collect my money",
    explainerStep3Description: "Transfer to my bank account",
    winWinHeading: "Your friends win too",
    winWinLede: "They get cashback",
    winWinCard1Title: "You",
    winWinCard1Description: "to your wallet, on every sale",
    winWinCard2Title: "Your friend",
    winWinCard2Description: "{REWARD} cashback on their first order",
    referralHeading: "Your ambassador link",
    referralLede: "A program that really pays",
    referralCtaLabel: "Share my link",
    storeHeading: "Track your earnings",
    storeLede: "The app notifies you",
    storeQrCaption: "Scan to install",
    faqHeading: "Frequently asked questions",
    faq1Question: "Is it really free?",
    faq1Answer: "Yes, completely free.",
    faq2Question: "When do I get my money?",
    faq2Answer: "Once the purchase is confirmed.",
    faq3Question: "Do my friends pay more?",
    faq3Answer: "No, they get {REWARD} cashback.",
    faq4Question: "Do I need to be an influencer?",
    faq4Answer: "No, not at all.",
    faq5Question: "What is Frak?",
    faq5Answer: "The partner handling payouts for {BRAND}.",
    attributionBeforeLink: "Program powered by ",
    attributionLinkText: "Frak",
};

const base = { texts, currency: "eur" as const, shopName: "Nowa" };

describe("AmbassadorPhonePreview", () => {
    it("renders the seven sections with the sample amounts", () => {
        const { container } = render(<AmbassadorPhonePreview {...base} />);

        expect(
            screen.getByText("Become an ambassador for Nowa")
        ).toBeInTheDocument();
        expect(
            screen.getByText("42 € for you on every sale")
        ).toBeInTheDocument();
        expect(screen.getByText("How it works")).toBeInTheDocument();
        expect(screen.getByText("Your friends win too")).toBeInTheDocument();
        expect(screen.getByText("Your ambassador link")).toBeInTheDocument();
        expect(screen.getByText("Track your earnings")).toBeInTheDocument();
        expect(
            screen.getByText("Frequently asked questions")
        ).toBeInTheDocument();

        expect(screen.getByTestId("hero-amount")).toHaveTextContent("42 €");
        expect(screen.getByTestId("friend-amount")).toHaveTextContent("10 €");
        expect(screen.getByText("+ 10 € for your friend")).toBeInTheDocument();

        const phone = screen.getByTestId("ambassador-phone-preview");
        expect(phone).toHaveAttribute("aria-hidden", "true");
        expect(container.querySelector("a")).toBeNull();
        expect(container.querySelector("button")).toBeNull();
    });

    it("fills the friend slots with 10 and honours the currency", () => {
        render(
            <AmbassadorPhonePreview
                {...base}
                currency="usd"
                focus={{ slot: "faq3Answer", counter: 1 }}
            />
        );

        expect(screen.getByTestId("hero-amount")).toHaveTextContent("$42");
        expect(screen.getByTestId("friend-amount")).toHaveTextContent("$10");
        expect(screen.getByText("+ $10 for your friend")).toBeInTheDocument();
        expect(
            screen.getByText("No, they get $10 cashback.")
        ).toBeInTheDocument();
    });

    it("collapses the hero frame without a photo and draws it with one", () => {
        const withoutPhoto = render(<AmbassadorPhonePreview {...base} />);
        expect(withoutPhoto.container.querySelectorAll("img")).toHaveLength(1);
        expect(screen.getByTestId("hero-amount")).toBeInTheDocument();

        withoutPhoto.unmount();

        const withPhoto = render(
            <AmbassadorPhonePreview
                {...base}
                imageUrl="https://cdn.example.com/hero.jpg"
            />
        );
        expect(withPhoto.container.querySelectorAll("img")).toHaveLength(2);
        expect(
            withPhoto.container.querySelector(
                'img[src="https://cdn.example.com/hero.jpg"]'
            )
        ).not.toBeNull();
    });

    it("opens only the first FAQ question when nothing is focused", () => {
        render(<AmbassadorPhonePreview {...base} />);

        expect(screen.getByText("Yes, completely free.")).toBeInTheDocument();
        expect(
            screen.queryByText("Once the purchase is confirmed.")
        ).not.toBeInTheDocument();
    });

    it("on a new focus counter opens the FAQ item, highlights it and scrolls only the phone", () => {
        const { rerender } = render(<AmbassadorPhonePreview {...base} />);
        const scroll = screen.getByTestId("ambassador-phone-scroll");
        const setScrollTop = vi.spyOn(scroll, "scrollTop", "set");
        const windowScroll = vi
            .spyOn(window, "scrollTo")
            .mockImplementation(() => {});

        rerender(
            <AmbassadorPhonePreview
                {...base}
                focus={{ slot: "faq4Answer", counter: 1 }}
            />
        );

        const answer = screen.getByText("No, not at all.");
        expect(answer).toBeInTheDocument();
        expect(answer).toHaveAttribute("data-highlighted", "true");
        expect(setScrollTop).toHaveBeenCalled();
        expect(windowScroll).not.toHaveBeenCalled();
        expect(window.scrollY).toBe(0);
    });

    it("highlights again on a new counter but not on a same-counter re-render", () => {
        vi.useFakeTimers();
        try {
            const { rerender } = render(<AmbassadorPhonePreview {...base} />);
            const answer = () => screen.getByText("No, not at all.");

            rerender(
                <AmbassadorPhonePreview
                    {...base}
                    focus={{ slot: "faq4Answer", counter: 1 }}
                />
            );
            expect(answer()).toHaveAttribute("data-highlighted", "true");

            act(() => {
                vi.advanceTimersByTime(2000);
            });
            expect(answer()).not.toHaveAttribute("data-highlighted");

            rerender(
                <AmbassadorPhonePreview
                    {...base}
                    focus={{ slot: "faq4Answer", counter: 1 }}
                />
            );
            expect(answer()).not.toHaveAttribute("data-highlighted");

            rerender(
                <AmbassadorPhonePreview
                    {...base}
                    focus={{ slot: "faq4Answer", counter: 2 }}
                />
            );
            expect(answer()).toHaveAttribute("data-highlighted", "true");
        } finally {
            vi.useRealTimers();
        }
    });

    it("opens the whole FAQ 5 answer when it is focused", () => {
        render(
            <AmbassadorPhonePreview
                {...base}
                focus={{ slot: "faq5Answer", counter: 1 }}
            />
        );

        expect(
            screen.getByText("The partner handling payouts for Nowa.")
        ).toHaveAttribute("data-highlighted", "true");
    });

    it("highlights the hero art when the photo choice is focused", () => {
        render(
            <AmbassadorPhonePreview
                {...base}
                focus={{ slot: "hero", counter: 1 }}
            />
        );

        expect(
            screen.getByTestId("hero-amount").closest("[data-slot]")
        ).toHaveAttribute("data-highlighted", "true");
    });

    it("labels the store badges as neutral placeholders", () => {
        render(<AmbassadorPhonePreview {...base} />);

        expect(screen.getByText("App Store")).toBeInTheDocument();
        expect(screen.getByText("Google Play")).toBeInTheDocument();
    });
});
