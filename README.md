# Ticket Timeline

A drag-and-drop calendar for figuring out when an epic actually ships.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[Try it live](https://mariuszdabrowski.github.io/ticket-timeline/)**

----

<img width="1506" height="854" alt="image" src="https://github.com/user-attachments/assets/ffadac9c-7397-4a37-8c87-fbec62c89b4d" />


## The problem

Every time I kick off an epic at work, someone asks *"great, so when will it be done?"* — and I hate pulling a number out of the air. Ticket estimates in isolation don't help much either: a three-day ticket isn't three days when the same person also has PR reviews, on-call rotations, pair sessions, and the occasional production fire.

The estimates that actually hold up are the ones where you look at the real calendar: how many people, how many tickets, who's on vacation, how many holidays land in there, what else is taking up the day.

My old workaround was a calendar drawn in Miro with vacation blocks and ticket pills overlaid by hand. The *picture* worked great. *Updating it* didn't — every new ticket, every adjusted vacation, every forgotten holiday meant fifteen minutes of redrawing.

This is that picture, but it updates itself.

## What it does

- **Drag tickets onto calendar days** and resize them across weeks
- **Assign tickets to people** — pill colors match the person's color
- **Drop events** (buffers, milestones, testing phases) as separate color-coded bars
- **Sync vacations** from a HiBob ICS export, or add them manually
- **Highlights statutory holidays** (Canadian + American) automatically
- **Project brief** auto-updates with placed vs. backlog counts per person, and lets you toggle individual people on and off the calendar
- **Import a whole Shortcut epic** via CSV — every ticket comes in at once with its assignee, and tickets with a start date get auto-placed on the calendar so you can just drag them around instead of creating each one manually
- **Copy a single shareable URL** that encodes the entire project — anyone you send it to can open it in their browser

<!-- TODO: drag.gif — dragging a ticket from the sidebar onto a day, then resizing -->
<!-- TODO: share.gif — clicking Copy shareable link → opening it in a new tab → project hydrates -->

## Privacy by default

Nothing in this app touches a server. Projects live in your browser's localStorage. The "Copy shareable link" feature compresses the entire project state into a URL hash fragment — when someone opens that link, the data is decoded entirely in their browser. No signup, no account, no telemetry, no analytics.

Useful when your roadmap isn't supposed to leave the company.

## Behind the scenes

I built this for two reasons. The first is the calendar problem above. The second is that I wanted to see what the AI-assisted coding hype was actually about.

At work I use AI to help with code, but I review every line and three other people review it again in PR. This project was the inverse — me trusting the loop, prompting in long sessions, and shipping a real product. With proper guidance the code path moved fast. With animations and visual polish I had to hand-hold more — that's still where craft matters, and an honest review of every motion was worth it.

Five hundred-plus commits later, here it is. A lot of those were me being a perfectionist about details that didn't strictly need fixing. I had a blast.

### Quality

- **Lighthouse:** Performance 95 · Accessibility 100 · Best Practices 100 · SEO 100
- **Tests:** 55 unit + 5 E2E (Vitest + Playwright), enforced by CI on every PR
- **Bundle:** 216 KB raw / 69 KB gzip (image-export library lazy-loaded)
- **Accessibility:** Keyboard-navigable, screen-reader friendly, `prefers-reduced-motion` honored, print stylesheet included

## Tech stack

- [Vue 3](https://vuejs.org/) with `<script setup>` and Composition API
- [Pinia](https://pinia.vuejs.org/) for state
- [Vite](https://vite.dev/) for bundling
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) for tests
- [lz-string](https://github.com/pieroxy/lz-string) for the compact share-link encoding
- [html-to-image](https://github.com/bubkoo/html-to-image) for PNG export (lazy-loaded)
- TypeScript throughout

## Getting started

```sh
npm install
npm run dev
```

## Tests

```sh
npm run test:unit   # vitest, runs all *.test.ts in src/
npm run test:e2e    # playwright (auto-starts dev server)
```

## Build

```sh
npm run build
```

## Browser support

Modern evergreen browsers — Chrome, Firefox, Safari (last 2 major versions). Best experience on desktop; mobile works but native HTML5 drag-and-drop on touch is awkward.

## About

Built by [Mariusz Dabrowski](https://www.linkedin.com/in/mariuszpdabrowski/) — designer turned front-end dev turned full-stack engineer. This project was a chance to scratch the design itch again.

## License

[MIT](LICENSE) — free to use, fork, and adapt.
