<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../components/BaseModal.vue'

// Catalog of every shared UI element in the app. Reached via #styleguide
// in the URL. Add new components / variants here so the team has a single
// place to spot duplicates and inconsistencies.

const PALETTE = [
  '#c0392b', '#c0672d', '#b8860b', '#1a8a4a',
  '#148a72', '#2472a4', '#7d3c98', '#b5154a',
  '#455a64', '#5d4037', '#3498db', '#e91e63',
]

function pillGradient(hex: string): string {
  let h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length === 3) h = h[0]! + h[0] + h[1]! + h[1] + h[2]! + h[2]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const left = `rgba(${r}, ${g}, ${b}, 0.75)`
  const right = `rgba(${Math.round(r * 0.6)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.6)}, 0.75)`
  return `linear-gradient(to right, ${left}, ${right})`
}

const checkboxOn = ref(true)
const selectVal = ref('alice')
const modalSize = ref<'compact' | 'wide' | null>(null)
</script>

<template>
  <div class="styleguide">
    <header class="sg-header">
      <h1>Ticket Timeline — Style Guide</h1>
      <p class="sg-sub">Every shared UI primitive in the app. Visit by appending <code>#styleguide</code> to the URL.</p>
      <a class="sg-back" href="#">← Back to the app</a>
    </header>

    <!-- Buttons -->
    <section class="sg-section">
      <h2>Buttons</h2>
      <p class="sg-section-desc">Standard <code>.btn</code> with the <code>.btn-danger</code> destructive variant. Add <code>.leading</code> to push a button to the left of an actions footer.</p>
      <div class="sg-row">
        <button class="btn">Default</button>
        <button class="btn" disabled>Disabled</button>
        <button class="btn btn-danger">Danger</button>
        <button class="btn btn-danger" disabled>Danger · Disabled</button>
      </div>
      <p class="sg-section-desc sg-section-desc--inline">Split icon + label button — the icon sits in its own darker column with a divider. Used for the "Copy shareable link" button under the project brief. Two zones (icon-wrap / body) so the label can do a slide-in/out animation independently.</p>
      <div class="sg-row">
        <button class="sg-share-btn">
          <div class="sg-share-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M318-120q-82 0-140-58t-58-140q0-40 15-76t43-64l134-133 56 56-134 134q-17 17-25.5 38.5T200-318q0 49 34.5 83.5T318-200q23 0 45-8.5t39-25.5l133-134 57 57-134 133q-28 28-64 43t-76 15Zm79-220-57-57 223-223 57 57-223 223Zm251-28-56-57 134-133q17-17 25-38t8-44q0-50-34-85t-84-35q-23 0-44.5 8.5T558-726L425-592l-57-56 134-134q28-28 64-43t76-15q82 0 139.5 58T839-641q0 39-14.5 75T782-502L648-368Z"/>
            </svg>
          </div>
          <div class="sg-share-body">Copy shareable link</div>
        </button>
      </div>
    </section>

    <!-- Inputs -->
    <section class="sg-section">
      <h2>Form controls</h2>
      <p class="sg-section-desc">Text, select, date, and the custom checkbox. The select uses a hand-painted SVG chevron because the native macOS arrow ignores <code>padding-right</code>.</p>
      <div class="sg-grid">
        <div class="app-field">
          <label class="app-label">Text input</label>
          <input class="app-input" type="text" placeholder="Type here…" />
        </div>
        <div class="app-field">
          <label class="app-label">Select</label>
          <select class="app-select" v-model="selectVal">
            <option value="alice">Alice</option>
            <option value="bob">Bob</option>
            <option value="charlie">Charlie</option>
          </select>
        </div>
        <div class="app-field">
          <label class="app-label">Date</label>
          <input class="app-input" type="date" />
        </div>
        <label class="sg-checkbox-row">
          <input type="checkbox" class="app-checkbox" v-model="checkboxOn" />
          <span>Custom checkbox</span>
        </label>
      </div>
    </section>

    <!-- Modals -->
    <section class="sg-section">
      <h2>Modals</h2>
      <p class="sg-section-desc">All modals use <code>&lt;BaseModal&gt;</code> with two size tiers. Click to open a sample.</p>
      <div class="sg-row">
        <button class="btn" @click="modalSize = 'compact'">Open compact (420px)</button>
        <button class="btn" @click="modalSize = 'wide'">Open wide (560px)</button>
      </div>

      <BaseModal v-if="modalSize" :title="`Sample · ${modalSize}`" :size="modalSize" @close="modalSize = null">
        <div class="modal-body sg-modal-body">
          <p>This is a <code>BaseModal</code> at <code>size="{{ modalSize }}"</code>. The frame, title bar, focus-trap, ESC handling, and footer styling all come from the shared component.</p>
          <p>Modal owners provide their own body content and optional actions slot.</p>
        </div>
        <template #actions>
          <button class="btn btn-danger leading" @click="modalSize = null">Destroy</button>
          <button class="btn" @click="modalSize = null">Cancel</button>
          <button class="btn" @click="modalSize = null">Confirm</button>
        </template>
      </BaseModal>
    </section>

    <!-- Pills -->
    <section class="sg-section">
      <h2>Calendar pills</h2>
      <p class="sg-section-desc">Ticket pills tint left → right with a per-person color. Vacation pills carry a 45° dark hatch. The conflict badge sits centered with a drop shadow + z-index so it floats over title text.</p>
      <div class="sg-pills">
        <div class="sg-pill-row">
          <div class="sg-pill-label">Ticket</div>
          <div class="sg-pill is-rounded" :style="{ background: pillGradient('#2472a4') }">
            <span class="sg-pill-text">PROJ-142 · Auth refactor</span>
          </div>
        </div>
        <div class="sg-pill-row">
          <div class="sg-pill-label">Vacation</div>
          <div class="sg-vacation-pill is-rounded">
            <span class="sg-pill-text">Alice Vacation</span>
          </div>
        </div>
        <div class="sg-pill-row">
          <div class="sg-pill-label">Event / label</div>
          <div class="sg-pill is-rounded" :style="{ background: '#5d4037' }">
            <span class="sg-pill-text">Code freeze</span>
          </div>
        </div>
        <div class="sg-pill-row">
          <div class="sg-pill-label">Conflict</div>
          <div class="sg-pill sg-pill-conflict is-rounded" :style="{ background: pillGradient('#2472a4') }">
            <span class="sg-pill-text">PROJ-142 (on vacation)</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Tier badges -->
    <section class="sg-section">
      <h2>Match tier badges</h2>
      <p class="sg-section-desc">Used in <code>PeopleConfirmModal</code> to label each row by classification tier.</p>
      <div class="sg-row">
        <span class="sg-tier sg-tier-exact-name">Exact name</span>
        <span class="sg-tier sg-tier-fuzzy">Fuzzy</span>
        <span class="sg-tier sg-tier-ambiguous">Ambiguous</span>
        <span class="sg-tier sg-tier-none">New</span>
        <span class="sg-tier sg-tier-email-known">Email match</span>
      </div>
    </section>

    <!-- Toast -->
    <section class="sg-section">
      <h2>Toast</h2>
      <p class="sg-section-desc">Neutral rejection toast for "you can't do that" rules (e.g. uncheck the last month). Positioned <code>fixed</code> at the top of the screen in the real app; demo sits inline. Auto-dismisses; not clickable.</p>

      <div class="sg-toast-demo">
        <div class="sg-rejection-toast">At least one month must be selected</div>
      </div>
    </section>

    <!-- Palette -->
    <section class="sg-section">
      <h2>Color palette</h2>
      <p class="sg-section-desc">User-selectable colors for people and labels. Hover for hex.</p>
      <div class="sg-swatches">
        <div
          v-for="hex in PALETTE"
          :key="hex"
          class="sg-swatch"
          :style="{ background: hex }"
          :title="hex"
        />
      </div>
    </section>

    <!-- Typography -->
    <section class="sg-section">
      <h2>Typography</h2>
      <p class="sg-section-desc">Section headers, field labels, body text.</p>
      <div class="sg-type">
        <div><span class="sg-type-label">Section header</span><h3 class="sg-h3">Project Settings</h3></div>
        <div><span class="sg-type-label">Field label</span><span class="sg-field-label">Project name</span></div>
        <div><span class="sg-type-label">Body</span><p class="sg-body-text">Standard paragraph text — used for descriptions, instructions, and tooltips throughout the app.</p></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.styleguide {
  /* html/body/#app are locked to height: 100% by the main app shell, so
     this view owns its own scroll container instead of growing the page. */
  height: 100vh;
  overflow-y: auto;
  padding: 2rem 2.5rem 5rem;
  background-color: #1a1a1a;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  color: rgba(255, 255, 255, 0.85);
  font-family: 'Nunito', sans-serif;
}

.sg-header {
  margin-bottom: 2.5rem;
}

.sg-header h1 {
  font-size: 1.4rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.4rem;
  color: rgba(255, 255, 255, 0.95);
}

.sg-sub {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
  margin-bottom: 0.6rem;
}

.sg-sub code,
.sg-section-desc code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.85em;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  padding: 1px 5px;
}

.sg-section-desc--inline {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.sg-back {
  display: inline-block;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
}

.sg-back:hover {
  color: rgba(255, 255, 255, 0.85);
}

.sg-section {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
  padding: 1.25rem 1.5rem 1.5rem;
  margin-bottom: 1.25rem;
}

.sg-section h2 {
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.4rem;
  color: rgba(255, 255, 255, 0.85);
}

.sg-section-desc {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.55;
  margin-bottom: 1rem;
  max-width: 60ch;
}

.sg-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.sg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.sg-checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
}

.sg-modal-body p {
  margin-bottom: 0.6rem;
  font-size: 0.85rem;
  line-height: 1.55;
}

/* Pills demo */
.sg-pills {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-width: 480px;
}

.sg-pill-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sg-pill-label {
  flex-shrink: 0;
  width: 120px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: right;
}

.sg-pill,
.sg-vacation-pill {
  position: relative;
  flex: 1;
  height: 1.4rem;
  display: flex;
  align-items: center;
  padding: 0 0.55rem;
  color: rgba(255, 255, 255, 0.95);
  font-size: 0.78rem;
  font-weight: 600;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.sg-pill.is-rounded,
.sg-vacation-pill.is-rounded {
  border-radius: 999px;
}

.sg-vacation-pill {
  background: repeating-linear-gradient(45deg, #2a2a2a 0px, #2a2a2a 3px, #323232 3px, #323232 9px);
  color: rgba(255, 255, 255, 0.75);
}

.sg-pill-text {
  position: relative;
  z-index: 0;
}

.sg-pill-conflict::after {
  content: '';
  position: absolute;
  inset: 0;
  background: url("../assets/icons/error.svg") no-repeat center / 20px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
  pointer-events: none;
  border-radius: inherit;
  z-index: 1;
}

/* Tier badges — copied from PeopleConfirmModal so style guide stays
   self-contained. If the source moves, update here too. */
.sg-tier {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
  font-weight: 600;
}

.sg-tier-exact-name { background: rgba(46, 204, 113, 0.18); color: #5ee59c; }
.sg-tier-fuzzy { background: rgba(241, 196, 15, 0.18); color: #f5d36a; }
.sg-tier-ambiguous { background: rgba(231, 76, 60, 0.18); color: #ff8a7a; }
.sg-tier-none { background: rgba(52, 152, 219, 0.18); color: #6dd5fa; }
.sg-tier-email-known { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.55); }

/* Toast demo — copy of .rejection-toast from HomeView so the catalog
   renders it in-place (it's position: fixed in the real app). */
.sg-toast-demo {
  display: flex;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.sg-rejection-toast {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
}

/* Split icon-+-label button (the "Copy shareable link" pattern). The icon
   sits in its own darker column with a vertical divider, the label fills
   the rest. Same source styling as .share-btn in HomeView. */
.sg-share-btn {
  display: flex;
  align-items: stretch;
  padding: 0;
  min-height: 36px;
  overflow: hidden;
  font-size: 14px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border: 1px solid rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  font-family: 'Nunito', sans-serif;
  transition: color 0.2s ease;
}
.sg-share-btn:hover { color: rgba(255, 255, 255, 0.95); }

.sg-share-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(0, 0, 0, 0.3);
}
.sg-share-icon-wrap svg {
  width: 14px;
  height: 14px;
  opacity: 0.75;
}

.sg-share-body {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
}

/* Color palette */
.sg-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.sg-swatch {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: transform 0.1s;
}

.sg-swatch:hover {
  transform: scale(1.1);
}

/* Typography demo */
.sg-type {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.sg-type > div {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.sg-type-label {
  flex-shrink: 0;
  width: 130px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.sg-h3 {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.95);
}

.sg-field-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.sg-body-text {
  font-size: 0.88rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.75);
  max-width: 50ch;
}
</style>
