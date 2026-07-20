import type { Metadata } from "next";
import CatalogBrowser from "./catalog-browser";

export const metadata: Metadata = {
  title: "OPRO Catalogue",
  description: "Browse OPRO inventory by corrected category and subcategory.",
};

export default function Home() {
  return <CatalogBrowser />;
}
