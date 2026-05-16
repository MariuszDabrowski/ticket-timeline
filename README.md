# Ticket Timeline

A visual planning tool for mapping tickets and vacations across a calendar. Built with Vue 3, TypeScript, and Pinia.

## Features

- **Calendar view** — display multiple months stacked vertically, with a selectable month range
- **Tickets** — drag tickets from the sidebar onto calendar days, resize them across weeks, and edit details (number, title, assignee, link)
- **Events** — color-coded spans for marking milestones, buffers, or phases; separate from ticket stats
- **People** — add team members with custom colors; assignments are reflected in ticket pill colors
- **Vacations** — add vacation bars for any team member, or sync them en masse via a HiBob ICS export
- **Holidays** — Canadian and American statutory holidays are highlighted automatically with `CA` / `US` prefixes
- **Project brief** — sticky summary tile showing placed/backlog counts per person with show/hide toggles
- **Share link** — copy a single URL that encodes the full project; opens in any browser, no server involved
- **Import / Export** — save and load the full project state as JSON; export the calendar as a PNG image
- **Epic CSV import** — import tickets and date placements from a Shortcut Epic CSV export

## Getting Started

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Type Check

```sh
npm run type-check
```

## Tests

```sh
npm run test:unit   # vitest, runs all *.test.ts in src/
npm run test:e2e    # playwright (auto-starts dev server)
```

## Browser Support

Targets modern evergreen browsers (Chrome, Firefox, Safari last 2 major versions). Uses `crypto.randomUUID`, CSS Grid `1fr ↔ 0fr` accordion animations, `pointer: fine` media queries, and CSS `v-bind`. No IE / legacy Edge support.

## Tech Stack

- [Vue 3](https://vuejs.org/) with `<script setup>` and Composition API
- [Pinia](https://pinia.vuejs.org/) for state management
- [Vite](https://vite.dev/) for bundling
- [html-to-image](https://github.com/bubkoo/html-to-image) for PNG export
- [lz-string](https://github.com/pieroxy/lz-string) for compact share-link encoding
- TypeScript throughout
