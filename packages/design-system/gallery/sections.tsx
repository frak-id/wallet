import { type ComponentType, lazy, type ReactNode, Suspense } from "react";

export const categories = [
    "Typography",
    "Layout",
    "Controls",
    "Feedback",
    "Charts",
] as const;

export type Category = (typeof categories)[number];

export type GallerySection = {
    id: string;
    title: string;
    category: Category;
    render: () => ReactNode;
};

// Sections load on demand so a spec running under Node can import this
// registry for its ids without evaluating any `.css.ts`.
function section<K extends string>(
    id: string,
    title: string,
    category: Category,
    load: () => Promise<Record<K, ComponentType>>,
    name: K
): GallerySection {
    const Section = lazy<ComponentType>(async () => ({
        default: (await load())[name],
    }));
    return {
        id,
        title,
        category,
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
        "Typography",
        () => import("./sections/typography"),
        "TextSection"
    ),
    section(
        "stack",
        "Stack",
        "Layout",
        () => import("./sections/layout"),
        "StackSection"
    ),
    section(
        "box",
        "Box",
        "Layout",
        () => import("./sections/layout"),
        "BoxSection"
    ),
    section(
        "inline",
        "Inline",
        "Layout",
        () => import("./sections/layout"),
        "InlineSection"
    ),
    section(
        "tiles",
        "Tiles",
        "Layout",
        () => import("./sections/layout"),
        "TilesSection"
    ),
    section(
        "card",
        "Card",
        "Layout",
        () => import("./sections/layout"),
        "CardSection"
    ),
    section(
        "button",
        "Button",
        "Controls",
        () => import("./sections/controls"),
        "ButtonSection"
    ),
    section(
        "input",
        "Input",
        "Controls",
        () => import("./sections/controls"),
        "InputSection"
    ),
    section(
        "select",
        "Select",
        "Controls",
        () => import("./sections/controls"),
        "SelectSection"
    ),
    section(
        "tabs",
        "Tabs",
        "Controls",
        () => import("./sections/controls"),
        "TabsSection"
    ),
    section(
        "switch",
        "Switch",
        "Controls",
        () => import("./sections/controls"),
        "SwitchSection"
    ),
    section(
        "checkbox",
        "Checkbox",
        "Controls",
        () => import("./sections/controls"),
        "CheckboxSection"
    ),
    section(
        "spinner",
        "Spinner",
        "Feedback",
        () => import("./sections/feedback"),
        "SpinnerSection"
    ),
    section(
        "notice",
        "Notice",
        "Feedback",
        () => import("./sections/feedback"),
        "NoticeSection"
    ),
    section(
        "skeleton",
        "Skeleton",
        "Feedback",
        () => import("./sections/feedback"),
        "SkeletonSection"
    ),
    section(
        "badge",
        "Badge",
        "Feedback",
        () => import("./sections/feedback"),
        "BadgeSection"
    ),
    section(
        "chart-sharing-pie",
        "Chart: sharing by source (pie)",
        "Charts",
        () => import("./sections/charts"),
        "SharingPieSection"
    ),
    section(
        "chart-projected-area",
        "Chart: projected revenue (area)",
        "Charts",
        () => import("./sections/charts"),
        "ProjectedAreaSection"
    ),
    section(
        "chart-purchases-bar",
        "Chart: purchases (bar, reference line)",
        "Charts",
        () => import("./sections/charts"),
        "PurchasesBarSection"
    ),
    section(
        "chart-affiliate-bar",
        "Chart: affiliate daily series (bar)",
        "Charts",
        () => import("./sections/charts"),
        "AffiliateBarSection"
    ),
    section(
        "chart-worst-case",
        "Chart: worst-case data",
        "Charts",
        () => import("./sections/charts"),
        "ChartWorstCaseSection"
    ),
];
