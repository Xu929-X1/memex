import { type RouteSectionProps } from "@solidjs/router";
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
    return <div class={shell}>{props.children}</div>;
}
