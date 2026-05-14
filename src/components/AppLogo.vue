<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" aria-hidden="true">
    <defs>
      <linearGradient id="logoShine" gradientUnits="userSpaceOnUse" x1="0" y1="-480" x2="4800" y2="-480">
        <stop offset="0%"   stop-color="#a78bfa"/>
        <stop offset="20%"  stop-color="#38bdf8"/>
        <stop offset="35%"  stop-color="#22d3ee"/>
        <stop offset="65%"  stop-color="#818cf8"/>
        <stop offset="80%"  stop-color="#a78bfa"/>
        <stop offset="100%" stop-color="#38bdf8"/>
        <animateTransform
          attributeName="gradientTransform"
          type="translate"
          values="0 0;-3840 0;0 0"
          keyTimes="0;0.5;1"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
          calcMode="spline"
          dur="10s"
          repeatCount="indefinite"
        />
      </linearGradient>
    </defs>

    <!-- Clock ring (static) -->
    <circle cx="600" cy="-480" r="290" fill="none" stroke="url(#logoShine)" stroke-width="60" />

    <!-- Left dash 1 (top) -->
    <rect class="dash dash-1" x="80" y="-672" width="160" height="60" rx="30" fill="url(#logoShine)" />

    <!-- Left dash 2 (middle) -->
    <rect class="dash dash-2" x="40" y="-510" width="200" height="60" rx="30" fill="url(#logoShine)" />

    <!-- Left dash 3 (bottom) -->
    <rect class="dash dash-3" x="80" y="-348" width="160" height="60" rx="30" fill="url(#logoShine)" />

    <!-- Minute hand (long) — 5s per revolution -->
    <g transform="rotate(0 600 -480)">
      <rect x="570" y="-640" width="60" height="160" rx="30" fill="url(#logoShine)" />
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 600 -480"
        to="360 600 -480"
        dur="5s"
        begin="0s"
        repeatCount="indefinite"
      />
    </g>

    <!-- Hour hand (short) — 10s per revolution (2× slower) -->
    <g transform="rotate(120 600 -480)">
      <rect x="570" y="-585" width="60" height="105" rx="30" fill="url(#logoShine)" />
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="120 600 -480"
        to="480 600 -480"
        dur="10s"
        begin="0s"
        repeatCount="indefinite"
      />
    </g>

    <!-- Center pivot dot -->
    <circle cx="600" cy="-480" r="30" fill="url(#logoShine)" />
  </svg>
</template>

<style scoped>
.dash {
  transform-box: fill-box;
  transform-origin: 100% 50%;
}

.dash-1 {
  animation: wind1 1.8s linear infinite;
}

.dash-2 {
  animation: wind2 2.3s linear infinite;
}

.dash-3 {
  animation: wind3 1.5s linear infinite;
}

@keyframes wind1 {
  0%   { transform: scaleX(1);    animation-timing-function: ease-in-out; }
  22%  { transform: scaleX(1.3);  animation-timing-function: ease-in-out; }
  48%  { transform: scaleX(0.7);  animation-timing-function: ease-in-out; }
  72%  { transform: scaleX(1.2);  animation-timing-function: ease-in-out; }
  100% { transform: scaleX(1); }
}

@keyframes wind2 {
  0%   { transform: scaleX(1);    animation-timing-function: ease-in-out; }
  28%  { transform: scaleX(0.6);  animation-timing-function: ease-in-out; }
  55%  { transform: scaleX(1.38); animation-timing-function: ease-in-out; }
  82%  { transform: scaleX(0.82); animation-timing-function: ease-in-out; }
  100% { transform: scaleX(1); }
}

@keyframes wind3 {
  0%   { transform: scaleX(1);    animation-timing-function: ease-in-out; }
  30%  { transform: scaleX(1.4);  animation-timing-function: ease-in-out; }
  58%  { transform: scaleX(0.65); animation-timing-function: ease-in-out; }
  82%  { transform: scaleX(1.15); animation-timing-function: ease-in-out; }
  100% { transform: scaleX(1); }
}
</style>
