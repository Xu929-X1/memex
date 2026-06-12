import { render } from "solid-js/web";
import { HashRouter, Route } from "@solidjs/router";
import App from "./App";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Setup from "./pages/Setup";
import Settings from "./pages/Settings";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

render(
    () => (
        <HashRouter root={App}>
            <Route path="/" component={Home} />
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route path="/setup" component={Setup} />
            <Route path="/settings" component={Settings} />
        </HashRouter>
    ),
    root
);
