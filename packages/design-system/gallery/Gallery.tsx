import { tablet } from "@frak-labs/design-system/breakpoints";
import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useSyncExternalStore } from "react";
import { Shell } from "./GalleryShell";
import { link, page, sectionBox } from "./gallery.css";
import { sections } from "./sections";

/** `?only=<id>` renders one section so a spec can isolate its errors. */
const only = new URLSearchParams(window.location.search).get("only");
const visible = only ? sections.filter((s) => s.id === only) : sections;

const wideQuery = `(min-width: ${tablet}px)`;

function subscribeWide(onChange: () => void) {
    const media = window.matchMedia(wideQuery);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

/** The shell only exists from the tablet breakpoint up and never in `?only`. */
export function Gallery() {
    const wide = useSyncExternalStore(
        subscribeWide,
        () => window.matchMedia(wideQuery).matches,
        () => false
    );
    return !only && wide ? <Shell /> : <StackedPage />;
}

function StackedPage() {
    return (
        <Box className={page}>
            <Stack space="xs" as="header">
                <Box as="h1">
                    <Text as="span" variant="heading1">
                        Design system gallery
                    </Text>
                </Box>
                <Text color="secondary">
                    <code>?only=&lt;id&gt;</code> isolates a section;{" "}
                    <code>
                        bun run --cwd packages/design-system test:gallery
                    </code>{" "}
                    checks it.
                </Text>
                {only && (
                    <Text>
                        <a className={link} href="/">
                            All sections
                        </a>
                    </Text>
                )}
            </Stack>
            <Box as="main" paddingY="l">
                <Stack space="xxl">
                    {visible.map(({ id, title, render }) => (
                        <section
                            key={id}
                            id={id}
                            className={sectionBox}
                            data-gallery-section={id}
                            aria-labelledby={`${id}-title`}
                        >
                            <Stack space="l">
                                <Inline space="m" alignY="baseline">
                                    <Box
                                        as="h2"
                                        id={`${id}-title`}
                                        tabIndex={-1}
                                    >
                                        <Text as="span" variant="heading3">
                                            {title}
                                        </Text>
                                    </Box>
                                    {!only && (
                                        <a
                                            className={link}
                                            href={`?only=${id}`}
                                        >
                                            <Text as="span" variant="bodySmall">
                                                Open alone
                                            </Text>
                                        </a>
                                    )}
                                </Inline>
                                <Stack space="xl">{render()}</Stack>
                            </Stack>
                        </section>
                    ))}
                </Stack>
            </Box>
        </Box>
    );
}
