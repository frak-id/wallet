import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { TermsDisclosure } from "../TermsDisclosure";
import * as styles from "./index.css";

type Props = {
    backHref?: string;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
};

export function ReferralPageShell({
    backHref = "/profile/referral",
    title,
    description,
    children,
}: Props) {
    return (
        <Stack space="m" className={styles.page}>
            <Stack space="m">
                <Back href={backHref} />
                <Title size="page">{title}</Title>
            </Stack>
            {description ? (
                <Text variant="body" color="secondary">
                    {description}
                </Text>
            ) : null}
            {children}
            <Box className={styles.disclosure}>
                <TermsDisclosure />
            </Box>
        </Stack>
    );
}
