import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";

export default function App() {
    return (
        <Button onClick={() => invoke("my_custom_command")}>
            invoke
        </Button>
    );
}
