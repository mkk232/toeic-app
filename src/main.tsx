import { render } from "preact";
import { App } from "./ui/App";
import { startAutoPrefetch } from "./prefetch";
import "./ui/app.css";

render(<App />, document.getElementById("app")!);
startAutoPrefetch();
