import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { page } from "./gallery.css";
import { sections } from "./sections";

/** `?only=<id>` renders one section so a spec can isolate its errors. */
const only = new URLSearchParams(window.location.search).get("only");
const visible = only ? sections.filter((s) => s.id === only) : sections;

export function Gallery() {
    return (
        <Box as="main" className={page}>
            <Stack space="xl">
                {visible.map(({ id, title, render }) => (
                    <section
                        key={id}
                        data-gallery-section={id}
                        aria-labelledby={`${id}-title`}
                    >
                        <Stack space="m">
                            <Box as="h2" id={`${id}-title`} tabIndex={-1}>
                                <Text as="span" variant="heading3">
                                    {title}
                                </Text>
                            </Box>
                            {render()}
                        </Stack>
                    </section>
                ))}
            </Stack>
        </Box>
    );
}
