import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/day.css";
import "./styles/week.css";
import "./styles/pages.css";
import { mountApp } from "./ui/app.js";
import { connectSync } from "./store.js";
import { platform } from "./platform.js";

mountApp(document.getElementById("app"));
connectSync();

// Hors ligne sur iPhone / navigateur : service worker (inutile dans les apps Android et PC, déjà hors ligne)
if (import.meta.env.PROD && "serviceWorker" in navigator && location.protocol === "https:" && !platform.native && !platform.electron) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}
