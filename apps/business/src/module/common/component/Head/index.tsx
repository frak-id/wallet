import { Stack } from "@frak-labs/design-system/components/Stack";
import type { ReactNode } from "react";
import { Title, type TitleProps } from "@/module/common/component/Title";
import { head } from "./head.css";

type HeadProps = {
    title?: { content: string; size?: TitleProps["size"] };
    leftSection?: ReactNode;
    rightSection?: ReactNode;
};

export function Head({ title, leftSection, rightSection }: HeadProps) {
    const { content, size } = title ?? {};
    return (
        <div className={head}>
            <Stack space="xs">
                {title && <Title size={size ?? "medium"}>{content}</Title>}
                {leftSection}
            </Stack>
            {rightSection && <div>{rightSection}</div>}
        </div>
    );
}
