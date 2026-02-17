import type { PropsWithChildren } from "react";

export function Instructions({
    badgeText,
    todoText,
    image,
    children,
}: PropsWithChildren<{
    badgeText: string;
    todoText: string;
    image: string;
}>) {
    return (
        <s-stack gap="base">
            <s-text>
                <s-badge tone="critical" icon="x">
                    {badgeText}
                </s-badge>
            </s-text>
            <s-text>{todoText}</s-text>
            <div>
                <img src={image} alt="" />
            </div>
            <s-text>{children}</s-text>
        </s-stack>
    );
}
