# Bundled fonts

SlideCraft measures and embeds text with open fonts that are **metric-compatible** with the
system fonts written into PPTX files. Glyph advance widths match, so a line that fits in our
measurer fits in PowerPoint and Keynote. See [ADR 0005](../docs/adr/0005-metric-compatible-fonts.md).

| Directory | Family | Stands in for | Scripts | License | Upstream |
|---|---|---|---|---|---|
| `liberation-sans/` | Liberation Sans 2.1.5 | Arial | Latin, Greek, Cyrillic | SIL OFL 1.1 (`LICENSE`) | https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5 |
| `liberation-serif/` | Liberation Serif 2.1.5 | Times New Roman | Latin, Greek, Cyrillic | SIL OFL 1.1 (`LICENSE`) | same release |
| `gelasio/` | Gelasio (2022) | Georgia | Latin only | SIL OFL 1.1 (`OFL.txt`) | https://github.com/SorkinType/Gelasio/tree/main/fonts/ttf |

Gelasio has no Cyrillic glyphs. Themes that use Georgia declare a Cyrillic override
(`Times New Roman` measured with Liberation Serif), applied automatically when a deck's text
contains Cyrillic.

## SHA-256

```
76d04c18ea243f426b7de1f3ad208e927008f961dc5945e5aad352d0dfde8ee8  liberation-sans/LiberationSans-Regular.ttf
788abee4c806d660e8aee46689dd8540cd4bb98da03dcc9d171ce3efd99a9173  liberation-sans/LiberationSans-Bold.ttf
e5bae5c4cde31f22142753855f4f8fb86da6ff39955ed3c0a11248b0d16948b0  liberation-sans/LiberationSans-Italic.ttf
698da70fc191cc5f33ad4d6d3fe830fe4624b898ea2e3169955928b7c491f1ee  liberation-sans/LiberationSans-BoldItalic.ttf
058ea80864aef09a23f45cbec2bb5400bc3dfbdea01c3f10538a21fcb497fb74  liberation-serif/LiberationSerif-Regular.ttf
d754ba427cfe0bca54ae052384baa8f842da5bd6550ad4da024ac441e7a7d5ce  liberation-serif/LiberationSerif-Bold.ttf
0e3dea9f8d613e006ccfa62201f33e265d19167bd0907725c3e145368b04fc2e  liberation-serif/LiberationSerif-Italic.ttf
f17db8af71e24d2066b587546021d4f0b296be389512b658dec3c09affeb11a7  liberation-serif/LiberationSerif-BoldItalic.ttf
48c797fbe0e07c48a18cb962e7bdfa23f19618327dddf54093265328dc9eb39d  gelasio/Gelasio-Regular.ttf
e0ef3addf1acf35f5c6aef2be00d0a2c01363bf70a5950e16650976051a0c462  gelasio/Gelasio-Bold.ttf
1d8bda4ff258bb8251eae4f7d7500c8d97d084136192bb264bc2305168765d1b  gelasio/Gelasio-Italic.ttf
aa87e21b46aef3dcb50a68dc6e1946f0c0a9819d067e4be6a98a6daa8f5b3c16  gelasio/Gelasio-BoldItalic.ttf
```
