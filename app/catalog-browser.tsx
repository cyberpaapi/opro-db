"use client";

import { useEffect, useMemo, useState } from "react";

type CatalogItem = {
  name: string;
  sku: string;
  unit: string;
  oldCategory: string;
  assignedBy: string;
  row: number;
};

type CatalogSubcategory = { name: string; count: number; items: CatalogItem[] };
type CatalogCategory = { name: string; count: number; subcategories: CatalogSubcategory[] };
type Catalog = {
  generatedAt: string;
  totalItems: number;
  taxonomySubcategoryCount: number;
  categories: CatalogCategory[];
};

type ItemWithContext = CatalogItem & { category: string; subcategory: string };

const PAGE_SIZE = 50;
const ALL_SUBCATEGORIES = "__all__";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function labelSubcategory(value: string) {
  return value || "Directly under main category";
}

export default function CatalogBrowser() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState(ALL_SUBCATEGORIES);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ItemWithContext | null>(null);

  useEffect(() => {
    fetch("/catalog.json")
      .then((response) => {
        if (!response.ok) throw new Error("Catalogue unavailable");
        return response.json();
      })
      .then((data: Catalog) => setCatalog(data))
      .catch(() => setLoadError(true));
  }, []);

  const selectedCategory = useMemo(
    () => catalog?.categories.find((category) => category.name === categoryName) ?? null,
    [catalog, categoryName],
  );

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return [];
    const selectedSubcategories =
      subcategoryName === ALL_SUBCATEGORIES
        ? selectedCategory.subcategories
        : selectedCategory.subcategories.filter((subcategory) => subcategory.name === subcategoryName);
    const normalizedQuery = query.trim().toLowerCase();
    return selectedSubcategories.flatMap((subcategory) =>
      subcategory.items
        .filter((item) => {
          if (!normalizedQuery) return true;
          return `${item.name} ${item.sku} ${item.unit}`.toLowerCase().includes(normalizedQuery);
        })
        .map((item) => ({
          ...item,
          category: selectedCategory.name,
          subcategory: subcategory.name,
        })),
    );
  }, [selectedCategory, subcategoryName, query]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setSelectedItem(null);
  }, [categoryName, subcategoryName, query]);

  useEffect(() => {
    if (!selectedItem) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedItem]);

  function chooseCategory(name: string) {
    setCategoryName(name);
    setSubcategoryName(ALL_SUBCATEGORIES);
    setQuery("");
  }

  function downloadCsv() {
    if (!filteredItems.length) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Main Category", "Subcategory", "Item Name", "SKU", "Usage Unit", "Old Zoho Category", "Assigned By"],
      ...filteredItems.map((item) => [
        item.category,
        labelSubcategory(item.subcategory),
        item.name,
        item.sku,
        item.unit,
        item.oldCategory,
        item.assignedBy,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${categoryName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-") || "catalog"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loadError) {
    return (
      <main className="status-page">
        <div className="status-card">
          <p className="eyebrow">OPRO Catalogue</p>
          <h1>We couldn’t load the inventory.</h1>
          <p>Please refresh the page and try again.</p>
        </div>
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className="status-page" aria-busy="true">
        <div className="status-card loading-card">
          <div className="loading-line wide" />
          <div className="loading-line" />
          <div className="loading-line small" />
          <span className="sr-only">Loading inventory</span>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-line">
            <span className="brand-mark" aria-hidden="true">O</span>
            <span className="brand-name">OPRO Catalogue</span>
          </div>
          <p>Corrected inventory taxonomy · Updated 20 July 2026</p>
        </div>
        <div className="header-stats" aria-label="Catalogue totals">
          <div><strong>{formatCount(catalog.totalItems)}</strong><span>Items</span></div>
          <div><strong>{catalog.categories.length}</strong><span>Categories</span></div>
          <div><strong>{catalog.taxonomySubcategoryCount}</strong><span>Subcategories</span></div>
        </div>
      </header>

      <section className="workspace">
        <aside className="category-panel" aria-label="Main categories">
          <div className="panel-heading">
            <p className="eyebrow">Step 1</p>
            <h1>Select a category</h1>
            <p>Choose a main category to reveal its subcategories and items.</p>
          </div>
          <div className="mobile-category-select">
            <label htmlFor="mobile-category">Main category</label>
            <select
              id="mobile-category"
              value={categoryName}
              onChange={(event) => chooseCategory(event.target.value)}
            >
              <option value="">Choose a category</option>
              {catalog.categories.map((category) => (
                <option key={category.name} value={category.name}>
                  {category.name} ({formatCount(category.count)})
                </option>
              ))}
            </select>
          </div>
          <nav className="category-list">
            {catalog.categories.map((category) => (
              <button
                className={category.name === categoryName ? "category-button selected" : "category-button"}
                key={category.name}
                onClick={() => chooseCategory(category.name)}
                aria-pressed={category.name === categoryName}
              >
                <span>{category.name}</span>
                <span className="count-pill">{formatCount(category.count)}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="items-panel" aria-live="polite">
          {!selectedCategory ? (
            <div className="empty-state">
              <div className="empty-index">01</div>
              <p className="eyebrow">Start here</p>
              <h2>Select a main category</h2>
              <p>The matching subcategories and inventory items will appear here.</p>
              <div className="empty-example">
                <span>Category</span><span>Subcategory</span><span>Item details</span>
              </div>
            </div>
          ) : (
            <>
              <div className="items-header">
                <div>
                  <p className="eyebrow">Inventory browser</p>
                  <h2>{selectedCategory.name}</h2>
                  <p>{formatCount(selectedCategory.count)} items across {selectedCategory.subcategories.length} populated subcategories.</p>
                </div>
                <button className="export-button" onClick={downloadCsv} disabled={!filteredItems.length}>
                  Export filtered CSV
                </button>
              </div>

              <div className="filters">
                <div className="field-group">
                  <label htmlFor="subcategory">Step 2 · Subcategory</label>
                  <select
                    id="subcategory"
                    value={subcategoryName}
                    onChange={(event) => setSubcategoryName(event.target.value)}
                  >
                    <option value={ALL_SUBCATEGORIES}>All subcategories ({formatCount(selectedCategory.count)})</option>
                    {selectedCategory.subcategories.map((subcategory) => (
                      <option key={subcategory.name || "direct"} value={subcategory.name}>
                        {labelSubcategory(subcategory.name)} ({formatCount(subcategory.count)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group search-field">
                  <label htmlFor="item-search">Step 3 · Find an item</label>
                  <input
                    id="item-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search item name, SKU, or unit"
                  />
                </div>
              </div>

              <div className="results-bar">
                <p><strong>{formatCount(filteredItems.length)}</strong> matching items</p>
                <p>Showing {filteredItems.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredItems.length)}</p>
              </div>

              {visibleItems.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Item name</th>
                        <th>SKU</th>
                        <th>Usage unit</th>
                        <th><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => (
                        <tr key={`${item.row}-${item.sku}`}>
                          <td>
                            <button className="item-name" onClick={() => setSelectedItem(item)}>
                              {item.name}
                            </button>
                            <span className="mobile-item-meta">{item.sku || "No SKU"} · {item.unit || "No unit"}</span>
                          </td>
                          <td>{item.sku || "—"}</td>
                          <td>{item.unit || "—"}</td>
                          <td><button className="view-button" onClick={() => setSelectedItem(item)}>View specs</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-results">
                  <h3>No items found</h3>
                  <p>Try another subcategory or clear the search text.</p>
                  <button onClick={() => setQuery("")}>Clear search</button>
                </div>
              )}

              {pageCount > 1 && (
                <div className="pagination" aria-label="Pagination">
                  <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</button>
                  <span>Page {page} of {pageCount}</span>
                  <button onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}>Next</button>
                </div>
              )}
            </>
          )}
        </section>
      </section>

      {selectedItem && (
        <div className="drawer-layer" role="presentation" onMouseDown={() => setSelectedItem(null)}>
          <aside
            className="details-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Item specifications</p>
                <h2 id="item-title">{selectedItem.name}</h2>
              </div>
              <button className="close-button" onClick={() => setSelectedItem(null)} aria-label="Close item details">Close</button>
            </div>
            <dl className="spec-list">
              <div><dt>Main category</dt><dd>{selectedItem.category}</dd></div>
              <div><dt>Subcategory</dt><dd>{labelSubcategory(selectedItem.subcategory)}</dd></div>
              <div><dt>SKU</dt><dd className="mono">{selectedItem.sku || "Not provided"}</dd></div>
              <div><dt>Usage unit</dt><dd>{selectedItem.unit || "Not provided"}</dd></div>
              <div><dt>Original Zoho category</dt><dd>{selectedItem.oldCategory || "Not provided"}</dd></div>
              <div><dt>Assignment source</dt><dd>{selectedItem.assignedBy || "Not provided"}</dd></div>
              <div><dt>Workbook row</dt><dd className="mono">{selectedItem.row}</dd></div>
            </dl>
            <div className="drawer-note">
              <strong>Catalogue note</strong>
              <p>This item uses the corrected client-approved category and subcategory taxonomy.</p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
