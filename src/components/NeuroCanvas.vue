<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let rafId: number | null = null
let gl: WebGL2RenderingContext | null = null
let program: WebGLProgram | null = null
let resolutionLoc: WebGLUniformLocation | null = null
let timeLoc: WebGLUniformLocation | null = null

const dpr = Math.min(window.devicePixelRatio, 2)

const VERT = `#version 300 es
precision highp float;
in vec4 position;
void main() { gl_Position = position; }`

const FRAG = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)
float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f), k=vec2(1,0);
  float a=rnd(i), b=rnd(i+k), c=rnd(i+k.yx), d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p) {
  float t=.0, a=1., h=.0; mat2 m=mat2(1.,-1.2,.2,1.2);
  for (float i=.0; i<5.; i++) {
    t+=a*noise(p);
    p*=2.*m;
    a*=.5;
    h+=a;
  }
  return t/h;
}
void main() {
  vec2 uv=(FC-.5*R)/R.y, k=vec2(0,T*.015);
  vec3 col=vec3(1);
  uv.x+=.25;
  uv*=vec2(2,1);
  float n=fbm(uv*.28+vec2(-T*.01,0));
  n=noise(uv*3.+n*2.);
  col.r-=fbm(uv+k+n);
  col.g-=fbm(uv*1.003+k+n+.003);
  col.b-=fbm(uv*1.006+k+n+.006);
  col=mix(col,vec3(1),dot(col,vec3(.21,.71,.07)));
  col=mix(vec3(.08),col,min(time*.1,1.));
  col=clamp(col,.08,1.);
  O=vec4(col,1);
}`

function compile(glCtx: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = glCtx.createShader(type)!
  glCtx.shaderSource(shader, src)
  glCtx.compileShader(shader)
  if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
    console.error('Shader compile error:', glCtx.getShaderInfoLog(shader))
    glCtx.deleteShader(shader)
    return null
  }
  return shader
}

function initGL(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  const glCtx = canvas.getContext('webgl2')
  if (!glCtx) {
    console.error('WebGL2 not supported')
    return null
  }

  const vs = compile(glCtx, glCtx.VERTEX_SHADER, VERT)
  const fs = compile(glCtx, glCtx.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null

  program = glCtx.createProgram()!
  glCtx.attachShader(program, vs)
  glCtx.attachShader(program, fs)
  glCtx.linkProgram(program)
  if (!glCtx.getProgramParameter(program, glCtx.LINK_STATUS)) {
    console.error('Program link error:', glCtx.getProgramInfoLog(program))
    return null
  }

  resolutionLoc = glCtx.getUniformLocation(program, 'resolution')
  timeLoc = glCtx.getUniformLocation(program, 'time')

  const buf = glCtx.createBuffer()
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buf)
  glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), glCtx.STATIC_DRAW)

  glCtx.useProgram(program)

  const pos = glCtx.getAttribLocation(program, 'position')
  glCtx.enableVertexAttribArray(pos)
  glCtx.vertexAttribPointer(pos, 2, glCtx.FLOAT, false, 0, 0)

  return glCtx
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas || !gl || !program) return
  const rect = canvas.getBoundingClientRect()
  const w = rect.width || canvas.offsetWidth || canvas.parentElement?.clientWidth || 300
  const h = rect.height || canvas.offsetHeight || canvas.parentElement?.clientHeight || 52
  canvas.width = w * dpr
  canvas.height = h * dpr
  gl.viewport(0, 0, canvas.width, canvas.height)
}

function render(now: number) {
  if (!gl || !program) return
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(program)
  gl.uniform2f(resolutionLoc, gl.canvas.width, gl.canvas.height)
  // Multiply by 5x for visible motion at header scale; +100 skips the 10s fade-in
  gl.uniform1f(timeLoc, now * 5e-3 + 100)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  rafId = requestAnimationFrame(render)
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  gl = initGL(canvas)
  if (!gl) return
  resize()
  window.addEventListener('resize', resize)
  rafId = requestAnimationFrame(render)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvasRef" class="neuro-canvas" />
</template>

<style scoped>
.neuro-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.22;
}
</style>
