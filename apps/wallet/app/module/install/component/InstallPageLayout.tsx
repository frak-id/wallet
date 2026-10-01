import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { CloseIcon, LogoFrakWithName } from "@frak-labs/design-system/icons";
import { ExternalLink } from "@frak-labs/wallet-shared/common/component/ExternalLink";
import type { ReactNode } from "react";
import * as styles from "./install.css";

type InstallPageLayoutProps = {
    /** A native host draws its own chrome: no header then. */
    chromeless: boolean;
    /** Shown before the Frak logo, e.g. the merchant's. */
    headerLogo?: ReactNode;
    /** Only for a page opened as a popup: `window.close()` is a no-op in a tab. */
    dismiss?: { label: string; onDismiss: () => void };
    hero: ReactNode;
    /** Rest of `<main>`, under the hero. */
    children?: ReactNode;
    /** Between `<main>` and the footer. */
    aside?: ReactNode;
    storeLink: { href: string; label: string; onClick: () => void };
};

export function InstallPageLayout({
    chromeless,
    headerLogo,
    dismiss,
    hero,
    children,
    aside,
    storeLink,
}: InstallPageLayoutProps) {
    return (
        <div
            className={
                chromeless
                    ? `${styles.container} ${styles.containerChromeless}`
                    : styles.container
            }
        >
            {!chromeless && (
                <Box
                    as="header"
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    paddingX="m"
                    paddingY="xs"
                    backgroundColor="background"
                    position="sticky"
                    className={styles.header}
                >
                    <Inline space="m" alignY="center" wrap={false}>
                        {headerLogo}
                        <LogoFrakWithName className={styles.logo} />
                    </Inline>
                    {dismiss && (
                        <Button
                            variant="ghost"
                            size="none"
                            width="auto"
                            aria-label={dismiss.label}
                            className={styles.dismissButton}
                            onClick={dismiss.onDismiss}
                        >
                            <CloseIcon width={24} height={24} />
                        </Button>
                    )}
                </Box>
            )}

            <Stack as="main" space="l" padding="m" className={styles.main}>
                <Stack as="section" space="xs" className={styles.heroSection}>
                    {hero}
                </Stack>
                {children}
            </Stack>

            {aside}

            <Stack as="footer" space="s" className={styles.footer}>
                <ExternalLink
                    href={storeLink.href}
                    className={styles.downloadButton}
                    onClick={storeLink.onClick}
                >
                    {storeLink.label}
                </ExternalLink>
            </Stack>
        </div>
    );
}
