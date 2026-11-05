#!/usr/bin/env bash
# Lumo — installation, mise à jour et désinstallation pour Jellyfin 12 (Debian/Ubuntu, LXC ou VM).
#
#   curl -fsSL https://raw.githubusercontent.com/0x80070006/Lumo-jellyfin-theme/main/install.sh | bash
#   … | bash -s -- --accent "#e50914"          # changer la couleur dominante
#   … | bash -s -- --uninstall                 # tout retirer
#
# Ce que fait le script :
#   1. vérifie Jellyfin et installe si besoin les plugins File Transformation et
#      JavaScript Injector (somme MD5 du dépôt officiel vérifiée) ;
#   2. sauvegarde la configuration actuelle dans /var/lib/jellyfin/lumo-backups/ ;
#   3. copie TOUT le CSS dans « CSS personnalisée » et TOUT le JS dans JavaScript
#      Injector : aucun fichier de jellyfin-web n'est modifié, aucune dépendance CDN
#      à l'exécution (seuls les logos de studios viennent de jsDelivr, version figée) ;
#   4. redémarre Jellyfin.
# Le script est idempotent : relancez-le pour mettre à jour.
set -euo pipefail

VERSION="${LUMO_VERSION:-1.2.0}"
REPO="0x80070006/Lumo-jellyfin-theme"
RAW="https://raw.githubusercontent.com/${REPO}/v${VERSION}"
CDN="https://cdn.jsdelivr.net/gh/${REPO}@${VERSION}/"
CONF_DIR="${JELLYFIN_CONFIG_DIR:-/etc/jellyfin}"
DATA_DIR="${JELLYFIN_DATA_DIR:-/var/lib/jellyfin}"
PLUGINS_DIR="${DATA_DIR}/plugins"
URL="http://127.0.0.1:8096"

ACTION="install"
ACCENT=""
INK=""
SOURCE=""
RESTART=1
PLUGINS=1

c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_dim=$'\e[2m'; c_off=$'\e[0m'
say()  { printf '%s▸%s %s\n' "$c_ok" "$c_off" "$*"; }
warn() { printf '%s!%s %s\n' "$c_warn" "$c_off" "$*" >&2; }
die()  { printf '%s✗%s %s\n' "$c_err" "$c_off" "$*" >&2; exit 1; }

usage() {
  cat <<EOF
Lumo ${VERSION} — thème Jellyfin

  --accent "#rrggbb"   couleur dominante (conservée entre mises à jour sinon)
  --ink "#rrggbb"      couleur du texte posé sur la couleur dominante
  --uninstall          retirer Lumo (CSS et script) ; les plugins restent installés
  --no-plugins         ne pas installer File Transformation / JavaScript Injector
  --no-restart         ne pas redémarrer Jellyfin
  --source DIR         utiliser lumo.css / lumo.js locaux au lieu de GitHub
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --accent) ACCENT="${2:-}"; shift 2 ;;
    --ink) INK="${2:-}"; shift 2 ;;
    --uninstall) ACTION="uninstall"; shift ;;
    --no-restart) RESTART=0; shift ;;
    --no-plugins) PLUGINS=0; shift ;;
    --source) SOURCE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "option inconnue : $1 (voir --help)" ;;
  esac
done

for v in "$ACCENT" "$INK"; do
  [ -z "$v" ] || [[ "$v" =~ ^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$ ]] || die "couleur invalide : $v (format #rrggbb)"
done

[ "$(id -u)" -eq 0 ] || die "lancez le script en root (dans le conteneur Jellyfin)."
[ -d "$CONF_DIR" ] && [ -d "$DATA_DIR" ] || die "Jellyfin introuvable ($CONF_DIR, $DATA_DIR)."
command -v python3 >/dev/null || die "python3 est requis (apt install python3)."
command -v curl >/dev/null || die "curl est requis (apt install curl)."

SERVER_VERSION="$(dpkg-query -W -f='${Version}' jellyfin-server 2>/dev/null || true)"
SERVER_MAJOR="${SERVER_VERSION%%.*}"
[ -n "$SERVER_VERSION" ] || warn "version de jellyfin-server inconnue (paquet non trouvé) ; on continue."
if [ -n "$SERVER_MAJOR" ] && [ "$SERVER_MAJOR" -lt 12 ] 2>/dev/null; then
  die "Lumo ${VERSION} vise Jellyfin 12 (installé : ${SERVER_VERSION})."
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${DATA_DIR}/lumo-backups/${STAMP}"

backup() {
  mkdir -p "$BACKUP"
  for f in "${CONF_DIR}/branding.xml" "${PLUGINS_DIR}/configurations/Jellyfin.Plugin.JavaScriptInjector.xml"; do
    [ -f "$f" ] && cp -a "$f" "$BACKUP/"
  done
  say "sauvegarde : ${BACKUP}"
}

# ── Plugins ────────────────────────────────────────────────────────────────
install_plugin() { # nom, manifeste
  local name="$1" manifest="$2"
  if compgen -G "${PLUGINS_DIR}/${name}_*" >/dev/null; then
    say "plugin ${name} : déjà installé"
    return
  fi
  say "plugin ${name} : téléchargement"
  curl -fsSL "$manifest" -o "$TMP/manifest.json" || die "manifeste injoignable : $manifest"
  python3 - "$TMP/manifest.json" "$name" "${SERVER_MAJOR:-12}" > "$TMP/plugin.env" <<'PY' || die "aucune version de ${name} compatible avec Jellyfin ${SERVER_MAJOR}"
import json, sys
manifest, name, major = sys.argv[1], sys.argv[2], sys.argv[3]
for p in json.load(open(manifest)):
    if p.get("name") != name:
        continue
    for v in p.get("versions", []):
        if str(v.get("targetAbi", "")).split(".")[0] == major:
            print(f'P_VERSION="{v["version"]}"\nP_URL="{v["sourceUrl"]}"\nP_MD5="{v["checksum"].lower()}"')
            sys.exit(0)
sys.exit(1)
PY
  # shellcheck disable=SC1091
  . "$TMP/plugin.env"
  curl -fsSL "$P_URL" -o "$TMP/plugin.zip"
  local sum; sum="$(md5sum "$TMP/plugin.zip" | cut -d' ' -f1)"
  [ "$sum" = "$P_MD5" ] || die "somme de contrôle invalide pour ${name} (${sum} ≠ ${P_MD5})"
  local dest="${PLUGINS_DIR}/${name}_${P_VERSION}"
  mkdir -p "$dest"
  python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$TMP/plugin.zip" "$dest"
  chown -R jellyfin:jellyfin "$dest"
  say "plugin ${name} ${P_VERSION} : installé"
}

# ── Configuration (CSS de branding + script de JavaScript Injector) ────────
configure() { # install|uninstall
  python3 - "$1" "${CONF_DIR}/branding.xml" "${PLUGINS_DIR}/configurations/Jellyfin.Plugin.JavaScriptInjector.xml" \
    "$TMP/lumo.css" "$TMP/lumo.js" "$VERSION" "$CDN" "$ACCENT" "$INK" <<'PY'
import os, re, sys
import xml.etree.ElementTree as ET

action, branding_path, injector_path, css_path, js_path, version, cdn, accent, ink = sys.argv[1:10]
MARK = "/* Lumo "

def load(path, root_tag):
    if os.path.exists(path):
        return ET.parse(path)
    return ET.ElementTree(ET.Element(root_tag))

def child(parent, tag, text=None):
    node = parent.find(tag)
    if node is None:
        node = ET.SubElement(parent, tag)
    if text is not None:
        node.text = text
    return node

def save(tree, path):
    ET.indent(tree, space="  ")
    tree.write(path, encoding="utf-8", xml_declaration=True)

# Branding : tout le CSS, puis la couleur dominante en dernier (elle l'emporte).
b_tree = load(branding_path, "BrandingOptions")
b_root = b_tree.getroot()
css_node = child(b_root, "CustomCss")
current = css_node.text or ""

if action == "install":
    old_accent = re.search(r"--lumo-accent:\s*(#[0-9a-fA-F]{3,6})", current.split("Couleur dominante")[-1]) if "Couleur dominante" in current else None
    old_ink = re.search(r"--lumo-accent-ink:\s*(#[0-9a-fA-F]{3,6})", current.split("Couleur dominante")[-1]) if "Couleur dominante" in current else None
    acc = accent or (old_accent.group(1) if old_accent else "#f2a541")
    ink_ = ink or (old_ink.group(1) if old_ink else "#1a1206")
    if current.strip() and MARK not in current and "Lumo" not in current:
        print("  ancienne CSS personnalisée remplacée (copie dans la sauvegarde)")
    css = open(css_path, encoding="utf-8").read().strip()
    css_node.text = (
        f"{MARK}{version} — installé par install.sh ; relancez-le pour mettre à jour. */\n\n"
        f"{css}\n\n"
        "/* ═══ Couleur dominante : modifiez ces deux valeurs puis enregistrez (Ctrl+F5) ═══ */\n"
        f":root {{\n  --lumo-accent: {acc};\n  --lumo-accent-ink: {ink_};\n}}\n"
    )
    print(f"  CSS personnalisée : Lumo {version}, couleur {acc}")
else:
    if "Lumo" in current:
        css_node.text = ""
        print("  CSS personnalisée : vidée")
child(b_root, "SplashscreenEnabled", child(b_root, "SplashscreenEnabled").text or "true")
save(b_tree, branding_path)

# JavaScript Injector : une entrée « Lumo » avec tout le script en ligne.
i_tree = load(injector_path, "PluginConfiguration")
i_root = i_tree.getroot()
scripts = child(i_root, "CustomJavaScripts")
for entry in list(scripts):
    if (entry.findtext("Name") or "").strip() == "Lumo":
        scripts.remove(entry)
if action == "install":
    js = open(js_path, encoding="utf-8").read()
    entry = ET.SubElement(scripts, "CustomJavaScriptEntry")
    ET.SubElement(entry, "Name").text = "Lumo"
    ET.SubElement(entry, "Script").text = f'window.LUMO_BASE = "{cdn}";\n{js}'
    ET.SubElement(entry, "Src")
    ET.SubElement(entry, "Module").text = "false"
    ET.SubElement(entry, "Enabled").text = "true"
    ET.SubElement(entry, "RequiresAuthentication").text = "false"
    print("  JavaScript Injector : script Lumo installé")
else:
    print("  JavaScript Injector : script Lumo retiré")
for tag, default in (("PluginJavaScripts", None), ("DisableScriptInjectionMiddleware", "false"), ("AllowExternalScriptUrls", "false")):
    if i_root.find(tag) is None:
        child(i_root, tag, default)
os.makedirs(os.path.dirname(injector_path), exist_ok=True)
save(i_tree, injector_path)
PY
  chown jellyfin:jellyfin "${CONF_DIR}/branding.xml" "${PLUGINS_DIR}/configurations/Jellyfin.Plugin.JavaScriptInjector.xml"
  chmod 640 "${CONF_DIR}/branding.xml"
}

restart() {
  [ "$RESTART" -eq 1 ] || { warn "redémarrage ignoré : redémarrez Jellyfin pour appliquer."; return; }
  say "redémarrage de Jellyfin"
  systemctl restart jellyfin
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null "${URL}/System/Info/Public" 2>/dev/null && break
    sleep 2
  done
  # Laisse les plugins enregistrer leurs transformations avant les premières visites.
  sleep 8
  systemctl is-active --quiet jellyfin || die "Jellyfin ne redémarre pas : journalctl -u jellyfin"
}

# ── Exécution ───────────────────────────────────────────────────────────────
if [ "$ACTION" = "uninstall" ]; then
  backup
  configure uninstall
  restart
  say "Lumo retiré. Rechargez Jellyfin avec Ctrl+F5."
  exit 0
fi

say "Lumo ${VERSION} pour Jellyfin ${SERVER_VERSION:-?}"
if [ -n "$SOURCE" ]; then
  cp "$SOURCE/lumo.css" "$SOURCE/lumo.js" "$TMP/"
else
  curl -fsSL "${RAW}/lumo.css" -o "$TMP/lumo.css" || die "téléchargement impossible : ${RAW}/lumo.css"
  curl -fsSL "${RAW}/lumo.js" -o "$TMP/lumo.js" || die "téléchargement impossible : ${RAW}/lumo.js"
fi
grep -q "lumo-hero" "$TMP/lumo.css" && grep -q "__lumo" "$TMP/lumo.js" || die "fichiers Lumo invalides."

if [ "$PLUGINS" -eq 1 ]; then
  install_plugin "File Transformation" "https://www.iamparadox.dev/jellyfin/plugins/manifest.json"
  install_plugin "JavaScript Injector" "https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json"
fi

backup
configure install
restart

cat <<EOF

${c_ok}Lumo ${VERSION} est installé.${c_off}
  • Rechargez Jellyfin avec Ctrl+F5 sur chaque appareil (une fois).
  • Couleur dominante : Tableau de bord > Général > CSS personnalisée (fin du fichier),
    ou relancez le script avec --accent "#rrggbb".
  • Conseillé avec Home Screen Sections : gardez « Continuer à regarder », désactivez
    « À suivre », « Mes médias », « Ajouté récemment dans… » et « Genre ».
${c_dim}  Sauvegarde : ${BACKUP}${c_off}
EOF
