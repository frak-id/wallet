import {
    Button,
    type ButtonProps,
} from "@frak-labs/design-system/components/Button";
import { createLink, type LinkComponent } from "@tanstack/react-router";
import { forwardRef } from "react";

/**
 * `<Button>` rendered as an `<a>` so TanStack Router's `createLink` can
 * wrap it. Splitting this out of the `<Button>` component keeps the
 * design-system free of router coupling while still letting consumers
 * trade `onClick={() => navigate(...)}` for a `<Link>`-driven button.
 *
 * The render-time preload (`defaultPreload: "render"` on the router) only
 * fires for `<Link>` elements — converting CTAs that just go to a known
 * route unlocks chunk pre-warming the moment the button mounts.
 */
type ButtonAnchorProps = Omit<Extract<ButtonProps, { as: "a" }>, "as" | "ref">;

const ButtonAnchor = forwardRef<HTMLAnchorElement, ButtonAnchorProps>(
    (props, ref) => <Button ref={ref} as="a" {...props} />
);
ButtonAnchor.displayName = "ButtonAnchor";

const CreatedButtonLink = createLink(ButtonAnchor);

export const ButtonLink: LinkComponent<typeof ButtonAnchor> = (props) => (
    <CreatedButtonLink {...props} />
);
