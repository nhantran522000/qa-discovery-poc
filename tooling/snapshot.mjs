// snapshot.mjs — capture a deterministic accessibility (aria) snapshot + screenshot per route.
//
// This is the CANONICAL snapshot format for the PoC. It mirrors what the Wolfpack agent gets
// from the Playwright MCP `browser_snapshot` tool (Playwright's YAML aria tree), so the diff
// logic proven here transfers directly to the agent.
//
// Usage:
//   node snapshot.mjs --base-url https://<org>.github.io/<repo>/ --routes ../routes.json --out ../snapshots
//   node snapshot.mjs --base-url https://<org>.github.io/<repo>/ --routes ../changeset-v2/routes.v2.json --out /tmp/v2
//
// Then diff two snapshot dirs:   diff -ru ../snapshots /tmp/v2
//
// Why aria YAML and not a screenshot or raw DOM:
//   - aria tree is SEMANTIC (roles, names, fields, links) → robust to CSS churn, diffable, grep-able
//   - screenshots are kept too, but only as a human-review artifact (pixel diffs are noisy)
//   - raw DOM is rejected: class/hash churn drowns the signal

import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = arg("base-url");
const routesPath = resolve(here, arg("routes", "../routes.json"));
const outDir = resolve(here, arg("out", "../snapshots"));

if (!baseUrl) {
  console.error("ERROR: --base-url is required (e.g. https://nhantran522000.github.io/caredocs-qa-discovery-poc/)");
  process.exit(1);
}

const slugify = (p) => p.replace(/\.html$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "index";
const joinUrl = (base, path) => `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

const { routes } = JSON.parse(await readFile(routesPath, "utf8"));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const manifest = [];
for (const route of routes) {
  const url = joinUrl(baseUrl, route.path);
  const slug = slugify(route.path);
  await page.goto(url, { waitUntil: "networkidle" });

  // Playwright's aria snapshot — the YAML tree the MCP also emits.
  const aria = await page.locator("body").ariaSnapshot();
  const header = `# route: ${route.path}\n# feature: ${route.feature}\n# url: ${url}\n`;
  await writeFile(join(outDir, `${slug}.aria.yaml`), `${header}\n${aria}\n`, "utf8");

  // Human-review screenshot (NOT the diff source). `path` must be a string.
  await page.screenshot({ path: join(outDir, `${slug}.png`), fullPage: true });

  manifest.push({ path: route.path, feature: route.feature, slug, url });
  console.log(`captured  ${route.path.padEnd(20)} -> ${slug}.aria.yaml + ${slug}.png`);
}

await writeFile(
  join(outDir, "manifest.json"),
  `${JSON.stringify({ baseUrl, capturedRoutes: manifest }, null, 2)}\n`,
  "utf8",
);

await browser.close();
console.log(`\nDone. ${manifest.length} routes captured into ${outDir}`);
