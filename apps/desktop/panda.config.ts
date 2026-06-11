import { defineConfig } from "@pandacss/dev";
import { createPreset } from "@park-ui/panda-preset";
import amber from "@park-ui/panda-preset/colors/amber";
import sand from "@park-ui/panda-preset/colors/sand";

export default defineConfig({
    preflight: true,
    presets: [
        createPreset({
            accentColor: amber,
            grayColor: sand,
            radius: "sm",
        }),
    ],
    include: ["./src/**/*.{js,jsx,ts,tsx}"],
    exclude: [],
    jsxFramework: "solid",
    outdir: "styled-system",
    theme: {
        extend: {
            tokens: {
                fonts: {
                    body: { value: "'Geist Variable', system-ui, sans-serif" },
                    heading: { value: "'Geist Variable', system-ui, sans-serif" },
                },
            },
            keyframes: {
                fade: {
                    from: { opacity: "0", transform: "translateY(6px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
            },
        },
    },
    globalCss: {
        html: { fontFamily: "body" },
        body: {
            bg: "bg.canvas",
            color: "fg.default",
            minH: "100vh",
        },
    },
});
