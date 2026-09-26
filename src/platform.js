// Où tourne l'app : APK Android (Capacitor), PC (Electron), app web installée ou navigateur.
const ua = navigator.userAgent;
const native = !!window.Capacitor?.isNativePlatform?.();
const electron = /Electron\//.test(ua);
const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
// build « artefact Claude » (npm run build:artifact) : un seul fichier HTML publié dans Claude
const artifact = __ARTIFACT__;

export const platform = {
  native,
  electron,
  ios,
  standalone,
  artifact,
  // les téléchargements de fichiers ne passent ni dans la WebView Android ni dans un artefact
  canDownload: !native && !artifact,
  label: artifact ? "artefact Claude" : native ? "app Android" : electron ? "app PC" : standalone ? "app installée" : "navigateur"
};
