# Set up pptx-convert (PowerPoint or LibreOffice)

> **Audience:** users who need PowerPoint-identical PDFs · **Last reviewed:** 2026-10-10

## Microsoft PowerPoint on macOS

1. Install PowerPoint (`/Applications/Microsoft PowerPoint.app`).
2. Run a build with `--pdf-engine pptx-convert`. PowerPoint opens briefly.
3. The first time, PowerPoint asks to **Grant Access** to the folder — accept. If the build reports that PowerPoint did not answer in time (AppleEvent -1712), accept the dialog and run again.
4. macOS may also ask whether your terminal may control PowerPoint (Automation permission) — allow it.

## LibreOffice (macOS, Linux, Windows, CI)

```sh
brew install --cask libreoffice        # macOS
sudo apt-get install -y libreoffice-impress   # Debian/Ubuntu
```

SlideCraft finds `soffice` on `PATH` or at `/Applications/LibreOffice.app/Contents/MacOS/soffice` (override with `SOFFICE_PATH`). Force it even when PowerPoint is installed: `SLIDECRAFT_CONVERTER=libreoffice`.

LibreOffice renders Arial/Georgia with its own substitutes if they are not installed; on Linux install `ttf-mscorefonts-installer` or accept the metric-compatible Liberation fonts.
