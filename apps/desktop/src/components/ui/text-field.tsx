import { Field } from "@ark-ui/solid/field";
import { splitProps, type JSX } from "solid-js";
import { css } from "styled-system/css";

const rootCss = css({
    display: "flex",
    flexDirection: "column",
    gap: "2",
});

const labelCss = css({
    fontSize: "xs",
    fontWeight: "medium",
    letterSpacing: "wide",
    textTransform: "uppercase",
    color: "fg.muted",
});

const inputCss = css({
    h: "11",
    px: "3.5",
    w: "full",
    borderRadius: "l2",
    bg: "bg.subtle",
    borderWidth: "1px",
    borderColor: "border.default",
    color: "fg.default",
    fontSize: "md",
    transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
    _placeholder: { color: "fg.subtle" },
    _hover: { borderColor: "border.emphasized" },
    _focus: {
        outline: "none",
        borderColor: "amber.default",
        bg: "bg.canvas",
    },
});

type TextFieldProps = {
    label: string;
    error?: string;
} & JSX.InputHTMLAttributes<HTMLInputElement>;

export function TextField(props: TextFieldProps) {
    const [local, rest] = splitProps(props, ["label", "error"]);
    return (
        <Field.Root class={rootCss} invalid={!!local.error}>
            <Field.Label class={labelCss}>{local.label}</Field.Label>
            <Field.Input class={inputCss} {...rest} />
            <Field.ErrorText
                class={css({ fontSize: "sm", color: "red.default" })}
            >
                {local.error}
            </Field.ErrorText>
        </Field.Root>
    );
}
