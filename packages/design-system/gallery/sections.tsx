import { type ComponentType, lazy, type ReactNode, Suspense } from "react";

export type GallerySection = {
    id: string;
    title: string;
    render: () => ReactNode;
};

// Sections load on demand so a spec running under Node can import this
// registry for its ids without evaluating any `.css.ts`.
function section<K extends string>(
    id: string,
    title: string,
    load: () => Promise<Record<K, ComponentType>>,
    name: K
): GallerySection {
    const Section = lazy<ComponentType>(async () => ({
        default: (await load())[name],
    }));
    return {
        id,
        title,
        render: () => (
            <Suspense fallback={null}>
                <Section />
            </Suspense>
        ),
    };
}

export const sections: readonly GallerySection[] = [
    section(
        "text",
        "Text",
        () => import("./sections/typography"),
        "TextSection"
    ),
    section(
        "stack",
        "Stack",
        () => import("./sections/layout"),
        "StackSection"
    ),
    section("box", "Box", () => import("./sections/layout"), "BoxSection"),
    section(
        "inline",
        "Inline",
        () => import("./sections/layout"),
        "InlineSection"
    ),
    section(
        "tiles",
        "Tiles",
        () => import("./sections/layout"),
        "TilesSection"
    ),
    section("card", "Card", () => import("./sections/layout"), "CardSection"),
    section(
        "button",
        "Button",
        () => import("./sections/controls"),
        "ButtonSection"
    ),
    section(
        "input",
        "Input",
        () => import("./sections/controls"),
        "InputSection"
    ),
    section(
        "select",
        "Select",
        () => import("./sections/controls"),
        "SelectSection"
    ),
    section("tabs", "Tabs", () => import("./sections/controls"), "TabsSection"),
    section(
        "switch",
        "Switch",
        () => import("./sections/controls"),
        "SwitchSection"
    ),
    section(
        "checkbox",
        "Checkbox",
        () => import("./sections/controls"),
        "CheckboxSection"
    ),
    section(
        "spinner",
        "Spinner",
        () => import("./sections/feedback"),
        "SpinnerSection"
    ),
    section(
        "notice",
        "Notice",
        () => import("./sections/feedback"),
        "NoticeSection"
    ),
    section(
        "skeleton",
        "Skeleton",
        () => import("./sections/feedback"),
        "SkeletonSection"
    ),
    section(
        "badge",
        "Badge",
        () => import("./sections/feedback"),
        "BadgeSection"
    ),
    section(
        "chart-sharing-pie",
        "Chart: sharing by source (pie)",
        () => import("./sections/charts"),
        "SharingPieSection"
    ),
    section(
        "chart-projected-area",
        "Chart: projected revenue (area)",
        () => import("./sections/charts"),
        "ProjectedAreaSection"
    ),
    section(
        "chart-purchases-bar",
        "Chart: purchases (bar, reference line)",
        () => import("./sections/charts"),
        "PurchasesBarSection"
    ),
    section(
        "chart-affiliate-bar",
        "Chart: affiliate daily series (bar)",
        () => import("./sections/charts"),
        "AffiliateBarSection"
    ),
    section(
        "chart-worst-case",
        "Chart: worst-case data",
        () => import("./sections/charts"),
        "ChartWorstCaseSection"
    ),
];
