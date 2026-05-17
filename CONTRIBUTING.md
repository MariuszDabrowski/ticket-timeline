# Contributing

Thanks for taking the time to look at this. Ticket Timeline is a small personal project that I work on in spare time, so contributions and feedback are very welcome — just keep things focused and we'll get along fine.

## Local setup

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173/ticket-timeline/`. All data is stored in the browser — no backend, no signup.

## Proposing changes

- **Bug reports and small fixes:** open an issue or send a PR directly. Whichever is easier.
- **New features or larger changes:** open an issue first so we can talk through the design before you write code. Saves both of us time if the direction doesn't fit.
- **Visual/UX polish:** screenshots in the PR description make review way easier.

## Before submitting a PR

Run these locally and make sure they pass:

```bash
npm run type-check    # vue-tsc
npm run test:unit     # vitest
npm run lint          # oxlint + eslint
```

Try to keep PRs scoped to one thing. A 200-line PR that fixes a bug AND refactors three files is harder to review than two separate PRs.

## Reporting issues

Use the issue templates in the repo if they fit. If not, just describe what you expected, what happened, and how to reproduce. Screenshots help.
