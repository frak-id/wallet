import { style } from "@vanilla-extract/css";

export const main = style({
    position: "relative",
});

const ellipseBase = {
    position: "absolute" as const,
    filter: "blur(500px)",
    borderRadius: "50%",
};

export const ellipseBlueCorner = style([
    ellipseBase,
    {
        top: "-279px",
        left: "-317px",
        backgroundColor: "#a9bce4",
        width: "634px",
        height: "634px",
    },
]);

export const ellipseBlueTop = style([
    ellipseBase,
    {
        top: "283px",
        left: "1000px",
        width: "885px",
        height: "885px",
        backgroundColor: "#a9bce4",
        "@media": {
            "screen and (max-width: 768px)": {
                top: "706px",
                left: "-441px",
                width: "626px",
                height: "626px",
            },
        },
    },
]);

export const ellipseWhite = style([
    ellipseBase,
    {
        top: "219px",
        left: "376px",
        filter: "blur(1000px)",
        backgroundColor: "#ffffff",
        width: "634px",
        height: "634px",
        "@media": {
            "screen and (max-width: 768px)": {
                top: "51px",
                left: "-250px",
                filter: "blur(500px)",
            },
        },
    },
]);

export const ellipseRed = style([
    ellipseBase,
    {
        top: "-364px",
        left: "581px",
        filter: "blur(1000px)",
        backgroundColor: "#ffd6d6",
        width: "634px",
        height: "634px",
        "@media": {
            "screen and (max-width: 768px)": {
                top: "481px",
                left: "148px",
            },
        },
    },
]);
