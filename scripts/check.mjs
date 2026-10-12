#!/usr/bin/env node
// Keeps index.html, its Content Security Policy and the README tables in agreement.
//   node scripts/check.mjs          check everything (what CI runs)
//   node scripts/check.mjs --write  update the CSP hashes and README tables, then check
// Needs Node 18 or newer and nothing else.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const write = process.argv.includes("--write");
const pagePath = new URL("../index.html", import.meta.url);
const readmePath = new URL("../README.md", import.meta.url);
const PAGE_URL = "https://mvoshell652.github.io/swift-audit-prompts/";
const SIZES = ["XS", "S", "M", "L", "XL"];

const errors = [];
const fail = message => errors.push(message);
const dupes = list => list.filter((x, i) => list.indexOf(x) !== i);

// Browsers normalise CRLF to LF before hashing inline script and style, so do the same here.
let html = readFileSync(pagePath, "utf8").replace(/\r\n?/g, "\n");
let readme = readFileSync(readmePath, "utf8").replace(/\r\n?/g, "\n");
const originalHtml = html;
const originalReadme = readme;

// ---- Content Security Policy: the one inline <script> and <style> are allowed by hash only.
const scriptText = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
const styleText = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
const countTags = tag => (html.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
if (scriptText === undefined || styleText === undefined || countTags("script") !== 1 || countTags("style") !== 1) {
  console.error("✗ index.html needs exactly one inline <script> and one inline <style>");
  process.exit(1);
}
const sha256 = text => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
const cspTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${sha256(scriptText)}; style-src ${sha256(styleText)}; img-src data:; base-uri 'none'; form-action 'none'">`;
const cspPattern = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
if (!cspPattern.test(html)) {
  fail("index.html has no Content-Security-Policy meta tag");
} else if (html.match(cspPattern)[0] !== cspTag) {
  if (write) html = html.replace(cspPattern, () => cspTag);
  else fail("The CSP hashes are out of date, so the browser would block the page's own script or style. Run: node scripts/check.mjs --write");
}

// ---- Load the page's data the way the browser would, without a browser.
let data;
try {
  new vm.Script(scriptText, { filename: "index.html <script>" });
  const cut = scriptText.indexOf("const STATE_KEY");
  if (cut < 0) throw new Error('the script must still contain "const STATE_KEY"; the check loads the data arrays above that line');
  const dataPart = scriptText.slice(0, cut);
  const sandbox = {};
  vm.runInNewContext(`${dataPart}\nglobalThis.data = { FIELDS, SKILLS, SKILL_SOURCES, PROMPTS };`, sandbox);
  data = sandbox.data;
} catch (e) {
  console.error(`✗ index.html script: ${e.message}`);
  process.exit(1);
}
const { FIELDS, SKILLS, SKILL_SOURCES, PROMPTS } = data;
const audits = PROMPTS.filter(p => !p.kind);
const allSkills = [...SKILLS.base, ...SKILLS.extra];

// ---- Prompts
dupes(PROMPTS.map(p => p.id)).forEach(id => fail(`Prompt id ${id} is used twice`));
audits.forEach((p, i) => {
  const expected = `A-${String(i + 1).padStart(2, "0")}`;
  if (p.id !== expected) fail(`Audit ${i + 1} has id ${p.id}; audits are numbered in order, so it should be ${expected}`);
  for (const key of ["wave", "waveTitle", "tier", "time", "title", "content"]) {
    if (!p[key]) fail(`${p.id} is missing ${key}`);
  }
  if (p.tier && !SIZES.includes(p.tier)) fail(`${p.id} has size ${p.tier}; use one of ${SIZES.join(", ")}`);
  const skill = ((p.content || "").match(/^\/([a-z0-9-]+)\n/) || [])[1];
  if (!skill) {
    fail(`${p.id} must start with its /skill command on a line of its own`);
  } else {
    if ((p.title || "").startsWith("/")) fail(`${p.id}'s title should describe what it checks; the page shows /${skill} next to it`);
    if (!allSkills.includes(skill)) fail(`${p.id} runs /${skill}, which is not listed in SKILLS`);
  }
  // Interface copy style (CONTRIBUTING.md, "Writing style"): no dashes or shorthand in titles.
  for (const [label, text] of [["title", p.title || ""], ["wave title", p.waveTitle || ""]]) {
    if (/[—–]|&|\+| \/ |\bvs\.|a11y/.test(text)) fail(`${p.id}'s ${label} "${text}" uses a dash or shorthand; write it out in words`);
  }
  const prev = audits[i - 1];
  if (prev && p.wave < prev.wave) fail(`${p.id} is in wave ${p.wave} but comes after wave ${prev.wave}`);
  if (prev && p.wave === prev.wave && p.waveTitle !== prev.waveTitle) fail(`${p.id} and ${prev.id} are both wave ${p.wave} but have different wave titles`);
});

// ---- Skills
dupes(allSkills).forEach(s => fail(`${s} is listed twice in SKILLS`));
for (const name of allSkills) {
  const src = SKILL_SOURCES[name];
  if (!src) { fail(`${name} has no entry in SKILL_SOURCES`); continue; }
  const owner = (/^https:\/\/github\.com\/([\w.-]+)\/[\w.-]+/.exec(src.url) || [])[1];
  if (!owner) fail(`${name}'s source should be the author's GitHub repo, not ${src.url}`);
  else if (owner.toLowerCase() !== (src.author || "").slice(1).toLowerCase()) fail(`${name}'s source is github.com/${owner} but its author is ${src.author}; link the author's own repo`);
  if (!/^@[\w-]+$/.test(src.author || "")) fail(`${name}'s author should be a GitHub handle like @name`);
  if (!src.license) fail(`${name} needs a license (or "no license file")`);
}
for (const name of Object.keys(SKILL_SOURCES)) {
  if (!allSkills.includes(name)) fail(`SKILL_SOURCES lists ${name}, which is not in SKILLS`);
}
const base = PROMPTS.find(p => p.id === "base-prompt");
const loaded = base ? [...base.content.matchAll(/^\* ([a-z0-9-]+)$/gm)].map(m => m[1]) : [];
if ([...loaded].sort().join() !== [...SKILLS.base].sort().join()) {
  fail(`The base prompt should load exactly SKILLS.base.\n    base prompt: ${loaded.join(", ")}\n    SKILLS.base: ${SKILLS.base.join(", ")}`);
}

// ---- Placeholders
const known = new Set(FIELDS.map(f => f.key));
const optional = FIELDS.filter(f => f.optional).map(f => f.key);
for (const p of PROMPTS.filter(p => p.content)) {
  for (const [, key] of p.content.matchAll(/\{\{([A-Z_]+)\}\}/g)) {
    if (!known.has(key)) fail(`${p.id} uses {{${key}}}, which is not a project field`);
  }
  for (const line of p.content.split("\n")) {
    for (const key of optional) {
      if (line.includes(`{{${key}}}`) && !new RegExp(`^[A-Z][A-Za-z ]*: \\{\\{${key}\\}\\}`).test(line)) {
        fail(`${p.id}: when {{${key}}} is blank the whole line is dropped, so give it a line of its own that starts "Label: {{${key}}}":\n    ${line}`);
      }
    }
  }
}

// ---- Counts quoted in the copy
const counts = [
  [/(\d+) copy-paste audit prompts/g, audits.length, "audits"],
  [/load all (\d+) Swift skills/g, SKILLS.base.length, "base-prompt skills"],
];
for (const [pattern, actual, what] of counts) {
  for (const [file, text] of [["index.html", html], ["README.md", readme]]) {
    for (const m of text.matchAll(pattern)) {
      if (Number(m[1]) !== actual) fail(`${file} says "${m[0]}", but there are ${actual} ${what}`);
    }
  }
}
for (const m of html.matchAll(/(?:aria-valuemax="|id="totalCount">)(\d+)/g)) {
  if (Number(m[1]) !== audits.length) fail(`index.html starts the progress total at ${m[1]}, but there are ${audits.length} audits`);
}

// ---- The page loads nothing from other sites (README and SECURITY.md promise this).
// Prompt text is escaped before it is shown, so only the page's own markup, style and code are scanned.
const code = scriptText.replace(/content: `(?:[^`\\]|\\[\s\S])*`/g, "content: ``");
const markup = html.replace(scriptText, () => "").replace(styleText, () => "");
const loaders = [
  [markup, /<script\b[^>]*\bsrc=/i, "an external <script>"],
  [markup, /<link\b(?![^>]*\bhref="data:)[^>]*\bhref=/i, "a <link> to another file"],
  [markup, /<(?:img|iframe|video|audio|source|embed|object)\b/i, "an embedded resource"],
  [markup, /<[a-z][^>]*\s(?:style|on[a-z]+)\s*=/i, "an inline style or event-handler attribute, which the CSP blocks"],
  [styleText, /@import|url\(\s*["']?(?!data:)/i, "a CSS import or url()"],
  [code, /\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|new EventSource|\bimport\s*\(|new (?:Image|Worker|SharedWorker)\b|serviceWorker/, "a network request"],
];
for (const [text, pattern, what] of loaders) {
  if (pattern.test(text)) fail(`index.html contains ${what}; the page must stay self-contained`);
}

// ---- README tables, generated from the page
// IDs use a non-breaking hyphen (U+2011) so a narrow column can't split "A-01" across two lines.
const unbreakable = id => id.replace(/-/g, "\u2011");
const readableTime = t => {
  const m = /^~(\d+)([hd])$/.exec(t);
  if (!m) return t;
  const n = Number(m[1]);
  return m[2] === "d" ? (n === 1 ? "1\u00a0day" : `${n}\u00a0days`) : `${n}\u00a0hours`;
};
const promptRows = audits.map(p => {
  const skill = (p.content.match(/^\/([a-z0-9-]+)\n/) || [])[1];
  return `| [${unbreakable(p.id)}](${PAGE_URL}#${p.id}) | ${p.title} | \`/${skill}\` | ${readableTime(p.time)} |`;
});
const skillRows = allSkills.filter(name => SKILL_SOURCES[name]).map(name => {
  const src = SKILL_SOURCES[name];
  const usedBy = audits.filter(p => p.content.startsWith(`/${name}\n`)).map(p => unbreakable(p.id));
  if (SKILLS.base.includes(name)) usedBy.unshift("base\u00a0prompt");
  return `| [${name}](${src.url}) | [${src.author}](https://github.com/${src.author.slice(1)}) | ${src.license} | ${usedBy.join(", ") || "—"} |`;
});
const tables = {
  prompts: ["| ID | What it checks | Skill | Time |", "|---|---|---|---|", ...promptRows].join("\n"),
  skills: ["| Skill | Author | License | Used by |", "|---|---|---|---|", ...skillRows].join("\n"),
};
for (const [name, table] of Object.entries(tables)) {
  const block = new RegExp(`(<!-- ${name}:start -->\\n)[\\s\\S]*?(\\n<!-- ${name}:end -->)`);
  if (!block.test(readme)) { fail(`README.md is missing the <!-- ${name}:start --> and <!-- ${name}:end --> markers`); continue; }
  const updated = readme.replace(block, (_, start, end) => `${start}${table}${end}`);
  if (updated !== readme) {
    if (write) readme = updated;
    else fail(`The ${name} table in README.md is out of date. Run: node scripts/check.mjs --write`);
  }
}

// ---- Report
if (write) {
  if (html !== originalHtml) { writeFileSync(pagePath, html); console.log("Updated the CSP hashes in index.html"); }
  if (readme !== originalReadme) { writeFileSync(readmePath, readme); console.log("Updated the README tables"); }
}
if (errors.length) {
  console.error(errors.map(e => `✗ ${e}`).join("\n"));
  console.error(`\n${errors.length} problem${errors.length === 1 ? "" : "s"} found.`);
  process.exit(1);
}
console.log(`✓ ${audits.length} audits, ${allSkills.length} skills, CSP hashes and README tables all agree.`);
