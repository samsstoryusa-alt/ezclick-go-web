/* Local photographic distortion only. Hero playback is intentionally independent. */
(() => {
  'use strict';
  if (window.EZPhotoWarp) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lifecycle = new AbortController();
  const instances = [];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  let animation = 0;
  let lastTime = 0;
  let destroyed = false;

  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * .5 + .5;
      gl_Position = vec4(aPosition, 0., 1.);
    }`;
  const fragmentSource = `
    precision mediump float;
    uniform sampler2D uImage;
    uniform vec2 uCover;
    uniform vec2 uOffset;
    uniform vec2 uPointer;
    uniform vec2 uDrag;
    uniform float uAspect;
    uniform float uScroll;
    varying vec2 vUv;
    void main() {
      vec2 delta = vUv - uPointer;
      vec2 metric = delta * vec2(uAspect, 1.);
      float influence = exp(-dot(metric, metric) / .075);
      // Hold the photograph's perimeter still: only the pixels inside it bend.
      vec2 border = smoothstep(vec2(0.), vec2(.16), vUv)
                  * smoothstep(vec2(0.), vec2(.16), 1. - vUv);
      float edge = border.x * border.y;
      vec2 displacement = -uDrag * influence;
      // A faint S-shaped tension follows scroll direction, then relaxes to zero.
      displacement.x += sin(vUv.y * 6.2831853) * uScroll * .009;
      displacement.y += sin(vUv.x * 3.1415926) * uScroll * .004;
      vec2 sampleUv = (vUv + displacement * edge) * uCover + uOffset;
      gl_FragColor = texture2D(uImage, clamp(sampleUv, vec2(.001), vec2(.999)));
    }`;

  function wake() {
    if (!instances.some(instance => instance.visible && instance.ready && !instance.failed)) return;
    if (!animation && !destroyed && !reduced.matches && !document.hidden) {
      animation = requestAnimationFrame(tick);
    }
  }
  function tick(now) {
    animation = 0;
    const dt = lastTime ? Math.min(now - lastTime, 40) : 16.667;
    lastTime = now;
    let moving = false;
    if (!document.hidden && !reduced.matches) {
      for (const instance of instances) {
        if (instance.visible && instance.ready && !instance.failed) {
          moving = instance.step(dt) || moving;
        }
      }
    }
    if (moving) animation = requestAnimationFrame(tick);
    else lastTime = 0;
  }
  function stop() {
    if (animation) cancelAnimationFrame(animation);
    animation = lastTime = 0;
  }

  class PhotoWarp {
    constructor(frame) {
      this.frame = frame;
      this.image = frame.querySelector('img');
      this.visible = false;
      this.ready = false;
      this.failed = false;
      this.dirty = true;
      this.pointer = [.5, .5];
      this.destination = [.5, .5];
      this.drag = [0, 0];
      this.impulse = [0, 0];
      this.scroll = 0;
      this.previousPointer = null;
      this.resources = null;
      this.originalOpacity = this.image.style.opacity;
      this.painted = false;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'photo-warp-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;visibility:hidden;transform:translate3d(0,var(--image-y,0px),0) scale(var(--image-scale,1.16));';
      frame.append(this.canvas);
      const options = { signal: lifecycle.signal, passive: true };
      frame.addEventListener('pointermove', event => this.onPointer(event), options);
      frame.addEventListener('pointerleave', () => { this.previousPointer = null; }, options);
      this.canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        this.ready = false;
        this.painted = false;
        this.showOriginal();
      }, { signal: lifecycle.signal });
      this.canvas.addEventListener('webglcontextrestored', () => this.setup(), { signal: lifecycle.signal });
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(frame);
      this.observer = new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        if (this.visible) {
          if (!this.ready && !this.failed && !reduced.matches) this.load();
          this.dirty = true;
          wake();
        } else this.reset();
      }, { rootMargin: '80px 0px' });
      this.observer.observe(frame);
    }

    load() {
      if (this.loading || reduced.matches) return;
      this.loading = true;
      const decoded = this.image.decode ? this.image.decode() : Promise.resolve();
      decoded.then(() => {
        this.loading = false;
        if (!destroyed && !reduced.matches && this.image.naturalWidth) this.setup();
      }).catch(() => {
        this.loading = false;
        this.failed = true;
        this.showOriginal();
      });
    }

    setup() {
      if (destroyed || reduced.matches) return;
      try {
        const gl = this.gl || this.canvas.getContext('webgl', {
          alpha: false, antialias: false, depth: false, stencil: false,
          preserveDrawingBuffer: false, powerPreference: 'low-power'
        });
        if (!gl) throw new Error('WebGL unavailable');
        this.gl = gl;
        const compile = (type, source) => {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            throw new Error('Photo shader could not compile');
          }
          return shader;
        };
        const vertex = compile(gl.VERTEX_SHADER, vertexSource);
        const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          gl.deleteProgram(program);
          throw new Error('Photo shader could not link');
        }
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        const texture = gl.createTexture();
        this.resources = { program, buffer, texture };
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Photo texture unavailable');
        this.uniforms = {};
        for (const name of ['uImage','uCover','uOffset','uPointer','uDrag','uAspect','uScroll']) {
          this.uniforms[name] = gl.getUniformLocation(program, name);
        }
        gl.uniform1i(this.uniforms.uImage, 0);
        this.ready = true;
        this.measure();
        wake();
      } catch (_) {
        this.releaseResources();
        this.failed = true;
        this.ready = false;
        this.showOriginal();
      }
    }

    measure() {
      const width = this.frame.clientWidth;
      const height = this.frame.clientHeight;
      if (!width || !height) return;
      this.width = width;
      this.height = height;
      this.aspect = width / height;
      const dpr = Math.min(devicePixelRatio || 1, 1.5, 1200 / Math.max(width, height));
      const backingWidth = Math.max(1, Math.round(width * dpr));
      const backingHeight = Math.max(1, Math.round(height * dpr));
      if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
        this.canvas.width = backingWidth;
        this.canvas.height = backingHeight;
      }
      const imageAspect = this.image.naturalWidth / this.image.naturalHeight || this.aspect;
      this.cover = this.aspect > imageAspect ? [1, imageAspect / this.aspect] : [this.aspect / imageAspect, 1];
      const position = getComputedStyle(this.image).objectPosition.split(' ');
      const percentage = (value, fallback) => value?.endsWith('%') ? clamp(parseFloat(value) / 100, 0, 1) : fallback;
      this.offset = [(1 - this.cover[0]) * percentage(position[0], .5), (1 - this.cover[1]) * (1 - percentage(position[1], .5))];
      this.dirty = true;
      wake();
    }

    onPointer(event) {
      if (event.pointerType === 'touch' || reduced.matches || !this.visible || !this.ready) return;
      const rect = this.frame.getBoundingClientRect();
      const point = [clamp((event.clientX - rect.left) / rect.width, 0, 1), clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1)];
      const now = performance.now();
      if (this.previousPointer && now - this.previousPointer.time < 160) {
        const dt = Math.max(8, now - this.previousPointer.time);
        for (let axis = 0; axis < 2; axis++) {
          const velocity = (point[axis] - this.previousPointer.point[axis]) * 22 / dt;
          this.impulse[axis] = clamp(this.impulse[axis] * .35 + velocity * .65, -.055, .055);
        }
      } else this.pointer = point.slice();
      this.destination = point;
      this.previousPointer = { point, time: now };
      this.dirty = true;
      wake();
    }

    step(dt) {
      const ease = 1 - Math.exp(-dt / 55);
      const decay = Math.exp(-dt / 175);
      let energy = Math.abs(this.scroll);
      for (let axis = 0; axis < 2; axis++) {
        this.pointer[axis] += (this.destination[axis] - this.pointer[axis]) * ease;
        this.drag[axis] += (this.impulse[axis] - this.drag[axis]) * ease;
        this.impulse[axis] *= decay;
        energy += Math.abs(this.drag[axis]) + Math.abs(this.impulse[axis]);
      }
      this.scroll *= Math.exp(-dt / 145);
      const moving = energy > .00018;
      if (!moving) this.reset();
      if (this.dirty || energy > 0) this.draw();
      this.dirty = false;
      return moving;
    }

    draw() {
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.uniform2fv(this.uniforms.uCover, this.cover);
      gl.uniform2fv(this.uniforms.uOffset, this.offset);
      gl.uniform2fv(this.uniforms.uPointer, this.pointer);
      gl.uniform2fv(this.uniforms.uDrag, this.drag);
      gl.uniform1f(this.uniforms.uAspect, this.aspect);
      gl.uniform1f(this.uniforms.uScroll, this.scroll);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!this.painted && (gl.isContextLost() || gl.getError() !== gl.NO_ERROR)) {
        this.failed = true;
        this.ready = false;
        this.showOriginal();
        return;
      }
      this.painted = true;
      // Keep the semantic image and its alt text in the accessibility tree.
      this.canvas.style.visibility = 'visible';
      this.image.style.opacity = '0';
    }

    reset() {
      this.drag[0] = this.drag[1] = this.impulse[0] = this.impulse[1] = this.scroll = 0;
      this.previousPointer = null;
    }
    showOriginal() {
      this.canvas.style.visibility = 'hidden';
      this.image.style.opacity = this.originalOpacity;
    }
    releaseResources() {
      if (this.resources && this.gl && !this.gl.isContextLost()) {
        this.gl.deleteTexture(this.resources.texture);
        this.gl.deleteBuffer(this.resources.buffer);
        this.gl.deleteProgram(this.resources.program);
      }
      this.resources = null;
    }
    destroy() {
      this.observer.disconnect();
      this.resizeObserver.disconnect();
      this.showOriginal();
      this.releaseResources();
      this.canvas.remove();
    }
  }

  window.EZPhotoWarp = {
    init(root = document) {
      if (destroyed || !window.ResizeObserver || !window.IntersectionObserver) return;
      for (const frame of root.querySelectorAll('.photo-frame')) {
        if (instances.length === 3) break;
        if (frame.querySelector('img') && !instances.some(instance => instance.frame === frame)) instances.push(new PhotoWarp(frame));
      }
    },
    // The caller supplies signed CSS pixels per second; no scroll/touch is captured.
    setScrollVelocity(pixelsPerSecond) {
      if (reduced.matches || document.hidden || !Number.isFinite(pixelsPerSecond)) return;
      const value = clamp(pixelsPerSecond / 1800, -1, 1);
      for (const instance of instances) {
        if (instance.visible && instance.ready) {
          instance.scroll = instance.scroll * .4 + value * .6;
          instance.dirty = true;
        }
      }
      wake();
    },
    refresh() { instances.forEach(instance => instance.measure()); },
    getState() {
      return { reducedMotion: reduced.matches, rendering: Boolean(animation), photos: instances.map(instance => ({ ready: instance.ready, visible: instance.visible, failed: instance.failed, width: instance.canvas.width, height: instance.canvas.height })) };
    },
    destroy() {
      destroyed = true;
      stop();
      lifecycle.abort();
      instances.forEach(instance => instance.destroy());
      instances.length = 0;
    }
  };
  reduced.addEventListener('change', () => {
    stop();
    for (const instance of instances) {
      instance.reset();
      instance.showOriginal();
      if (!reduced.matches && instance.visible) {
        if (!instance.ready) instance.load();
        instance.dirty = true;
      }
    }
    wake();
  }, { signal: lifecycle.signal });
  document.addEventListener('visibilitychange', () => {
    stop();
    instances.forEach(instance => {
      instance.reset();
      instance.dirty = true;
    });
    if (!document.hidden) wake();
  }, { signal: lifecycle.signal });
  window.EZPhotoWarp.init();
})();
