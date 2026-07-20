import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const work = path.join(root, "work", "duplicates");
const source = JSON.parse(await fs.readFile(path.join(work, "source_extract.json"), "utf8"));
const assignments = JSON.parse(
  await fs.readFile(path.join(work, "recategorization_assignments.json"), "utf8"),
);
const taxonomy = JSON.parse(await fs.readFile(path.join(work, "taxonomy_audit.json"), "utf8"));
const recovered = JSON.parse(
  await fs.readFile(path.join(root, "work", "opro_final", "removed_classifications.json"), "utf8"),
);
const rows = source.sheets.find((sheet) => sheet.name === "Categorised Items").rows.slice(1);

if (rows.length !== assignments.length) {
  throw new Error(`Item row mismatch: ${rows.length} vs ${assignments.length}`);
}

const categoryNames = [...Object.keys(taxonomy.allowed), "Uncategorised Items"];
const order = new Map(categoryNames.map((category, index) => [category, index]));
const grouped = new Map();

for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index];
  const assignment = assignments[index];
  const category = assignment.new_category;
  const subcategory = assignment.new_subcategory || "";
  if (!grouped.has(category)) grouped.set(category, new Map());
  const subcategories = grouped.get(category);
  if (!subcategories.has(subcategory)) subcategories.set(subcategory, []);
  subcategories.get(subcategory).push({
    name: row[2] || assignment.item_name || "Unnamed item",
    sku: row[3] || "",
    unit: row[4] || "",
    oldCategory: row[5] || assignment.old_zoho_category || "",
    assignedBy: row[6] || assignment.assigned_by || "",
    row: assignment.excel_row,
  });
}

for (const item of recovered) {
  const category = item.new_category;
  const subcategory = item.new_subcategory || "";
  if (!grouped.has(category)) grouped.set(category, new Map());
  const subcategories = grouped.get(category);
  if (!subcategories.has(subcategory)) subcategories.set(subcategory, []);
  subcategories.get(subcategory).push({
    name: item.item_name || "Unnamed item",
    sku: item.sku || "",
    unit: item.usage_unit || "",
    oldCategory: item.old_zoho_category || "",
    assignedBy: "Recovered from Removed.xlsx",
    row: assignments.length + item.removed_excel_row,
  });
}

const categories = categoryNames
  .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
  .map((name) => {
    const populated = grouped.get(name) || new Map();
    const subcategoryNames = [
      ...new Set([...(populated.has("") ? [""] : []), ...(taxonomy.allowed[name] || [])]),
    ];
    const subcategories = subcategoryNames.map((subName) => {
      const items = populated.get(subName) || [];
      return { name: subName, count: items.length, items };
    });
    return {
      name,
      count: subcategories.reduce((sum, subcategory) => sum + subcategory.count, 0),
      subcategories,
    };
  });

const payload = {
  generatedAt: "2026-07-20",
  totalItems: assignments.length + recovered.length,
  taxonomySubcategoryCount: Object.values(taxonomy.allowed).reduce(
    (sum, subcategories) => sum + subcategories.length,
    0,
  ),
  categories,
};

await fs.mkdir(path.join(root, "public"), { recursive: true });
await fs.writeFile(path.join(root, "public", "catalog.json"), JSON.stringify(payload));
console.log(
  JSON.stringify({
    categories: categories.length,
    items: payload.totalItems,
    bytes: Buffer.byteLength(JSON.stringify(payload)),
  }),
);
