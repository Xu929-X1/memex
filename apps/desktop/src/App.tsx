import { bootstrapAuth } from "@/lib/auth";
import { type RouteSectionProps } from "@solidjs/router";
import { onMount } from "solid-js";
import { css } from "styled-system/css";

const shell = css({
    position: "relative",
    minH: "100vh",
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
    overflowY: "auto",
});

export default function App(props: RouteSectionProps) {
    // Read the persisted token from SQLite once, before guards evaluate.
    onMount(() => void bootstrapAuth());
    return <div class={shell}>{props.children}</div>;
}
