# static/images — image assets

All images used by the AGRICONNECT frontend live here. They are **local files**
(no external CDN), so the interface renders identically offline, on a college
expo machine, and inside a sandboxed preview iframe.

## Files

| File | Used on | Recommended size |
|---|---|---|
| `favicon.svg` | Browser tab / app icon (referenced from `base.html`) | vector |
| `hero-field.jpg` | Landing page hero (`index.html`) | 1600 × 878 (≈171 KB) |
| `crop-placeholder.jpg` | Marketplace listing card fallback / category art | 1200 × 800 (≈257 KB) |
| `advisory-illustration.jpg` | Crop Advisory page header | 1000 × 667 (≈96 KB) |
| `subsidy-illustration.jpg` | Subsidy Checker page header | 1000 × 667 (≈77 KB) |
| `hero-field-fallback.svg` | Shown if `hero-field.jpg` fails to load | vector |
| `no-image.svg` | Generic "no photo" placeholder for listings | vector |

## How the fallback chain works

1. A listing card first tries the **backend-supplied** image
   (`listing.image_url`) — e.g. a photo the farmer uploaded.
2. If that URL is missing or fails, the `<img>` has
   `data-ag-fallback` + `onerror` handling in `static/js/main.js`, which hides
   the image and reveals the sibling `[data-ag-fallback-target]` element
   (a Bootstrap Icons leaf tile or `crop-placeholder.jpg`).
3. The hero uses `hero-field.jpg` with `hero-field-fallback.svg` as the
   `onerror` source, so the hero never renders as a broken image.

```html
<!-- Pattern used everywhere -->
<img src="{{ listing.image_url or url_for('static', filename='images/crop-placeholder.jpg') }}"
     alt="{{ listing.crop_name }} crop listing"
     loading="lazy" decoding="async"
     data-ag-fallback>
```

## Replacing or adding images

* Drop your file in this folder and reference it with
  `{{ url_for('static', filename='images/your-file.jpg') }}`.
* **Optimise before committing** — aim for < 250 KB, JPEG quality 75–82,
  progressive, and resize to the display size. Example:

  ```bash
  python - <<'PY'
  from PIL import Image
  im = Image.open("static/images/your-file.jpg").convert("RGB")
  im.thumbnail((1600, 900))
  im.save("static/images/your-file.jpg", "JPEG", quality=80, optimize=True, progressive=True)
  PY
  ```
* Keep `alt` text meaningful; decorative images use `alt=""`.
* If your deployment stores user uploads in `static/uploads/`, point
  `listing.image_url` at that path and keep the fallback as-is.

## Attribution

Replace the generated placeholder photographs with your own project photographs
or properly licensed stock images before public submission, and list the source
in this file.
