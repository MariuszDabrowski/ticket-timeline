<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true">
    <!-- Clock ring (static) -->
    <path
      fill="#767676"
      fill-rule="evenodd"
      d="M600-160q-134 0-227-93t-93-227q0-133 93-226.5T600-800q133 0 226.5 93.5T920-480q0 134-93.5 227T600-160Z
         M600-240q100 0 170-70t70-170q0-100-70-170t-170-70q-100 0-170 70t-70 170q0 100 70 170t170 70Z"
    />

    <!-- Left dash 1 (top) -->
    <rect class="dash dash-1" x="80" y="-680" width="160" height="80" rx="40" fill="#767676" />

    <!-- Left dash 2 (middle) -->
    <rect class="dash dash-2" x="40" y="-520" width="200" height="80" rx="40" fill="#767676" />

    <!-- Left dash 3 (bottom) -->
    <rect class="dash dash-3" x="80" y="-360" width="160" height="80" rx="40" fill="#767676" />

    <!-- Minute hand (long) — 5s per revolution -->
    <g>
      <rect x="560" y="-680" width="80" height="200" rx="40" fill="#767676" />
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
      <rect x="560" y="-620" width="80" height="140" rx="40" fill="#767676" />
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
    <circle cx="600" cy="-480" r="40" fill="#767676" />
  </svg>
</template>

<style scoped>
.dash {
  transform-box: fill-box;
  transform-origin: 100% 50%;
}

.dash-1 {
  animation: wind1 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.dash-2 {
  animation: wind2 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.dash-3 {
  animation: wind3 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes wind1 {
  0%, 100% { transform: scaleX(1); }
  30%       { transform: scaleX(1.25); }
  65%       { transform: scaleX(0.78); }
}

@keyframes wind2 {
  0%, 100% { transform: scaleX(1); }
  40%      { transform: scaleX(0.65); }
  72%      { transform: scaleX(1.38); }
}

@keyframes wind3 {
  0%, 100% { transform: scaleX(1); }
  35%      { transform: scaleX(1.34); }
  68%      { transform: scaleX(0.84); }
}
</style>
