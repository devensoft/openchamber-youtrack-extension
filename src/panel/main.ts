import { connectHost } from "@openchamber/sdk";
import { applyHostReady } from "@openchamber/sdk/ui";

// Injected by scripts/build.ts from package.json.
declare const __EXTENSION_VERSION__: string;

const host = connectHost();
const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("panel root element is missing");
}

let mounted = false;

const build = (): void => {
  const header = document.createElement("header");
  header.className = "header";

  const title = document.createElement("h1");
  title.textContent = "YouTrack";

  const version = document.createElement("span");
  version.className = "pill";
  version.textContent = `v${__EXTENSION_VERSION__}`;

  header.append(title, version);

  const lede = document.createElement("p");
  lede.className = "lede";
  lede.textContent = "Hello from the OpenChamber YouTrack extension.";

  root.replaceChildren(header, lede);
};

host.onReady((context) => {
  // onReady fires on every host snapshot; repaint the theme each time, mount
  // the DOM once.
  applyHostReady(context, document.documentElement);

  if (mounted) return;
  mounted = true;
  build();
});
