import { Text } from "@frak-labs/design-system/components/Text";
import type { ComponentProps } from "react";
import { fixtures } from "../fixtures";
import { Case, Cases } from "../ui";

type TextProps = ComponentProps<typeof Text>;
type Variant = NonNullable<TextProps["variant"]>;
type Color = Extract<NonNullable<TextProps["color"]>, string>;

const variants: Variant[] = [
    "display1",
    "display",
    "heading1",
    "heading2",
    "heading3",
    "heading4",
    "heading5",
    "heading6",
    "body",
    "bodySmall",
    "caption",
    "label",
    "overline",
    "tiny",
];

const colors: Color[] = [
    "primary",
    "secondary",
    "tertiary",
    "disabled",
    "action",
    "error",
    "success",
    "warning",
];

export function TextSection() {
    return (
        <Cases>
            {variants.map((variant) => (
                <Case key={variant} name={`variant ${variant}`}>
                    <Text variant={variant}>Frak {variant}</Text>
                </Case>
            ))}
            {colors.map((color) => (
                <Case key={color} name={`color ${color}`}>
                    <Text color={color}>Frak {color}</Text>
                </Case>
            ))}
            <Case name="align center in 200px">
                <div style={{ width: 200 }}>
                    <Text align="center">Centered</Text>
                </div>
            </Case>
            <Case name="worst: unbreakable email">
                <Text>{fixtures.unbreakableEmail}</Text>
            </Case>
            <Case name="worst: long sentence">
                <Text>{fixtures.longSentence}</Text>
            </Case>
            <Case name="worst: one character">
                <Text variant="display1">{fixtures.singleChar}</Text>
            </Case>
            <Case name="worst: empty">
                <Text>{fixtures.empty}</Text>
            </Case>
            <Case name="worst: huge number">
                <Text variant="heading1">{fixtures.hugeNumber}</Text>
            </Case>
            <Case name="worst: non-Latin and emoji">
                <Text>{fixtures.nonLatin}</Text>
            </Case>
        </Cases>
    );
}
