# Ticket Timeline

A visual planning tool for mapping tickets and vacations across a calendar. Built with Vue 3, TypeScript, and Pinia.

## Features

- **Calendar view** — display multiple months stacked vertically, with selectable month range
- **Tickets** — drag tickets from the sidebar onto calendar days, resize them across weeks, and edit details (number, title, assignee, link)
- **Labels** — color-coded spans for marking milestones or phases, separate from ticket stats
- **People** — add team members with custom colors; assignments are reflected in ticket pill colors
- **Vacations** — sync vacation days via HiBob ICS export; vacation bars appear beneath ticket rows
- **Day markers** — click any day to add a colored circle and note shown on hover
- **Canadian & American holidays** — optional holiday indicators with flag prefixes
- **Project brief** — sticky summary tile showing placed/backlog counts per person
- **Import / Export** — save and load the full project state as JSON; export the calendar as a PNG image
- **Epic CSV import** — import tickets and date placements from a Linear/Epic CSV export

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
npx tsc --noEmit
```

## Tech Stack

- [Vue 3](https://vuejs.org/) with `<script setup>` and Composition API
- [Pinia](https://pinia.vuejs.org/) for state management
- [Vite](https://vite.dev/) for bundling
- [html-to-image](https://github.com/bubkoo/html-to-image) for PNG export
- TypeScript throughout
