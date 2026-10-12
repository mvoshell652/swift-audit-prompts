# Contributing

Issues, ideas and pull requests are welcome, especially new audits and sharper wording.

## Run it from a checkout

The page is one file with no build step. Open `index.html` in a browser, or serve the folder locally:

```
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://localhost:8000`.

Run the checks before you open a pull request. They need Node 18 or newer and nothing else:

```
node scripts/check.mjs
```

## Where things live

- **Prompts** are the `PROMPTS` array in `index.html`. Each audit has an ID (`A-01` onwards, in order), a wave, a size (`tier`), a time estimate, a title that starts with its slash command, and the prompt text.
- **Skills** are `SKILLS`, split into the ones the base prompt loads and the ones a single audit uses, and `SKILL_SOURCES`, which gives each skill's upstream repo, author and license.
- **Project fields** are `FIELDS`. A prompt uses them as `{{APP_NAME}}`, `{{APP_PATH}}`, `{{IOS}}`, `{{SWIFT}}`, `{{BACKEND}}` and `{{FIGMA_FILE}}`.
- **Generated parts.** The README's two tables and the Content Security Policy hashes in `index.html` come from the page itself. After any change to `index.html`, run `node scripts/check.mjs --write` and commit what it updates. If you skip it, the browser blocks the page's own script and CI fails.
- **Keep the data above `const STATE_KEY`.** The check loads `FIELDS`, `SKILLS`, `SKILL_SOURCES` and `PROMPTS` from everything above that line, so they must stay there and must not touch the page.
- **Adding an audit.** Copy the last entry in `PROMPTS` and change `id` (the next number), `wave` and `waveTitle` (audits in one wave share a title), `tier` (S, M, L or XL), `time`, `title` and `content`. Raise the audit count wherever it is quoted: the README intro, the page's lede, meta description and og:description, and the progress bar's `aria-valuemax` and `totalCount`. Update the run-order lists in the README and the page's how-to if the new audit changes them, then run `node scripts/check.mjs --write`. The check lists any count you missed.

## What to know before changing a prompt

- **Keep prompts generic.** No app names, file or type names from your own project, local paths, design-file keys or backend project names. Describe the kind of code to look at instead.
- **An optional field starts its line.** When `{{BACKEND}}` or `{{FIGMA_FILE}}` is blank, every line that mentions it is dropped whole, so start the line with a label like `Backend: {{BACKEND}}` and put nothing else on it that should survive a blank field. The check enforces the label at the start of the line.
- **Ask for what the skill knows.** Read the skill's `SKILL.md` before writing checks for it, so the prompt and the skill pull the same way.
- **Say the floor for version-bound advice.** If a recommendation needs a newer iOS or Swift, say which, so a project on an older target isn't told to use APIs it can't.
- **Credit the original author.** A new skill needs a `SKILL_SOURCES` entry that links the author's own repo, not a collection that re-hosts it, with the license that repo states.
- **Try it.** Run a changed prompt in Claude Code on a real project, and say in the pull request what it found.
- **No network requests.** The page loads nothing from other sites. Its Content Security Policy blocks any request that tries, and the check flags the common ways of making one.

## Pull requests

Keep them small and say what changes for someone using the page. If the page looks different, include a screenshot.
