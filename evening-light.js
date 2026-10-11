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
      float across = p.x + p.y * 0.55 + drift + bend;
      float folds = sin(across * 12.0 + sin(across * 3.1) * 0.7);
      float curtain = smoothstep(-0.7, 0.85, folds);

      // A second, very slow movement keeps the light uneven and organic.
      vec2 breeze = vec2(time * 0.009, sin(time * 0.055) * 0.12);
      float leaves = dapple(p * 3.2 + breeze + vec2(4.3, 2.7));
      float mottling = smoothstep(0.29, 0.73, leaves);
      float pool = exp(-dot((uv - vec2(0.95, 0.2)) * vec2(0.85, 0.65),
                           (uv - vec2(0.95, 0.2)) * vec2(0.85, 0.65)) * 2.0);
      float light = pool * (0.22 + curtain * 0.40 + mottling * 0.38);
      float shadow = pool * ((1.0 - curtain) * (0.45 + mottling * 0.55)
        + (1.0 - mottling) * 0.42);

      vec3 paper = vec3(0.957, 0.945, 0.914);
      vec3 amber = vec3(1.0, 0.815, 0.565);
      vec3 shade = vec3(0.60, 0.55, 0.47);
      vec3 color = mix(paper, amber, light * 0.38);
      color = mix(color, shade, shadow * 0.225);
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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let lastDraw = null;
  let elapsed = 0;
  let contextLost = false;

  function draw() {
    gl.uniform1f(time, elapsed);
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
    frame = requestAnimationFrame(animate);
    if (lastDraw !== null && now - lastDraw < 1000 / 30) return;
    if (lastDraw !== null) elapsed += Math.min((now - lastDraw) / 1000, 0.1);
    lastDraw = now;
    draw();
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    lastDraw = null;
    if (contextLost) return;
    if (!document.hidden && !reducedMotion.matches) {
      frame = requestAnimationFrame(animate);
    } else if (!document.hidden) {
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
  resize();
  layer.classList.add('is-ready');
  updateMotion();
})();
