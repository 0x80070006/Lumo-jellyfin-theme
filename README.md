# Lumo — thème Jellyfin

Un thème sombre et sobre pour Jellyfin 12, **100 % CSS**.

- Fond graphite, un seul accent ambre, coins nets.
- Aucun JavaScript injecté, aucun fichier de `jellyfin-web` modifié : les mises à jour de Jellyfin ne cassent rien.
- Aucun contenu masqué : toutes les bibliothèques, rangées et pages natives restent visibles.
- Aucun `backdrop-filter`, aucune animation permanente : reste fluide sur TV, navigateur et téléphone.
- Fonctionne avec l'écran d'accueil natif ou le plugin *Home Screen Sections*.

## Installation

Tableau de bord → **Général** → **CSS personnalisée**, puis au choix :

**A. Coller le contenu de [`lumo.css`](lumo.css)** (recommandé : aucune requête réseau supplémentaire, fonctionne hors ligne).

**B. Importer la version publiée** (mises à jour automatiques) :

```css
@import url("https://cdn.jsdelivr.net/gh/0x80070006/Lumo-jellyfin-theme@1/lumo.css");
```

Enregistrez, puis rechargez la page (Ctrl+F5).

## Personnaliser

Toutes les couleurs sont des variables. Ajoutez sous l'import :

```css
:root {
  --lumo-accent: #4cc38a;      /* accent */
  --lumo-accent-ink: #06150e;  /* texte sur l'accent */
  --lumo-bg: #0b0b0c;          /* fond */
  --lumo-radius-card: 4px;     /* arrondi des affiches */
}
```

## Désinstaller

Videz le champ **CSS personnalisée** et enregistrez.

## Migration depuis l'ancien Lumo / NoctaFin (installation « complète »)

L'ancienne version injectait des scripts dans `index.html` de `jellyfin-web`. Une mise à jour du paquet `jellyfin-web` restaure le fichier d'origine. Il reste ensuite des fichiers orphelins à supprimer :

```bash
rm -rf /usr/share/jellyfin/web/ui /usr/share/jellyfin/web/abyss /usr/share/jellyfin/web/cinematic
```

## Licence

MIT
