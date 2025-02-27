import {
    Arrow,
    Content,
    Portal,
    Provider,
    Root,
    Trigger,
} from "@radix-ui/react-tooltip";
import type { ComponentPropsWithRef, ReactNode } from "react";
import styles from "./index.module.css";

type TooltipProps = ComponentPropsWithRef<typeof Content> & {
    content: string | ReactNode;
    hidden?: boolean;
    className?: string;
    children: ReactNode;
    side?: "top" | "bottom" | "left" | "right";
};

export const Tooltip = ({
    ref,
    content,
    hidden = false,
    className = "",
    children,
    side,
    ...props
}: TooltipProps) => {
    if (hidden) {
        return children;
    }
    return (
        <Provider>
            <Root delayDuration={0}>
                <Trigger
                    className={styles.tooltip__trigger}
                    onClick={(e) => e.preventDefault()}
                    asChild
                >
                    {children}
                </Trigger>
                <Portal>
                    <Content
                        onPointerDownOutside={(e) => e.preventDefault()}
                        className={`${styles.tooltip__content} ${className}`}
                        sideOffset={0}
                        side={side}
                        ref={ref}
                        {...props}
                    >
                        <>
                            {content}
                            <Arrow className={styles.tooltip__arrow} />
                        </>
                    </Content>
                </Portal>
            </Root>
        </Provider>
    );
};

Tooltip.displayName = Provider.displayName;
