# Lumo — thème Jellyfin

Un thème sombre pour Jellyfin 12, pensé comme une application de streaming, sans casser Jellyfin.

**Thème CSS** (`lumo.css`)
- Fond graphite, une couleur dominante modifiable, coins nets.
- Toutes les affiches et vignettes à la même taille ; survol sans chevauchement.
- Aucun contenu natif masqué.

**Couche interactive** (`lumo.js`, optionnelle)
- Grand hero cinématique en haut de l'accueil : logo du titre, infos, Lecture / Plus d'infos, défilement automatique (pause au survol, balayage tactile, flèches clavier).
- Rangées **Studios** et **Plateformes** : 5 tuiles visibles, flèches pour défiler. Un clic ouvre tous les titres du studio, même répartis sur plusieurs studios (Walt Disney Pictures + Animation Studios…).
- Rangées **Ajouts récents** par bibliothèque (séries et animes regroupés par série), **10 rangées par genre** et des rangées **par studio** : 5 affiches visibles, 15 au total, puis une tuile « Voir plus ».
- Bouton **dé** à côté de la recherche : choisir un genre, Films / Séries, « non vus », puis une roulette tire un titre — jamais le même que les derniers tirages.

Principes : uniquement l'API publique de Jellyfin, aucun fichier de `jellyfin-web` modifié, chaque module échoue seul (l'interface native reste utilisable), rangées chargées à l'approche de l'écran.

## Installation

### En une commande (recommandé)

Dans le conteneur ou la machine qui fait tourner Jellyfin, en root :

```bash
curl -fsSL https://raw.githubusercontent.com/0x80070006/Lumo-jellyfin-theme/main/install.sh | bash
```

Le script :
1. installe si besoin **File Transformation** et **JavaScript Injector** (somme de contrôle du dépôt officiel vérifiée) ;
2. sauvegarde la configuration actuelle dans `/var/lib/jellyfin/lumo-backups/` ;
3. copie **tout le CSS** dans *CSS personnalisée* et **tout le JS** dans *JavaScript Injector* : rien ne dépend d'un CDN au chargement des pages (seuls les logos de studios viennent de jsDelivr, version figée ; sans réseau, le nom du studio s'affiche à la place) ;
4. redémarre Jellyfin. Rechargez ensuite chaque appareil une fois avec Ctrl+F5.

Aucun fichier de `jellyfin-web` n'est modifié : les mises à jour de Jellyfin n'effacent rien. Relancez la même commande pour mettre à jour Lumo ; votre couleur dominante est conservée.

Options (après `bash -s --`) :

```bash
curl -fsSL https://raw.githubusercontent.com/0x80070006/Lumo-jellyfin-theme/main/install.sh | bash -s -- --accent "#e50914"
curl -fsSL https://raw.githubusercontent.com/0x80070006/Lumo-jellyfin-theme/main/install.sh | bash -s -- --uninstall
```

`--accent`, `--ink`, `--uninstall`, `--no-plugins`, `--no-restart`, `--source DIR` (fichiers locaux). Version précise : `LUMO_VERSION=1.2.0`.

### À la main

1. Collez [`lumo.css`](lumo.css) dans Tableau de bord → **Général** → **CSS personnalisée**.
2. Installez **JavaScript Injector** (dépôt `https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json`), redémarrez, puis ajoutez un script contenant [`lumo.js`](lumo.js).

### Couleur dominante

À la fin de *CSS personnalisée* :

```css
:root {
  --lumo-accent: #f2a541;      /* boutons, liserés, roulette… */
  --lumo-accent-ink: #1a1206;  /* texte posé sur la couleur dominante */
}
```

### Écran d'accueil conseillé

Avec *Home Screen Sections*, gardez **Continuer à regarder** (vue paysage) et désactivez **À suivre**, **Mes médias**, **Ajouté récemment dans…** et **Genre** : Lumo les remplace (ajouts récents regroupés par série, rangées de genres).

## Personnaliser

Variables CSS disponibles dans `:root` : `--lumo-accent`, `--lumo-accent-ink`, `--lumo-bg`, `--lumo-bg-raised`, `--lumo-surface`, `--lumo-text`, `--lumo-text-dim`, `--lumo-radius`, `--lumo-radius-card`.

Options JavaScript (à ajouter au début du script Lumo dans JavaScript Injector) :

```js
window.LUMO_CONFIG = { heroItems: 8, heroIntervalMs: 8000, diceHistory: 60 };
```

## Dépannage

- **L'accueil reste celui de Jellyfin d'origine après un redémarrage** : rechargez sans cache (Ctrl+F5). Un navigateur qui a chargé la page pendant le redémarrage peut garder une version sans les modifications des plugins.
- **Rien de Lumo n'apparaît** : vérifiez que JavaScript Injector est actif et que le script « Lumo » est coché, puis Ctrl+F5.

## Désinstaller

Relancez le script avec `--uninstall`, ou videz **CSS personnalisée** et supprimez le script « Lumo » dans JavaScript Injector.

## Logos

Les logos de studios proviennent de Wikimedia Commons (voir [`assets/logos/SOURCES.md`](assets/logos/SOURCES.md)). Les marques appartiennent à leurs titulaires.

## Licence

MIT
