import type { ReactNode } from "react";

interface Tab {
    id: string;
    content: string;
}

interface TabsProps {
    tabs: Tab[];
    selected: number;
    onSelect: (index: number) => void;
    children?: ReactNode;
}

/**
 * Tab switcher for App Home. No native `s-tabs` exists, so it's hand-rolled
 * from native `s-press-button`s — admin theming/hover/focus for free, no
 * hardcoded colors; `pressed` is the active affordance.
 *
 * Native toggle-button-group, not ARIA tablist: the focusable element is in
 * the shadow root (out of reach of a roving `tabindex`) and
 * `accessibilityRole` has no `tablist`/`tab`. Buttons stay tab/Enter-focusable
 * and `aria-pressed` conveys selection.
 *
 * `s-press-button` self-toggles its internal pressed state on click (no change
 * event), so clicking the active tab would unpress it while our prop is
 * unchanged — force `pressed = true` on click before `onSelect`.
 */
export function Tabs({ tabs, selected, onSelect, children }: TabsProps) {
    return (
        <s-stack gap="base">
            <s-stack direction="inline" gap="small-100">
                {tabs.map((tab, index) => (
                    <s-press-button
                        key={tab.id}
                        variant="tertiary"
                        pressed={selected === index}
                        onClick={(e) => {
                            (
                                e.currentTarget as unknown as {
                                    pressed: boolean;
                                }
                            ).pressed = true;
                            onSelect(index);
                        }}
                    >
                        {tab.content}
                    </s-press-button>
                ))}
            </s-stack>
            {children && <s-stack>{children}</s-stack>}
        </s-stack>
    );
}
