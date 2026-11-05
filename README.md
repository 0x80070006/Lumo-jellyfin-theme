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

### 1. Le thème CSS

Tableau de bord → **Général** → **CSS personnalisée** :

```css
@import url("https://cdn.jsdelivr.net/gh/0x80070006/Lumo-jellyfin-theme@1/lumo.css");

/* Couleur dominante */
:root {
  --lumo-accent: #f2a541;      /* boutons, liserés, roulette… */
  --lumo-accent-ink: #1a1206;  /* texte posé sur la couleur dominante */
}
```

Vous pouvez aussi coller directement le contenu de [`lumo.css`](lumo.css) (aucune requête réseau supplémentaire).

### 2. La couche interactive (hero, studios, genres, dé)

1. Installez les plugins **File Transformation** et **JavaScript Injector** (dépôt `https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json`), puis redémarrez Jellyfin.
2. Tableau de bord → **JavaScript Injector** → ajoutez un script, collez [`injector-snippet.js`](injector-snippet.js), cochez *Enabled*, enregistrez.
3. Rechargez la page (Ctrl+F5).

Le plugin ajoute le script à la page au moment où Jellyfin la sert : les mises à jour de Jellyfin n'effacent rien.

### Écran d'accueil conseillé

Avec *Home Screen Sections*, gardez **Continuer à regarder** (vue paysage) et désactivez **À suivre**, **Mes médias**, **Ajouté récemment dans…** et **Genre** : Lumo les remplace (ajouts récents regroupés par série, rangées de genres).

## Personnaliser

Variables CSS disponibles dans `:root` : `--lumo-accent`, `--lumo-accent-ink`, `--lumo-bg`, `--lumo-bg-raised`, `--lumo-surface`, `--lumo-text`, `--lumo-text-dim`, `--lumo-radius`, `--lumo-radius-card`.

Options JavaScript (à placer avant le chargeur, dans le même script) :

```js
window.LUMO_CONFIG = { heroItems: 8, heroIntervalMs: 8000, diceHistory: 60 };
```

## Dépannage

- **L'accueil reste celui de Jellyfin d'origine après un redémarrage** : rechargez sans cache (Ctrl+F5). Un navigateur qui a chargé la page pendant le redémarrage peut garder une version sans les modifications des plugins.
- **Rien de Lumo n'apparaît** : vérifiez que JavaScript Injector est actif et que `cdn.jsdelivr.net` est joignable.

## Désinstaller

Videz **CSS personnalisée** et désactivez le script dans JavaScript Injector.

## Logos

Les logos de studios proviennent de Wikimedia Commons (voir [`assets/logos/SOURCES.md`](assets/logos/SOURCES.md)). Les marques appartiennent à leurs titulaires.

## Licence

MIT
