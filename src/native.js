// Intégration Android (APK) : bouton retour et couleur des icônes de la barre d'état.
import { App } from "@capacitor/app";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";

export function setupNative() {
  // retour : onglet → Jour (historique), puis mise en arrière-plan comme une app Android classique
  App.addListener("backButton", () => {
    if (history.state?.tab) history.back();
    else App.minimizeApp();
  });
}

let lastDark = null;
export function setBarsDark(dark) {
  if (dark === lastDark) return;
  lastDark = dark;
  SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
}
