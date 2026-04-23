import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesBasePath = process.env.PAGES_BASE_PATH ?? (repositoryName ? `/${repositoryName}/` : "/");
const base = process.env.GITHUB_ACTIONS ? pagesBasePath : "/";

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: "node",
    globals: true
  }
});
