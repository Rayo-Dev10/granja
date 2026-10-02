#!/bin/sh
set -eu
app=/home/sites/42b/e/e52161a3c2/public_html/pasantia
package=/home/sites/42b/e/e52161a3c2/seguimiento-20261002.tar.gz
test "$(realpath "$app")" = "$app"
test -f "$app/index.html"
test -d "$app/datos-servidor"
stage=$(mktemp -d /home/sites/42b/e/e52161a3c2/deploy-seguimiento-XXXXXX)
backup=/home/sites/42b/e/e52161a3c2/backup_public_html/pasantia-before-seguimiento-$(date -u +%Y%m%d-%H%M%S)
test ! -e "$backup"
cp -a "$app" "$backup"
mkdir "$stage/files"
tar -xzf "$package" -C "$stage/files"
cd "$app"
find datos-servidor -type f -exec sha256sum {} \; | sort > "$stage/datos-before.sha256"
# Primero recursos, después páginas: nunca desplegar configuración ni datos editables.
for extension in js css csv html; do
  find "$stage/files" -type f -name "*.$extension" | while IFS= read -r file; do
    relative=${file#"$stage/files/"}
    case "$relative" in
      api/*|datos-servidor/*|../*) exit 10 ;;
    esac
    target="$app/$relative"
    mkdir -p "$(dirname "$target")"
    cp "$file" "$target.codex-new"
    mv "$target.codex-new" "$target"
  done
done
find datos-servidor -type f -exec sha256sum {} \; | sort > "$stage/datos-after.sha256"
cmp "$stage/datos-before.sha256" "$stage/datos-after.sha256"
cd "$stage/files"
find . -type f -exec sha256sum {} \; > "$stage/archivos.sha256"
cd "$app"
sha256sum -c "$stage/archivos.sha256"
printf 'RESPALDO=%s\nVERIFICACION=%s\nDATOS_SERVIDOR=sin cambios\n' "$backup" "$stage"
