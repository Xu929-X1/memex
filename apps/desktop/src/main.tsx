import { HashRouter, Route } from "@solidjs/router";
import { render } from "solid-js/web";
import App from "./App";
import { Protected } from "./components/protected";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Hud from "./pages/Hud";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Setup from "./pages/Setup";
import Signup from "./pages/Signup";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

render(
    () => (
        <HashRouter root={App}>
            <Route path="/" component={Home} />
            <Route path="/hud" component={Hud} />
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route path="/setup" component={() => <Protected><Setup /></Protected>} />
            <Route path="/settings" component={() => <Protected><Settings /></Protected>} />
            <Route path="/dashboard" component={() => <Protected><Dashboard /></Protected>} />
        </HashRouter>
    ),
    root
);
