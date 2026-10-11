import { currentLight, onLightChange } from './daylight.js';

(() => {
  const layer = document.querySelector('.evening-light');
  const canvas = layer?.querySelector('canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return;

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec4 u_cycle;
    uniform vec3 u_sun;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 cell = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
        mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), f.x),
        f.y
      );
    }

    float dapple(vec2 p) {
      return noise(p) * 0.58 + noise(p * 2.03 + 7.1) * 0.28
        + noise(p * 4.01 + 19.2) * 0.14;
    }

    void main() {
      vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
      vec2 p = vec2(uv.x * u_resolution.x / u_resolution.y, uv.y);
      float time = u_time;

      // Long, irregular folds project diagonally across the paper.
      float drift = sin(time * 0.10) * 0.035;
      float bend = noise(vec2(p.y * 1.8, time * 0.018)) * 0.08;
      float across = p.x + p.y * u_sun.z + drift + bend;
      float folds = sin(across * mix(12.0, 16.0, u_cycle.w) + sin(across * 3.1) * 0.7);
      float curtain = smoothstep(-0.7, 0.85, folds);

      // A second, very slow movement keeps the light uneven and organic.
      vec2 breeze = vec2(time * 0.009, sin(time * 0.055) * 0.12);
      float leaves = dapple(p * 3.2 + breeze + vec2(4.3, 2.7));
      float mottling = smoothstep(0.29, 0.73, leaves);
      vec2 distance = (uv - u_sun.xy) * vec2(0.85, 0.65);
      float pool = exp(-dot(distance, distance) * 2.0);
      float light = pool * (0.22 + curtain * 0.40 + mottling * 0.38);
      float shadow = pool * ((1.0 - curtain) * (0.45 + mottling * 0.55)
        + (1.0 - mottling) * 0.42);

      vec3 paper = vec3(0.957, 0.945, 0.914);
      paper = mix(paper, vec3(0.929, 0.929, 0.925), u_cycle.z);
      vec3 amber = mix(vec3(1.0, 0.98, 0.88), vec3(1.0, 0.815, 0.565), u_cycle.y);
      vec3 shade = vec3(0.60, 0.55, 0.47);
      vec3 color = mix(paper, amber, light * 0.38 * u_cycle.x);
      color = mix(color, shade, shadow * 0.225 * u_cycle.x * mix(1.0, 0.65, u_cycle.w));
      // A steady pool of lamplight takes over as the sun drops below the horizon.
      vec2 lampDistance = (uv - vec2(0.98, 0.78)) * vec2(1.2, 0.85);
      float lampPool = exp(-dot(lampDistance, lampDistance) * 3.2);
      color = mix(color, vec3(1.0, 0.80, 0.49), lampPool * u_cycle.z * 0.32);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const time = gl.getUniformLocation(program, 'u_time');
  const cycleUniform = gl.getUniformLocation(program, 'u_cycle');
  const sunUniform = gl.getUniformLocation(program, 'u_sun');
  const values = state => [state.daylight, state.warmth, state.lamp, state.highSun, state.sunX, state.sunY, state.slope];
  let target = values(currentLight());
  let current = [...target];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let lastDraw = null;
  let elapsed = 0;
  let contextLost = false;

  function draw() {
    gl.uniform1f(time, elapsed);
    gl.uniform4fv(cycleUniform, current.slice(0, 4));
    gl.uniform3fv(sunUniform, current.slice(4));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function resize() {
    if (contextLost) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Soft shadows need fewer pixels; keep the GPU work bounded on large screens.
    const scale = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(1000000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    draw();
  }

  function animate(now) {
    if (lastDraw !== null && now - lastDraw < 1000 / 30) {
      frame = requestAnimationFrame(animate);
      return;
    }
    const delta = lastDraw === null ? 1 / 30 : Math.min((now - lastDraw) / 1000, 0.1);
    elapsed += delta;
    const blend = 1 - Math.exp(-delta / 0.22);
    current = current.map((value, index) => value + (target[index] - value) * blend);
    lastDraw = now;
    draw();
    // Nighttime lamplight is still; only run frames for daylight or a transition.
    if (target[0] > 0.001 || current.some((value, index) => Math.abs(target[index] - value) > 0.001)) {
      frame = requestAnimationFrame(animate);
    }
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    lastDraw = null;
    if (contextLost) return;
    if (!document.hidden && !reducedMotion.matches) {
      frame = requestAnimationFrame(animate);
    } else if (!document.hidden) {
      current = [...target];
      draw();
    }
  }

  canvas.addEventListener('webglcontextlost', () => {
    contextLost = true;
    cancelAnimationFrame(frame);
    layer.classList.remove('is-ready');
  });
  // Keep the CSS light wash if the browser discards this decorative context.
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', updateMotion);
  reducedMotion.addEventListener('change', updateMotion);
  onLightChange(state => {
    target = values(state);
    updateMotion();
  });
  resize();
  layer.classList.add('is-ready');
  updateMotion();
})();
