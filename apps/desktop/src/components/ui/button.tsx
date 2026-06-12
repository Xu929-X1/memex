import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

const button = cva({
    base: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "2",
        whiteSpace: "nowrap",
        borderRadius: "l2",
        fontWeight: "medium",
        cursor: "pointer",
        transition:
            "background 0.18s, color 0.18s, border-color 0.18s, opacity 0.18s",
        outline: "none",
        _focusVisible: {
            outlineWidth: "2px",
            outlineStyle: "solid",
            outlineColor: "amber.default",
            outlineOffset: "2px",
        },
        _disabled: { opacity: 0.5, pointerEvents: "none" },
    },
    variants: {
        variant: {
            // high-contrast neutral primary — quiet, fits the warm theme
            solid: {
                bg: "fg.default",
                color: "bg.canvas",
                _hover: { opacity: 0.9 },
            },
            outline: {
                borderWidth: "1px",
                borderColor: "border.default",
                color: "fg.default",
                _hover: { bg: "gray.a2", borderColor: "border.emphasized" },
            },
            ghost: {
                color: "fg.default",
                _hover: { bg: "gray.a2" },
            },
            // amber accent — reserve for a single emphasized action
            accent: {
                colorPalette: "accent",
                bg: "colorPalette.default",
                color: "colorPalette.fg",
                _hover: { bg: "colorPalette.emphasized" },
            },
        },
        size: {
            sm: { h: "9", px: "3.5", fontSize: "sm" },
            md: { h: "10", px: "4", fontSize: "sm" },
            lg: { h: "11", px: "5", fontSize: "md" },
        },
    },
    defaultVariants: { variant: "solid", size: "md" },
});

export const Button = styled("button", button);
