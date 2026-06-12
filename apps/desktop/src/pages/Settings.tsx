import { css } from "styled-system/css";

export default function Settings() {
    return (
        <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
            <h1 class={css({ fontSize: "xl", fontWeight: "bold" })}>Settings</h1>
            <p>Settings page.</p>
        </div>
    );
}
