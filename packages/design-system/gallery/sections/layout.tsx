import { Box } from "@frak-labs/design-system/components/Box";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import type { ComponentProps, ReactNode } from "react";
import { fixtures } from "../fixtures";
import { Case, Cases } from "../ui";

type Space = ComponentProps<typeof Stack>["space"];
type CardProps = ComponentProps<typeof Card>;

const spaces = ["none", "xxs", "xs", "s", "m", "l", "xl", "xxl"] as const;

function Swatch({ children }: { children?: ReactNode }) {
    return (
        <Box
            backgroundColor="secondary"
            borderRadius="xs"
            padding="xs"
            color="action"
        >
            {children ?? "▪"}
        </Box>
    );
}

export function StackSection() {
    return (
        <Cases>
            {(["xxs", "s", "xl"] as Space[]).map((space) => (
                <Case key={String(space)} name={`space ${String(space)}`}>
                    <Stack space={space}>
                        <Swatch>1</Swatch>
                        <Swatch>2</Swatch>
                        <Swatch>3</Swatch>
                    </Stack>
                </Case>
            ))}
            {(["left", "center", "right"] as const).map((align) => (
                <Case key={align} name={`align ${align}`}>
                    <div style={{ width: 160 }}>
                        <Stack space="xs" align={align}>
                            <Swatch>short</Swatch>
                            <Swatch>a longer item</Swatch>
                        </Stack>
                    </div>
                </Case>
            ))}
            <Case name="worst: unbreakable email">
                <Stack space="xs">
                    <Text>{fixtures.unbreakableEmail}</Text>
                    <Text>{fixtures.singleChar}</Text>
                </Stack>
            </Case>
            <Case name="worst: empty">
                <Stack space="m" />
            </Case>
        </Cases>
    );
}

export function BoxSection() {
    return (
        <Cases>
            {(
                [
                    "primary",
                    "secondary",
                    "elevated",
                    "muted",
                    "tertiary",
                    "disabled",
                    "error",
                    "success",
                    "warning",
                ] as const
            ).map((backgroundColor) => (
                <Case key={backgroundColor} name={`bg ${backgroundColor}`}>
                    <Box
                        backgroundColor={backgroundColor}
                        borderRadius="m"
                        padding="m"
                    >
                        <Text as="span" variant="caption">
                            {backgroundColor}
                        </Text>
                    </Box>
                </Case>
            ))}
            {(["none", "xs", "m", "xl", "full"] as const).map((radius) => (
                <Case key={radius} name={`radius ${radius}`}>
                    <Box
                        backgroundColor="secondary"
                        borderRadius={radius}
                        padding="m"
                    >
                        <Text as="span" variant="caption">
                            {radius}
                        </Text>
                    </Box>
                </Case>
            ))}
            <Case name="responsive padding">
                <Box
                    backgroundColor="muted"
                    padding={{ mobile: "xs", tablet: "m", desktop: "xl" }}
                >
                    <Text as="span">mobile / tablet / desktop</Text>
                </Box>
            </Case>
            <Case name="worst: unbreakable email">
                <Box backgroundColor="muted" padding="s">
                    <Text as="span">{fixtures.unbreakableEmail}</Text>
                </Box>
            </Case>
            <Case name="worst: empty">
                <Box backgroundColor="muted" padding="none" />
            </Case>
        </Cases>
    );
}

export function InlineSection() {
    const chips = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
    return (
        <Cases>
            {(["left", "center", "right", "space-between"] as const).map(
                (align) => (
                    <Case key={align} name={`align ${align}`}>
                        <div style={{ width: 240 }}>
                            <Inline space="xs" align={align}>
                                <Swatch>a</Swatch>
                                <Swatch>b</Swatch>
                            </Inline>
                        </div>
                    </Case>
                )
            )}
            <Case name="wraps">
                <div style={{ width: 160 }}>
                    <Inline space="xs">
                        {chips.map((chip) => (
                            <Swatch key={chip}>{chip}</Swatch>
                        ))}
                    </Inline>
                </div>
            </Case>
            <Case name="fill">
                <div style={{ width: 240 }}>
                    <Inline space="xs" fill>
                        <Swatch>a</Swatch>
                        <Swatch>b</Swatch>
                    </Inline>
                </div>
            </Case>
            <Case name="alignY baseline">
                <Inline space="s" alignY="baseline">
                    <Text variant="display">Big</Text>
                    <Text variant="tiny">tiny</Text>
                </Inline>
            </Case>
            <Case name="worst: unbreakable email">
                <Inline space="xs">
                    <Swatch>{fixtures.unbreakableEmail}</Swatch>
                    <Swatch>{fixtures.singleChar}</Swatch>
                </Inline>
            </Case>
            <Case name="worst: empty">
                <Inline space="xs" />
            </Case>
        </Cases>
    );
}

export function TilesSection() {
    return (
        <Cases>
            {[1, 2, 3, 4].map((columns) => (
                <Case key={columns} name={`${columns} columns`}>
                    <div style={{ width: 240 }}>
                        <Tiles columns={columns} space="xs">
                            {spaces.slice(0, 4).map((space) => (
                                <Swatch key={space}>{space}</Swatch>
                            ))}
                        </Tiles>
                    </div>
                </Case>
            ))}
            <Case name="responsive columns">
                <Tiles columns={{ mobile: 1, tablet: 2, desktop: 4 }} space="s">
                    <Swatch>1</Swatch>
                    <Swatch>2</Swatch>
                    <Swatch>3</Swatch>
                    <Swatch>4</Swatch>
                </Tiles>
            </Case>
            <Case name="worst: unbreakable email in 2 columns">
                <Tiles columns={2} space="xs">
                    <Swatch>{fixtures.unbreakableEmail}</Swatch>
                    <Swatch>{fixtures.singleChar}</Swatch>
                </Tiles>
            </Case>
            <Case name="worst: empty">
                <Tiles columns={3} />
            </Case>
        </Cases>
    );
}

const radii: NonNullable<CardProps["radius"]>[] = ["s", "m", "l"];
const cardVariants: NonNullable<CardProps["variant"]>[] = [
    "elevated",
    "muted",
    "secondary",
];
const paddings: NonNullable<CardProps["padding"]>[] = [
    "none",
    "compact",
    "default",
];

export function CardSection() {
    return (
        <Cases>
            {cardVariants.map((variant) => (
                <Case key={variant} name={`variant ${variant}`}>
                    <Card variant={variant}>
                        <Text as="span">{variant}</Text>
                    </Card>
                </Case>
            ))}
            {radii.map((radius) => (
                <Case key={radius} name={`radius ${radius}`}>
                    <Card radius={radius}>
                        <Text as="span">{radius}</Text>
                    </Card>
                </Case>
            ))}
            {paddings.map((padding) => (
                <Case key={padding} name={`padding ${padding}`}>
                    <Card padding={padding} variant="muted">
                        <Text as="span">{padding}</Text>
                    </Card>
                </Case>
            ))}
            <Case name="header title description">
                <Card>
                    <CardHeader>
                        <CardTitle>Title</CardTitle>
                        <CardDescription>Description</CardDescription>
                    </CardHeader>
                    <Text>Body</Text>
                </Card>
            </Case>
            <Case name="worst: unbreakable email">
                <Card>
                    <Text>{fixtures.unbreakableEmail}</Text>
                </Card>
            </Case>
            <Case name="worst: non-Latin and emoji">
                <Card>
                    <Text>{fixtures.nonLatin}</Text>
                </Card>
            </Case>
            <Case name="worst: empty">
                <Card />
            </Case>
        </Cases>
    );
}
