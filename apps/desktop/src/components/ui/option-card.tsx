import { Show } from "solid-js";
import { cva } from "styled-system/css";

const card = cva({
    base: {
        display: "flex",
        alignItems: "flex-start",
        gap: "3",
        textAlign: "left",
        w: "full",
        px: "4",
        py: "3.5",
        borderRadius: "l2",
        borderWidth: "1px",
        cursor: "pointer",
        transition: "border-color 0.18s, background 0.18s",
    },
    variants: {
        selected: {
            true: {
                borderColor: "amber.default",
                bg: "amber.a2",
            },
            false: {
                borderColor: "border.default",
                bg: "bg.subtle",
                _hover: { borderColor: "border.emphasized" },
            },
        },
    },
    defaultVariants: { selected: false },
});

const mark = cva({
    base: {
        flexShrink: "0",
        mt: "0.5",
        w: "4",
        h: "4",
        borderRadius: "full",
        borderWidth: "1px",
        display: "grid",
        placeItems: "center",
    },
    variants: {
        selected: {
            true: { borderColor: "amber.default" },
            false: { borderColor: "border.emphasized" },
        },
    },
    defaultVariants: { selected: false },
});

import { css } from "styled-system/css";

export function OptionCard(props: {
    title: string;
    description: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={props.onSelect}
            class={card({ selected: props.selected })}
        >
            <span class={mark({ selected: props.selected })}>
                <Show when={props.selected}>
                    <span
                        class={css({
                            w: "2",
                            h: "2",
                            borderRadius: "full",
                            bg: "amber.default",
                        })}
                    />
                </Show>
            </span>
            <span class={css({ display: "flex", flexDirection: "column", gap: "1" })}>
                <span
                    class={css({
                        fontSize: "sm",
                        fontWeight: "medium",
                        color: "fg.default",
                    })}
                >
                    {props.title}
                </span>
                <span class={css({ fontSize: "xs", lineHeight: "1.5", color: "fg.muted" })}>
                    {props.description}
                </span>
            </span>
        </button>
    );
}
