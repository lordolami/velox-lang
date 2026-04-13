import { readFileSync, writeFileSync, existsSync } from "node:fs";

const pkgPath = "package.json";
const changelogPath = "CHANGELOG.md";

const level = process.argv[2] || "patch";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [maj, min, pat] = pkg.version.split(".").map(Number);
let next = [maj, min, pat];
if (level === "major") next = [maj + 1, 0, 0];
else if (level === "minor") next = [maj, min + 1, 0];
else next = [maj, min, pat + 1];

pkg.version = next.join(".");
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

const entry = `## v${pkg.version} - ${new Date().toISOString().slice(0, 10)}\n- release prep\n\n`;
const prev = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : "# Changelog\n\n";
writeFileSync(changelogPath, prev + entry, "utf8");

console.log(`version bumped to ${pkg.version}`);
