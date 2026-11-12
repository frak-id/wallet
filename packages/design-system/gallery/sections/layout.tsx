import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Box } from "@frak-labs/design-system/components/Box";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Column } from "@frak-labs/design-system/components/Column";
import { Columns } from "@frak-labs/design-system/components/Columns";
import { ContentBlock } from "@frak-labs/design-system/components/ContentBlock";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import { CheckIcon, WalletIcon } from "@frak-labs/design-system/icons";
import type { ComponentProps, ReactNode } from "react";
import { fixtures, longText } from "../fixtures";
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
        <>
            <Cases title="Spacing">
                {(["xxs", "s", "xl"] as Space[]).map((space) => (
                    <Case key={String(space)} name={`space ${String(space)}`}>
                        <Stack space={space}>
                            <Swatch>1</Swatch>
                            <Swatch>2</Swatch>
                            <Swatch>3</Swatch>
                        </Stack>
                    </Case>
                ))}
            </Cases>
            <Cases title="Alignment">
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
            </Cases>
            <Cases title="Worst Case" layout="stack">
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
        </>
    );
}

export function BoxSection() {
    return (
        <>
            <Cases title="Backgrounds">
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
            </Cases>
            <Cases title="Radii">
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
            </Cases>
            <Cases title="Responsive">
                <Case name="responsive padding">
                    <Box
                        backgroundColor="muted"
                        padding={{ mobile: "xs", tablet: "m", desktop: "xl" }}
                    >
                        <Text as="span">mobile / tablet / desktop</Text>
                    </Box>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <Box backgroundColor="muted" padding="s">
                        <Text as="span">{fixtures.unbreakableEmail}</Text>
                    </Box>
                </Case>
                <Case name="worst: empty">
                    <Box backgroundColor="muted" padding="none" />
                </Case>
            </Cases>
        </>
    );
}

export function InlineSection() {
    const chips = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
    return (
        <>
            <Cases title="Alignment">
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
            </Cases>
            <Cases title="Wrapping and Fill">
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
            </Cases>
            <Cases title="Vertical Alignment">
                <Case name="alignY baseline">
                    <Inline space="s" alignY="baseline">
                        <Text as="span" variant="display">
                            Big
                        </Text>
                        <Text variant="tiny">tiny</Text>
                    </Inline>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
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
        </>
    );
}

export function TilesSection() {
    return (
        <>
            <Cases title="Columns">
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
            </Cases>
            <Cases title="Responsive">
                <Case name="responsive columns">
                    <Tiles
                        columns={{ mobile: 1, tablet: 2, desktop: 4 }}
                        space="s"
                    >
                        <Swatch>1</Swatch>
                        <Swatch>2</Swatch>
                        <Swatch>3</Swatch>
                        <Swatch>4</Swatch>
                    </Tiles>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
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
        </>
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
        <>
            <Cases title="Variants">
                {cardVariants.map((variant) => (
                    <Case key={variant} name={`variant ${variant}`}>
                        <Card variant={variant}>
                            <Text as="span">{variant}</Text>
                        </Card>
                    </Case>
                ))}
            </Cases>
            <Cases title="Radii">
                {radii.map((radius) => (
                    <Case key={radius} name={`radius ${radius}`}>
                        <Card radius={radius}>
                            <Text as="span">{radius}</Text>
                        </Card>
                    </Case>
                ))}
            </Cases>
            <Cases title="Padding">
                {paddings.map((padding) => (
                    <Case key={padding} name={`padding ${padding}`}>
                        <Card padding={padding} variant="muted">
                            <Text as="span">{padding}</Text>
                        </Card>
                    </Case>
                ))}
            </Cases>
            <Cases title="Composition">
                <Case name="header title description">
                    <Card>
                        <CardHeader>
                            <CardTitle>Title</CardTitle>
                            <CardDescription>Description</CardDescription>
                        </CardHeader>
                        <Text>Body</Text>
                    </Card>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
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
        </>
    );
}

export function SpreadSection() {
    return (
        <>
            <Cases title="Direction" layout="stack">
                <Case name="horizontal">
                    <Box style={{ width: 280 }}>
                        <Spread>
                            <Swatch>start</Swatch>
                            <Swatch>end</Swatch>
                        </Spread>
                    </Box>
                </Case>
                <Case name="vertical">
                    <Box style={{ height: 120 }}>
                        <Spread direction="vertical" align="top">
                            <Swatch>top</Swatch>
                            <Swatch>bottom</Swatch>
                        </Spread>
                    </Box>
                </Case>
            </Cases>
            <Cases title="Align" layout="stack">
                {(["top", "center", "bottom"] as const).map((align) => (
                    <Case key={align} name={`align ${align}`}>
                        <Box style={{ width: 280 }}>
                            <Spread align={align} space="s">
                                <Swatch>
                                    tall
                                    <br />
                                    item
                                </Swatch>
                                <Swatch>{align}</Swatch>
                            </Spread>
                        </Box>
                    </Case>
                ))}
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <Box style={{ width: 280 }}>
                        <Spread space="s">
                            <Text>{fixtures.unbreakableEmail}</Text>
                            <Swatch>end</Swatch>
                        </Spread>
                    </Box>
                </Case>
                <Case name="worst: long sentence">
                    <Box style={{ width: 280 }}>
                        <Spread space="s">
                            <Text>{fixtures.longSentence}</Text>
                            <Swatch>end</Swatch>
                        </Spread>
                    </Box>
                </Case>
                <Case name="worst: one child">
                    <Box style={{ width: 280 }}>
                        <Spread>
                            <Swatch>only</Swatch>
                        </Spread>
                    </Box>
                </Case>
            </Cases>
        </>
    );
}

export function ContentBlockSection() {
    return (
        <>
            <Cases title="Align" layout="stack">
                {(["center", "left"] as const).map((align) => (
                    <Case key={align} name={`align ${align}`}>
                        <Box style={{ width: 280 }} backgroundColor="secondary">
                            <ContentBlock maxWidth="160px" align={align}>
                                <Swatch>max 160px</Swatch>
                            </ContentBlock>
                        </Box>
                    </Case>
                ))}
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <ContentBlock maxWidth="200px">
                        <Text>{fixtures.unbreakableEmail}</Text>
                    </ContentBlock>
                </Case>
                <Case name="worst: max width wider than parent">
                    <Box style={{ width: 200 }}>
                        <ContentBlock maxWidth="600px">
                            <Text>{fixtures.longSentence}</Text>
                        </ContentBlock>
                    </Box>
                </Case>
            </Cases>
        </>
    );
}

export function IconCircleSection() {
    return (
        <>
            {(["neutral", "action"] as const).map((tone) => (
                <Cases key={tone} title={`Tone ${tone}`}>
                    {(["sm", "md", "lg"] as const).map((size) => (
                        <Case key={size} name={`${tone} ${size}`}>
                            <IconCircle tone={tone} size={size}>
                                <WalletIcon width={20} height={20} />
                            </IconCircle>
                        </Case>
                    ))}
                </Cases>
            ))}
            <Cases title="Worst Case">
                <Case name="worst: oversized icon">
                    <IconCircle size="sm">
                        <CheckIcon width={64} height={64} />
                    </IconCircle>
                </Case>
            </Cases>
        </>
    );
}

function Fill({ children }: { children: ReactNode }) {
    return <div style={{ width: "100%" }}>{children}</div>;
}

type ColumnsProps = ComponentProps<typeof Columns>;
type ColumnWidth = NonNullable<ComponentProps<typeof Column>["width"]>;

const widthRows: ColumnWidth[][] = [
    ["1/2", "1/2"],
    ["1/3", "2/3"],
    ["1/4", "3/4"],
    ["1/5", "2/5", "3/5"],
    ["content", "1/2"],
];

export function ColumnsSection() {
    return (
        <>
            <Cases title="Widths" layout="stack">
                {widthRows.map((row) => (
                    <Case
                        key={row.join(" ")}
                        name={`widths ${row.join(" + ")}`}
                    >
                        <Fill>
                            <Columns space="s">
                                {row.map((width) => (
                                    <Column key={width} width={width}>
                                        <Swatch>{width}</Swatch>
                                    </Column>
                                ))}
                            </Columns>
                        </Fill>
                    </Case>
                ))}
            </Cases>
            <Cases title="Spacing" layout="stack">
                {(["none", "xs", "xl"] as ColumnsProps["space"][]).map(
                    (space) => (
                        <Case
                            key={String(space)}
                            name={`space ${String(space)}`}
                        >
                            <Fill>
                                <Columns space={space}>
                                    <Column>
                                        <Swatch>1</Swatch>
                                    </Column>
                                    <Column>
                                        <Swatch>2</Swatch>
                                    </Column>
                                    <Column>
                                        <Swatch>3</Swatch>
                                    </Column>
                                </Columns>
                            </Fill>
                        </Case>
                    )
                )}
            </Cases>
            <Cases title="Vertical Alignment" layout="stack">
                {(["top", "center", "bottom"] as const).map((alignY) => (
                    <Case key={alignY} name={`alignY ${alignY}`}>
                        <Fill>
                            <Columns space="s" alignY={alignY}>
                                <Column>
                                    <Swatch>short</Swatch>
                                </Column>
                                <Column>
                                    <Swatch>
                                        <Box style={{ height: 64 }}>tall</Box>
                                    </Swatch>
                                </Column>
                            </Columns>
                        </Fill>
                    </Case>
                ))}
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <Fill>
                        <Columns space="s">
                            <Column>
                                <Text>{fixtures.unbreakableEmail}</Text>
                            </Column>
                            <Column>
                                <Text>{fixtures.singleChar}</Text>
                            </Column>
                        </Columns>
                    </Fill>
                </Case>
                <Case name="worst: long sentence in two columns">
                    <Fill>
                        <Columns space="s">
                            {[0, 1].map((index) => (
                                <Column key={index}>
                                    <Text>{fixtures.longSentence}</Text>
                                </Column>
                            ))}
                        </Columns>
                    </Fill>
                </Case>
                <Case name="worst: non-Latin and emoji beside content width">
                    <Fill>
                        <Columns space="s">
                            <Column width="content">
                                <Text>{fixtures.singleChar}</Text>
                            </Column>
                            <Column>
                                <Text>{fixtures.nonLatin}</Text>
                            </Column>
                        </Columns>
                    </Fill>
                </Case>
            </Cases>
        </>
    );
}

function FaqItems({ titles }: { titles: string[] }) {
    return titles.map((title, index) => (
        <AccordionItem key={title} value={`item-${index}`}>
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent>
                <Text color="secondary">Answer for {title}</Text>
            </AccordionContent>
        </AccordionItem>
    ));
}

const faqTitles = [
    "How do rewards work?",
    "When do I get paid?",
    "Is it free?",
];

export function AccordionSection() {
    return (
        <>
            <Cases title="Types" layout="stack">
                <Case name="single collapsible, first open">
                    <Fill>
                        <Accordion
                            type="single"
                            collapsible
                            defaultValue="item-0"
                        >
                            <FaqItems titles={faqTitles} />
                        </Accordion>
                    </Fill>
                </Case>
                <Case name="multiple, two open">
                    <Fill>
                        <Accordion
                            type="multiple"
                            defaultValue={["item-0", "item-2"]}
                        >
                            <FaqItems titles={faqTitles} />
                        </Accordion>
                    </Fill>
                </Case>
            </Cases>
            <Cases title="States" layout="stack">
                <Case name="disabled item">
                    <Fill>
                        <Accordion type="single" collapsible>
                            <AccordionItem value="open">
                                <AccordionTrigger>Available</AccordionTrigger>
                                <AccordionContent>Content</AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="locked" disabled>
                                <AccordionTrigger>Locked</AccordionTrigger>
                                <AccordionContent>Content</AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </Fill>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <Fill>
                        <Accordion
                            type="single"
                            collapsible
                            defaultValue="item-0"
                        >
                            <AccordionItem value="item-0">
                                <AccordionTrigger>
                                    {fixtures.unbreakableEmail}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Text>{fixtures.unbreakableEmail}</Text>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </Fill>
                </Case>
                <Case name="worst: long sentence">
                    <Fill>
                        <Accordion
                            type="single"
                            collapsible
                            defaultValue="item-0"
                        >
                            <AccordionItem value="item-0">
                                <AccordionTrigger>
                                    {fixtures.longSentence}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Text>{longText(4)}</Text>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </Fill>
                </Case>
                <Case name="worst: one character and non-Latin">
                    <Fill>
                        <Accordion type="multiple" defaultValue={["a", "b"]}>
                            <AccordionItem value="a">
                                <AccordionTrigger>
                                    {fixtures.singleChar}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Text>{fixtures.singleChar}</Text>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="b">
                                <AccordionTrigger>
                                    {fixtures.nonLatin}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Text>{fixtures.nonLatin}</Text>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </Fill>
                </Case>
            </Cases>
        </>
    );
}
