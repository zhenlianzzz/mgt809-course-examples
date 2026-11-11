# MGT 809 course examples

Interactive classroom examples for **MGT 809: Analytics in the Age of AI**, Professor Zhen Lian, Yale School of Management, Fall 2026.

**Website:** https://zhenlianzzz.github.io/mgt809-course-examples/

- Lecture 1: Fancy-ish Wines — local pricing practice, two cost scenarios, and downloadable team results.
- Lecture 2: SOM Airlines — airline network challenge.
- Lecture 3: Olan Builders — project scheduling and crashing.
- Lecture 4: The Assignment Challenge — case brief and student workbook.
- Lecture 5: Train a Language Model — click through training on seven country-capital sentences and watch predictions, probabilities, weights, and loss change. The existing `next-word-lab/` address is preserved.

All five examples and four original student workbooks are included. There is no attendance collection or automatic submission service. The existing instructor resources are openly accessible.

## Source and deployment

`website-assets.zip.b64` contains the reviewed website archive: HTML, CSS, JavaScript, SVG artwork, and student workbooks. This encoding preserves directories and binary workbook files when publishing through GitHub's web editor. It is not encryption.

The Pages workflow checks the archive's SHA-256 digest, unpacks it, and publishes only `source/docs`. It has read-only repository access and standard GitHub Pages deployment permissions. It does not write back to this repository or use any personal access token.

To inspect or edit the source locally:

```sh
python3 - <<'PY'
import base64, io, zipfile
from pathlib import Path
data = base64.b64decode(Path('website-assets.zip.b64').read_bytes())
zipfile.ZipFile(io.BytesIO(data)).extractall('source')
PY
python3 -m http.server 4187 --directory source/docs
```

When updating the archive, update its expected digest in `.github/workflows/pages.yml` too. Select **Settings → Pages → GitHub Actions** as the publication source. A push to `main` checks and deploys the website automatically.

The wine lab saves practice attempts in the current browser and can export JSON. Airline and construction instructor boards import team receipts. Browser progress from the former ChatGPT domains does not transfer automatically.
