import { render } from "solid-js/web";
import "./index.css";
import { Route, Router } from "@solidjs/router";
import { Toaster } from "solid-toast";
import "solid-devtools";

import "./services/lifecycle";

import RequireConnection from "./components/require-connection";

import HomeView from "./routes/home";
import ConnectView from "./routes/connect";
import ConnectScanView from "./routes/connect/scan";
import Connections from "./routes/connections";
import ConfigView from "./routes/config";
import NetworkConfigView from "./routes/config/network";

const root = document.getElementById("root");

render(
  () => (
    <>
      <Toaster />
      <Router base={import.meta.env.BASE_URL}>
        <Route path="/connect" component={ConnectView} />
        <Route path="/connect/scan" component={ConnectScanView} />

        <Route component={RequireConnection}>
          <Route path="/" component={HomeView} />
          <Route path="/connections" component={Connections} />

          <Route path="/config" component={ConfigView}>
            <Route path="/" component={NetworkConfigView} />
            <Route path="/network" component={NetworkConfigView} />
          </Route>
        </Route>
      </Router>
    </>
  ),
  root!,
);
