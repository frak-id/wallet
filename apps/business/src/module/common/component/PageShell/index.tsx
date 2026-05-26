import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { type PageKey, pageTitle } from "@/module/common/i18n/pageLabel";

type PageShellProps = { children: ReactNode } & (
    | { page: PageKey; title?: never }
    | { title: string; page?: never }
);

export function PageShell({ page, title, children }: PageShellProps) {
    const { t } = useTranslation();
    const heading = page ? pageTitle(t, page) : title;
    return (
        <Stack space="xxl">
            <Text as="h1" variant="heading1" weight="bold">
                {heading}
            </Text>
            {children}
        </Stack>
    );
}
