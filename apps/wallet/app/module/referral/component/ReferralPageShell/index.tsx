import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { TermsDisclosure } from "../TermsDisclosure";
import * as styles from "./index.css";

type Props = {
    /** Fallback when there is no history to pop, e.g. a deep link. */
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
    const router = useRouter();
    const navigate = useNavigate();
    const canGoBack = useCanGoBack();
    // Back returns to the opener (game page, profile…); redirects between referral pages use replace.
    const goBack = () =>
        canGoBack ? router.history.back() : navigate({ to: backHref });

    return (
        <Stack space="m" className={styles.page}>
            <Stack space="m">
                <Back onClick={goBack} />
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
