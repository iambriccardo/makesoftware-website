import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = process.cwd();
const staticEntries = [
  "assets",
  "site.webmanifest",
  "old-index.html",
  "new-brand.html",
  "tomo-inspired.html",
  "legacy-index.html"
];

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".woff2", "font/woff2"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"]
]);

function copyRecursive(source, destination) {
  if (!fs.existsSync(source)) return;
  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      if (entry === ".DS_Store") continue;
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function legacyStaticPlugin() {
  return {
    name: "make-software-legacy-static",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
        const requestPath = pathname.replace(/^\/+/, "");
        const allowed = staticEntries.some((entry) => requestPath === entry || requestPath.startsWith(`${entry}/`));

        if (!allowed) {
          next();
          return;
        }

        const filePath = path.resolve(rootDir, requestPath);
        if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }

        response.setHeader("Cache-Control", "no-cache");
        const contentType = contentTypes.get(path.extname(filePath).toLowerCase());
        if (contentType) response.setHeader("Content-Type", contentType);
        if (request.method === "HEAD") {
          response.end();
          return;
        }
        fs.createReadStream(filePath).pipe(response);
      });
    },
    closeBundle() {
      const outDir = path.resolve(rootDir, "dist");
      for (const entry of staticEntries) {
        copyRecursive(path.resolve(rootDir, entry), path.resolve(outDir, entry));
      }
      fs.writeFileSync(path.resolve(outDir, ".nojekyll"), "");
    }
  };
}

export default defineConfig({
  plugins: [react(), legacyStaticPlugin()],
  build: {
    cssCodeSplit: false,
    target: "es2022"
  }
});
