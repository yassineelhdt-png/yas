// Où tourne l'app : APK Android (Capacitor), PC (Electron), app web installée ou navigateur.
const ua = navigator.userAgent;
const native = !!window.Capacitor?.isNativePlatform?.();
const electron = /Electron\//.test(ua);
const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

export const platform = {
  native,
  electron,
  ios,
  standalone,
  // les téléchargements de fichiers ne passent pas dans la WebView Android
  canDownload: !native,
  label: native ? "app Android" : electron ? "app PC" : standalone ? "app installée" : "navigateur"
};
