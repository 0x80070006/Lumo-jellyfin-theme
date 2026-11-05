// Lumo — chargeur à coller dans le plugin « JavaScript Injector »
// (Tableau de bord > Plugins > JavaScript Injector > Ajouter un script).
// Charge la couche interactive (hero, studios, genres, dé) depuis GitHub via jsDelivr.
// Si le CDN est injoignable, Jellyfin fonctionne normalement avec le thème CSS seul.
(function () {
  if (document.querySelector("script[data-lumo]")) return;
  var s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/gh/0x80070006/Lumo-jellyfin-theme@1/lumo.js";
  s.defer = true;
  s.dataset.lumo = "1";
  document.head.appendChild(s);
})();
