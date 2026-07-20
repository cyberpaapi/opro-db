import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the OPRO catalogue shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>OPRO Catalogue<\/title>/i);
  assert.match(html, /Loading inventory/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("catalogue contains the fixed taxonomy and every corrected item", async () => {
  const catalog = JSON.parse(await readFile(new URL("../public/catalog.json", import.meta.url), "utf8"));
  assert.equal(catalog.totalItems, 21782);
  assert.equal(catalog.categories.length, 25);
  assert.equal(catalog.taxonomySubcategoryCount, 385);
  const items = catalog.categories.flatMap((category) =>
    category.subcategories.flatMap((subcategory) => subcategory.items),
  );
  assert.equal(items.length, catalog.totalItems);
  assert.ok(items.every((item) => item.name && Number.isInteger(item.row)));
});
