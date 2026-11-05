# Installer Lumo

Lumo fonctionne avec **Jellyfin 12** (paquet Debian/Ubuntu, en conteneur LXC ou en machine virtuelle). Il s'appuie sur deux mécanismes officiels de Jellyfin : la *CSS personnalisée* et le plugin *JavaScript Injector*. Aucun fichier de `jellyfin-web` n'est modifié, donc les mises à jour de Jellyfin n'effacent rien.

## Prérequis

- Jellyfin 12 installé par paquet (`jellyfin-server`), service `jellyfin` géré par systemd ;
- un accès **root** au conteneur ou à la machine qui fait tourner Jellyfin ;
- `curl` et `python3` (présents sur Debian 12 ; sinon `apt install curl python3`) ;
- un accès à Internet pendant l'installation.

Sur Proxmox, ouvrez une console dans le conteneur Jellyfin (`pct enter <id>`), ou lancez les commandes avec `pct exec <id> -- bash -c '…'`.

## Installation en une commande

```bash
curl -fsSL https://raw.githubusercontent.com/0x80070006/Lumo-jellyfin-theme/main/install.sh | bash
```

Déroulé :

| Étape | Détail |
| --- | --- |
| Vérifications | root, Jellyfin ≥ 12, `curl`, `python3` |
| Plugins | installe **File Transformation** et **JavaScript Injector** s'ils manquent, après vérification de la somme MD5 publiée par leur dépôt |
| Sauvegarde | copie `branding.xml` et la configuration de JavaScript Injector dans `/var/lib/jellyfin/lumo-backups/<date>/` |
| Thème | écrit dans *CSS personnalisée* **une ligne** `@import` vers GitHub (version figée), suivie de la couleur dominante |
| Couche interactive | ajoute dans JavaScript Injector un script « Lumo » d'**une ligne** qui charge `lumo.js` depuis GitHub |
| Redémarrage | redémarre Jellyfin et attend qu'il réponde |

Ensuite, **rechargez chaque appareil une fois avec Ctrl+F5** (ou videz le cache de l'application).

Après l'installation, *CSS personnalisée* ne contient que ceci :

```css
/* Lumo 1.2.2 — le thème est chargé depuis GitHub ; relancez install.sh pour mettre à jour. */
@import url("https://cdn.jsdelivr.net/gh/0x80070006/Lumo-jellyfin-theme@1.2.2/lumo.css");

/* Couleur dominante : changez ces deux valeurs, enregistrez, puis Ctrl+F5. */
:root {
  --lumo-accent: #f2a541;
  --lumo-accent-ink: #1a1206;
}
```

Tout le code est sur GitHub et servi par jsDelivr à une **version figée** : une nouvelle version publiée ne change rien chez vous tant que vous ne relancez pas le script. Les fichiers sont mis en cache par le navigateur après le premier chargement.

**Serveur sans accès Internet ?** Ajoutez `--inline` : le script copie alors tout le CSS et tout le JS dans Jellyfin (seuls les logos des studios viendront encore du CDN ; sans réseau, le nom du studio s'affiche à la place).

## Options

Passez les options après `bash -s --` :

```bash
curl -fsSL https://raw.githubusercontent.com/0x80070006/Lumo-jellyfin-theme/main/install.sh | bash -s -- --accent "#e50914" --ink "#ffffff"
```

| Option | Effet |
| --- | --- |
| `--accent "#rrggbb"` | couleur dominante (sinon : celle déjà installée, ou l'ambre par défaut) |
| `--ink "#rrggbb"` | couleur du texte posé sur la couleur dominante |
| `--uninstall` | retire la CSS et le script Lumo (les plugins restent installés) |
| `--no-plugins` | n'installe pas File Transformation / JavaScript Injector |
| `--no-restart` | ne redémarre pas Jellyfin (à faire soi-même ensuite) |
| `--inline` | copie tout le CSS et le JS dans Jellyfin au lieu de les charger depuis GitHub |
| `--source DIR` | comme `--inline`, avec `lumo.css` et `lumo.js` pris dans `DIR` |

Variable d'environnement : `LUMO_VERSION=1.2.2` pour installer une version précise.

## Mettre à jour

Relancez la même commande. Le script est idempotent : il passe les deux lignes à la nouvelle version, conserve votre couleur dominante et refait une sauvegarde. Vous pouvez aussi changer le numéro de version à la main dans l'`@import` et dans le script « Lumo » de JavaScript Injector.

## Changer de couleur

Deux possibilités :

1. Tableau de bord → **Général** → **CSS personnalisée** : modifiez les deux valeurs du bloc `:root`, puis enregistrez et faites Ctrl+F5.
2. Ou relancez le script avec `--accent` (et éventuellement `--ink`).

Cinq palettes prêtes à l'emploi sont dans le dossier [`themes/`](../themes) : voir le [README](../README.md#couleurs).

## Écran d'accueil conseillé

Lumo ajoute ses propres rangées (hero, studios, plateformes, ajouts récents par série, genres, studios). Avec le plugin **Home Screen Sections**, pour éviter les doublons :

- gardez **Continuer à regarder** (vue *Paysage*), et si vous le souhaitez *Parce que vous avez regardé*, *Regarder à nouveau*, *Collections* (vue *Portrait*) ;
- désactivez **À suivre**, **Mes médias**, **Ajouté récemment dans…** et **Genre**.

Sans Home Screen Sections, l'accueil natif de Jellyfin s'affiche entre les rangées de Lumo, sans conflit.

## Installation à la main

1. Dans *CSS personnalisée*, collez :
   ```css
   @import url("https://cdn.jsdelivr.net/gh/0x80070006/Lumo-jellyfin-theme@1.2.2/lumo.css");
   :root { --lumo-accent: #f2a541; --lumo-accent-ink: #1a1206; }
   ```
2. Installez **JavaScript Injector** : *Plugins → Dépôts →* `https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json`, puis *Catalogue → JavaScript Injector*. Redémarrez.
3. Dans *JavaScript Injector*, ajoutez un script nommé `Lumo` contenant la ligne ci-dessous, cochez *Enabled* et enregistrez :
   ```js
   (function(){var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/gh/0x80070006/Lumo-jellyfin-theme@1.2.2/lumo.js";s.defer=true;s.dataset.lumo="1";document.head.appendChild(s);})();
   ```

## Désinstaller

```bash
curl -fsSL https://raw.githubusercontent.com/0x80070006/Lumo-jellyfin-theme/main/install.sh | bash -s -- --uninstall
```

Les sauvegardes restent dans `/var/lib/jellyfin/lumo-backups/`. Pour revenir exactement à une configuration antérieure, recopiez `branding.xml` dans `/etc/jellyfin/`, puis redémarrez Jellyfin.

## Dépannage

| Symptôme | Cause et solution |
| --- | --- |
| L'accueil d'origine s'affiche, sans hero | Le navigateur a chargé la page pendant un redémarrage et garde une version sans les ajouts des plugins. Faites **Ctrl+F5**. |
| Le style est appliqué mais pas le hero ni le dé | Vérifiez que *JavaScript Injector* est actif et que le script « Lumo » est coché. |
| Page sans style, ou ni hero ni dé | L'appareil n'atteint pas `cdn.jsdelivr.net`. Vérifiez l'accès réseau, ou réinstallez avec `--inline`. |
| Logos de studios remplacés par leur nom | Même cause, en mode `--inline` : ce n'est que cosmétique. |
| Une rangée de genre n'apparaît pas | Moins de 4 titres pour ce genre dans votre bibliothèque : la rangée est masquée volontairement. |
| Le bouton Lecture ouvre la fiche au lieu de lancer la lecture | La lecture à distance sur sa propre session a échoué (droits de lecture, session absente). La fiche s'ouvre en secours. |

Journal du serveur : `journalctl -u jellyfin` ou `/var/log/jellyfin/`. Messages de Lumo : console du navigateur, préfixe `[Lumo]`.
