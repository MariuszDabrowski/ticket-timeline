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
    <rect y="-680" height="80" rx="40" fill="#767676">
      <animate attributeName="x"     calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" values="80;40;115;80"  keyTimes="0;0.3;0.65;1" dur="2.8s" repeatCount="indefinite" />
      <animate attributeName="width" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" values="160;200;125;160" keyTimes="0;0.3;0.65;1" dur="2.8s" repeatCount="indefinite" />
    </rect>

    <!-- Left dash 2 (middle) -->
    <rect y="-520" height="80" rx="40" fill="#767676">
      <animate attributeName="x"     calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" values="40;110;20;40"  keyTimes="0;0.4;0.72;1" dur="3.5s" repeatCount="indefinite" />
      <animate attributeName="width" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" values="200;130;220;200" keyTimes="0;0.4;0.72;1" dur="3.5s" repeatCount="indefinite" />
    </rect>

    <!-- Left dash 3 (bottom) -->
    <rect y="-360" height="80" rx="40" fill="#767676">
      <animate attributeName="x"     calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" values="80;25;105;80"  keyTimes="0;0.35;0.68;1" dur="2.2s" repeatCount="indefinite" />
      <animate attributeName="width" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" values="160;215;135;160" keyTimes="0;0.35;0.68;1" dur="2.2s" repeatCount="indefinite" />
    </rect>

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
