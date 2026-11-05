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
| Thème | met **tout** `lumo.css` dans *CSS personnalisée*, suivi du bloc de couleur dominante |
| Couche interactive | met **tout** `lumo.js` dans une entrée « Lumo » de JavaScript Injector |
| Redémarrage | redémarre Jellyfin et attend qu'il réponde |

Ensuite, **rechargez chaque appareil une fois avec Ctrl+F5** (ou videz le cache de l'application).

Pendant l'utilisation, rien n'est téléchargé depuis un CDN, à une exception près : les logos des studios viennent de jsDelivr, à une version figée. Sans réseau, le nom du studio s'affiche à la place.

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
| `--source DIR` | utilise `lumo.css` et `lumo.js` présents dans `DIR` au lieu de GitHub |

Variable d'environnement : `LUMO_VERSION=1.2.1` pour installer une version précise.

## Mettre à jour

Relancez la même commande. Le script est idempotent : il remplace la CSS et le script Lumo, conserve votre couleur dominante et refait une sauvegarde.

## Changer de couleur

Deux possibilités :

1. Tableau de bord → **Général** → **CSS personnalisée** : modifiez le bloc à la toute fin, puis enregistrez et faites Ctrl+F5.
2. Ou relancez le script avec `--accent` (et éventuellement `--ink`).

Cinq palettes prêtes à l'emploi sont dans le dossier [`themes/`](../themes) : voir le [README](../README.md#couleurs).

## Écran d'accueil conseillé

Lumo ajoute ses propres rangées (hero, studios, plateformes, ajouts récents par série, genres, studios). Avec le plugin **Home Screen Sections**, pour éviter les doublons :

- gardez **Continuer à regarder** (vue *Paysage*), et si vous le souhaitez *Parce que vous avez regardé*, *Regarder à nouveau*, *Collections* (vue *Portrait*) ;
- désactivez **À suivre**, **Mes médias**, **Ajouté récemment dans…** et **Genre**.

Sans Home Screen Sections, l'accueil natif de Jellyfin s'affiche entre les rangées de Lumo, sans conflit.

## Installation à la main

1. Collez le contenu de [`lumo.css`](../lumo.css) dans *CSS personnalisée*.
2. Installez **JavaScript Injector** : *Plugins → Dépôts →* `https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json`, puis *Catalogue → JavaScript Injector*. Redémarrez.
3. Dans *JavaScript Injector*, ajoutez un script nommé `Lumo`, collez [`lumo.js`](../lumo.js), cochez *Enabled* et enregistrez.

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
| Logos de studios remplacés par leur nom | Le serveur ou l'appareil n'atteint pas `cdn.jsdelivr.net`. Ce n'est que cosmétique. |
| Une rangée de genre n'apparaît pas | Moins de 4 titres pour ce genre dans votre bibliothèque : la rangée est masquée volontairement. |
| Le bouton Lecture ouvre la fiche au lieu de lancer la lecture | La lecture à distance sur sa propre session a échoué (droits de lecture, session absente). La fiche s'ouvre en secours. |

Journal du serveur : `journalctl -u jellyfin` ou `/var/log/jellyfin/`. Messages de Lumo : console du navigateur, préfixe `[Lumo]`.
