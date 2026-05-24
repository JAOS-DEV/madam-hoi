import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const distIndex = resolve("dist", "index.html");
const dist404 = resolve("dist", "404.html");

await copyFile(distIndex, dist404);
console.log("Created dist/404.html for GitHub Pages SPA fallback.");
