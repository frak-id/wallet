import { type ComponentType, lazy, type ReactNode, Suspense } from "react";

export const categories = [
    "Typography",
    "Layout",
    "Controls",
    "Feedback",
    "Overlays",
    "Data",
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
        "spread",
        "Spread",
        "Layout",
        () => import("./sections/layout"),
        "SpreadSection"
    ),
    section(
        "content-block",
        "ContentBlock",
        "Layout",
        () => import("./sections/layout"),
        "ContentBlockSection"
    ),
    section(
        "icon-circle",
        "IconCircle",
        "Layout",
        () => import("./sections/layout"),
        "IconCircleSection"
    ),
    section(
        "columns",
        "Columns",
        "Layout",
        () => import("./sections/layout"),
        "ColumnsSection"
    ),
    section(
        "accordion",
        "Accordion",
        "Layout",
        () => import("./sections/layout"),
        "AccordionSection"
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
        "radio-group",
        "RadioGroup",
        "Controls",
        () => import("./sections/controls"),
        "RadioGroupSection"
    ),
    section(
        "field-label",
        "FieldLabel",
        "Controls",
        () => import("./sections/controls"),
        "FieldLabelSection"
    ),
    section(
        "field-error",
        "FieldError",
        "Controls",
        () => import("./sections/controls"),
        "FieldErrorSection"
    ),
    section(
        "text-area",
        "TextArea",
        "Controls",
        () => import("./sections/controls"),
        "TextAreaSection"
    ),
    section(
        "time-input",
        "TimeInput",
        "Controls",
        () => import("./sections/controls"),
        "TimeInputSection"
    ),
    section(
        "stepper",
        "Stepper",
        "Controls",
        () => import("./sections/controls"),
        "StepperSection"
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
        "empty-state",
        "EmptyState",
        "Feedback",
        () => import("./sections/feedback"),
        "EmptyStateSection"
    ),
    section(
        "alert-message",
        "AlertMessage",
        "Feedback",
        () => import("./sections/feedback"),
        "AlertMessageSection"
    ),
    section(
        "progress-bar",
        "ProgressBar",
        "Feedback",
        () => import("./sections/feedback"),
        "ProgressBarSection"
    ),
    section(
        "numbered-circle",
        "NumberedCircle",
        "Feedback",
        () => import("./sections/feedback"),
        "NumberedCircleSection"
    ),
    section(
        "avatar",
        "Avatar",
        "Feedback",
        () => import("./sections/feedback"),
        "AvatarSection"
    ),
    section(
        "delta-indicator",
        "DeltaIndicator",
        "Feedback",
        () => import("./sections/feedback"),
        "DeltaIndicatorSection"
    ),
    section(
        "status-banner",
        "StatusBanner",
        "Feedback",
        () => import("./sections/feedback"),
        "StatusBannerSection"
    ),
    section(
        "banner-stack",
        "BannerStack",
        "Feedback",
        () => import("./sections/feedback"),
        "BannerStackSection"
    ),
    section(
        "in-app-banner",
        "InAppBanner",
        "Feedback",
        () => import("./sections/feedback"),
        "InAppBannerSection"
    ),
    section(
        "toast-surface",
        "ToastSurface",
        "Feedback",
        () => import("./sections/overlays"),
        "ToastSurfaceSection"
    ),
    section(
        "dialog",
        "Dialog",
        "Overlays",
        () => import("./sections/overlays"),
        "DialogSection"
    ),
    section(
        "drawer",
        "Drawer",
        "Overlays",
        () => import("./sections/overlays"),
        "DrawerSection"
    ),
    section(
        "detail-sheet",
        "DetailSheet",
        "Overlays",
        () => import("./sections/overlays"),
        "DetailSheetSection"
    ),
    section(
        "responsive-modal",
        "ResponsiveModal",
        "Overlays",
        () => import("./sections/overlays"),
        "ResponsiveModalSection"
    ),
    section(
        "sheet",
        "Sheet",
        "Overlays",
        () => import("./sections/overlays"),
        "SheetSection"
    ),
    section(
        "popover",
        "Popover",
        "Overlays",
        () => import("./sections/overlays"),
        "PopoverSection"
    ),
    section(
        "alert-dialog",
        "AlertDialog",
        "Overlays",
        () => import("./sections/overlays"),
        "AlertDialogSection"
    ),
    section(
        "data-table",
        "DataTable",
        "Data",
        () => import("./sections/data"),
        "DataTableSection"
    ),
    section(
        "table",
        "Table",
        "Data",
        () => import("./sections/data"),
        "TableSection"
    ),
    section(
        "stat-card",
        "StatCard",
        "Data",
        () => import("./sections/data"),
        "StatCardSection"
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
