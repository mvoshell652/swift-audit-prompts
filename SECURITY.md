# Security

This repo is a static page and a set of prompts. It runs no server and stores nothing outside your browser, but security reports are welcome and taken seriously.

## Report a vulnerability

Report it privately: open the [Security tab](https://github.com/mvoshell652/swift-audit-prompts/security/advisories/new) and choose **Report a vulnerability**. Please do not open a public issue for a security problem.

You can expect a first reply within a week. Fixes go live on the page as soon as they merge, and the release notes credit you unless you ask otherwise.

## What counts

- Text typed into the project fields, or a crafted link to the page, that runs script or changes what the page shows.
- A prompt that tells Claude to do something unsafe, such as sending code, keys or files anywhere, or running commands the audit doesn't need.
- A skill link that points somewhere other than the skill author's own repo, for example after a repo changes hands. The page tells people to install these skills, so a bad link matters.

Problems inside a skill itself belong with that skill's author. The page links each one.

## How the page protects you

- It is one file with no dependencies and loads nothing from other sites. Its Content Security Policy allows only the page's own script and style, and blocks every request to anywhere else.
- Your project details and checkmarks stay in your browser's local storage.
- Everything the page shows from your input or from the link is escaped first.
- The page runs nothing on your machine. A prompt does nothing until you paste it into Claude Code yourself.

## Supported versions

The live page and the latest release.
