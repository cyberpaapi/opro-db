import React from "react";
import { createRoot } from "react-dom/client";
import CatalogBrowser from "../app/catalog-browser";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CatalogBrowser />
  </React.StrictMode>,
);
