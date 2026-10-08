// Tells Bing (and through IndexNow, Yandex, Seznam, Naver) that pages changed,
// so ChatGPT search and Copilot, which lean on Bing, pick them up sooner.
// Run by hand after a deploy that changes public content:
//   node scripts/indexnow.mjs            (submits every URL in the sitemap)
//   node scripts/indexnow.mjs /hull-cleaning/cost
// The key file public/<KEY>.txt proves ownership of briancline.co.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = "1dcf7425076a46f3afbabc06b4d77d64";
const HOST = "briancline.co";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const urls = args.length
  ? args.map((p) => (p.startsWith("http") ? p : `https://${HOST}${p}`))
  : [...readFileSync(resolve(root, "public/sitemap.xml"), "utf-8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow ${res.status} ${res.statusText} for ${urls.length} URL(s)`);
if (!res.ok && res.status !== 202) process.exit(1);
