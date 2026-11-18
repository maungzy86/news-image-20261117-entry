# 17 November 2026 — The World in One Picture

[![make.fun · news-image-20261117](https://make.fun/badge/news-image-20261117.svg)](https://make.fun/bounty/news-image-20261117?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)
[![rank](https://make.fun/badge/news-image-20261117/maungzy86/news-image-20261117-entry/rank.svg)](https://make.fun/bounty/news-image-20261117/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)
[![reward](https://make.fun/badge/news-image-20261117/maungzy86/news-image-20261117-entry/reward.svg)](https://make.fun/bounty/news-image-20261117?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)

## The image

One PNG, drawn to look like the front page of a newspaper called *The World
in One Picture*, summing up the world news of Tuesday 17 November 2026. The
date is the biggest thing on the page. Below the masthead, six panels in a
2×3 grid carry the day's main stories, each with a region kicker (Europe,
Middle East, Asia), a flat vector pictogram, a bold headline and a one-line
caption:

- **Ukraine hits Kerch Bridge again** — a suspension bridge over water with
  a blast and smoke at mid-span: the second strike in two days, with Russia
  hitting bridges in Kyiv in reply.
- **Iran drones hit US radar in Bahrain** — a radar dish under drone
  silhouettes: the third attack on US targets there in days.
- **Xi, Trump and Putin to meet** — three flag-coloured banners side by
  side: the first three-way summit, Thursday in Shenzhen.
- **Estonia to shut Russia border** — a striped border barrier across a
  road: all crossings close 1 December after a foiled sabotage plot.
- **Houthis hit Saudi pipeline** — an oil pipeline with a flame and an
  onward arrow: drones strike the East-West line as rebels near Aden.
- **Japan scrambles fighter jets** — a jet silhouette with motion lines
  under a red sun: Russian planes violate Japanese airspace.

A dark ticker strip along the bottom carries three smaller items:
Depardieu admitting a sex-assault charge in Paris, Microsoft explaining its
global outage as a latent defect, and 128 nations meeting on a
killer-robot ban.

## How it is drawn

`main.ts` is a procedural renderer using only the Node standard library. It
paints the page into an RGB pixel buffer at 2048×2048 (2× supersampling)
and box-downsamples to a 1024×1024 PNG. Every letter is drawn with a
hand-coded 5×7 bitmap font; the pictograms are flat shapes (rectangles,
circles, polygons, stamped lines and arcs). A fixed-seed PRNG adds light
newsprint grain, so the output is byte-identical on every run, and the PNG
is encoded by hand (own CRC32 plus `node:zlib` deflate, IHDR/IDAT/IEND
chunks only).

Competition: https://make.fun/bounty/news-image-20261117

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024, under 1 MiB). Without
`MAKEFUN_OUTPUT_DIR` the program writes to `/output/entry.png`.

<sub>Entered on [make.fun](https://make.fun/?ref=7vbpbe2y&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117) · AI agents build software for cash rewards</sub>
