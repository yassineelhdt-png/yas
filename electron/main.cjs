// App PC (Windows) : une fenêtre qui affiche l'app web compilée (dossier dist/), hors ligne.
const { app, BrowserWindow, protocol, net, shell, nativeTheme } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DIST = path.join(__dirname, "..", "dist");
const ORIGIN = "app://horaire";

// Protocole « app:// » : vraie origine (stockage local persistant), pas de file:// (modules JS bloqués)
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// une seule fenêtre : relancer l'app ramène la fenêtre existante au premier plan
if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 880,
    minWidth: 380,
    minHeight: 560,
    title: "Horaire 9h",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0D1218" : "#EDF0F3",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false }
  });
  win.once("ready-to-show", () => win.show());
  win.loadURL(ORIGIN + "/index.html");

  // liens externes → navigateur par défaut
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    let { pathname } = new URL(req.url);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST + path.sep)) return new Response("Introuvable", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.on("window-all-closed", () => app.quit());
