<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true">
    <!-- Clock ring + left dashes (static) -->
    <path
      fill="rgba(255,255,255,0.4)"
      fill-rule="evenodd"
      d="M600-160q-134 0-227-93t-93-227q0-133 93-226.5T600-800q133 0 226.5 93.5T920-480q0 134-93.5 227T600-160Z
         M600-240q100 0 170-70t70-170q0-100-70-170t-170-70q-100 0-170 70t-70 170q0 100 70 170t170 70Z
         M120-600q-17 0-28.5-11.5T80-640q0-17 11.5-28.5T120-680h80q17 0 28.5 11.5T240-640q0 17-11.5 28.5T200-600h-80Z
         M80-440q-17 0-28.5-11.5T40-480q0-17 11.5-28.5T80-520h120q17 0 28.5 11.5T240-480q0 17-11.5 28.5T200-440H80Z
         M120-280q-17 0-28.5-11.5T80-320q0-17 11.5-28.5T120-360h80q17 0 28.5 11.5T240-320q0 17-11.5 28.5T200-280h-80Z"
    />

    <!-- Minute hand (long) — 5s per revolution -->
    <g>
      <rect x="592" y="-640" width="16" height="160" rx="8" fill="rgba(255,255,255,0.4)" />
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 600 -480"
        to="360 600 -480"
        dur="5s"
        repeatCount="indefinite"
      />
    </g>

    <!-- Hour hand (short) — 10s per revolution (2× slower) -->
    <g>
      <rect x="590" y="-590" width="20" height="110" rx="10" fill="rgba(255,255,255,0.4)" />
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="120 600 -480"
        to="480 600 -480"
        dur="10s"
        repeatCount="indefinite"
      />
    </g>

    <!-- Center pivot dot -->
    <circle cx="600" cy="-480" r="14" fill="rgba(255,255,255,0.4)" />
  </svg>
</template>
