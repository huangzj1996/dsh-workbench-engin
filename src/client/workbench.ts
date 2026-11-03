/**
 * The Workbench panel: the DeepSeek landing hero backdrop plus the centered
 * panel name.
 *
 * Backdrop layers (ported from https://www.deepseek.com/harness/):
 *  - a CSS radial-gradient fallback with the site's mask, revealed by a 1.8s
 *    opacity fade-in;
 *  - a WebGL2 fragment shader on a canvas inside that layer: a simplex-noise
 *    fluid field (two warp passes + curl), self-luminance bloom, one warm
 *    virtual light at (0.89, 0.46), a vignette and grain.
 *
 * The site also re-blurs the layer while the page scrolls; this panel never
 * scrolls, so that part is omitted.
 */
import * as React from 'react';

/** The main-panel key this bundle owns. */
export const PANEL_ID = 'hello-word';

/** Flat fallback behind the shader (the site's inline style values). */
const HERO_FALLBACK = 'radial-gradient(ellipse at 89% 46%, #777f89 0%, #204a7e 35%, #000 75%)';

/** The site's hero mask: near-opaque at the top, fully transparent at the bottom. */
const HERO_MASK = 'linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)';

/** Dark page tone the masked layer fades into (sampled below the site hero). */
const HERO_BASE = '#0f1722';

/** Full-screen triangle; the fragment shader does everything else. */
const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
void main() { gl_Position = a_position; }`;

/** The site's hero fragment shader, verbatim. */
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform vec2 u_loop1, u_loop2, u_loop3, u_loop4;
uniform vec2 u_resolution;
uniform vec2 u_grainResolution;
const vec3 u_c1=vec3(0.);
const vec3 u_c2=vec3(0.);
const vec3 u_c3=vec3(32.,74.,126.)/255.;
const vec3 u_c4=vec3(206.,200.,187.)/255.;
const vec3 u_c5=vec3(0.);
const float u_scale=1.19;
const vec2 u_offset=vec2(-1.24,-.48);
const float u_grain=.005;
const vec2 u_lightPos=vec2(.89,.46);
uniform float u_lightCore;
uniform float u_lightHalo;
const float u_vignette=.38;
const float u_bloomThreshold=.61;
const float u_bloomRange=.18;
const float u_bloomStrength=.4;
out vec4 fragColor;

vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float hash(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}

float fbm(vec3 p){
  float v=0.,amp=.6;vec3 shift=vec3(100.);
  for(int i=0;i<1;i++){v+=amp*snoise(p);p=p*2.+shift;amp*=.4;}
  return v;
}

float fluidNoise(vec2 uv){
  float n1=fbm(vec3(uv*.6,0.) + vec3(u_loop1.y,0.,u_loop1.x));
  float n2=fbm(vec3(uv*.6+5.2,1.3) + vec3(0.,u_loop1.y,u_loop1.x));
  vec2 w1=vec2(n1,n2)*.6;
  float n3=fbm(vec3((uv+w1)*.7+1.7,3.1) + vec3(u_loop2.y,0.,u_loop2.x));
  float n4=fbm(vec3((uv+w1)*.7+9.2,5.7) + vec3(0.,u_loop2.y,u_loop2.x));
  vec2 w2=vec2(n3,n4)*.5;
  return fbm(vec3((uv+w1+w2)*.5,0.) + vec3(u_loop3.y,0.,u_loop3.x));
}

vec2 curlish(vec2 uv){
  float eps=.02;
  float n=snoise(vec3(uv*.8,0.) + vec3(0.,u_loop3.y,u_loop3.x));
  float nx=snoise(vec3((uv+vec2(eps,0.))*.8,0.) + vec3(0.,u_loop3.y,u_loop3.x));
  float ny=snoise(vec3((uv+vec2(0.,eps))*.8,0.) + vec3(0.,u_loop3.y,u_loop3.x));
  return vec2(-(ny-n)/eps,(nx-n)/eps)*.003;
}

void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 uv=gl_FragCoord.xy/u_resolution;
  vec2 suv=vec2(uv.x*aspect, uv.y) * u_scale + u_offset;

  vec2 curl=curlish(suv);
  vec2 uvD=suv+curl*12.;
  float f=fluidNoise(uvD);
  float swirl=snoise(vec3(uvD*.8+f*1.5,0.) + vec3(u_loop4.y,0.,u_loop4.x))*.5+.5;
  float n=f*.5+.5;
  vec3 col=mix(u_c1,u_c2,smoothstep(.2,.5,n));
  col=mix(col,u_c3,smoothstep(.35,.65,n+swirl*.25));
  col=mix(col,u_c4,smoothstep(.6,.85,swirl)*.55);
  col=mix(col,u_c5,smoothstep(.5,.8,n*swirl)*.35);

  if(u_grain>0.0){
    vec2 flowOffset = (uvD - suv) * u_grainResolution.y;
    vec2 gp = floor((uv * u_grainResolution + flowOffset) / 5.0);
    float gr=hash(gp)*2.-1.;
    col+=gr*u_grain;
  }

  // Self-luminance bloom: bright fluid regions become their own light spots,
  // so glow follows the flow and mouse disturbance instead of a fixed point
  float luma=dot(col,vec3(.299,.587,.114));
  float bloom=smoothstep(u_bloomThreshold-u_bloomRange,u_bloomThreshold+u_bloomRange,luma);
  col+=(col*.85+vec3(.15,.145,.13))*bloom*u_bloomStrength;

  // Virtual light source: soft warm core (same side as helm lighting)
  float ld=length((uv-u_lightPos)*vec2(aspect,1.));
  float core=exp(-ld*ld*4.5);
  float halo=exp(-ld*1.8);
  col+=vec3(1.,.97,.9)*core*u_lightCore+vec3(.72,.8,1.)*halo*u_lightHalo;

  float vig=1.-smoothstep(.35,.75,length(uv-.5));
  col=mix(col*(1.-u_vignette),col,vig);
  fragColor=vec4(col,1.);
}`;

/** The site's uniform-loop periods/amplitudes (its "fluid" preset). */
const LOOP_PERIODS = [3000, 3300, 3900, 4200];
const LOOP_AMPLITUDES = [0.0102, 0.0085, 0.17 * 0.04, 0.17 * 0.035];
const TWO_PI = Math.PI * 2;

/** The site renders the hero shader at 30fps. */
const FRAME_MS = 1000 / 30;

/** Backing-store caps the site applies before drawing. */
const MAX_DPR = 1.5;
const MAX_CANVAS_WIDTH = 1400;
const MAX_CANVAS_AREA = 1000000;

/**
 * Compile and drive the hero shader on one canvas.
 * @param canvas - the backdrop canvas element.
 * @param firstFrameOnly - render a single frame (prefers-reduced-motion).
 * @returns a disposer, or null when WebGL2 or the shaders are unavailable, in
 * which case the caller's CSS fallback gradient stays visible.
 */
function startHeroShader(canvas: HTMLCanvasElement, firstFrameOnly: boolean): (() => void) | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: true,
  });
  if (gl === null) return null;

  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[workbench] hero shader failed to compile:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const disposeGl = (): void => {
    if (vertexShader !== null) gl.deleteShader(vertexShader);
    if (fragmentShader !== null) gl.deleteShader(fragmentShader);
    if (program !== null) gl.deleteProgram(program);
    if (buffer !== null) gl.deleteBuffer(buffer);
  };
  if (vertexShader === null || fragmentShader === null || program === null || buffer === null) {
    disposeGl();
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[workbench] hero shader failed to link:', gl.getProgramInfoLog(program));
    disposeGl();
    return null;
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
  const uResolution = uniform('u_resolution');
  const uGrainResolution = uniform('u_grainResolution');
  const uLightCore = uniform('u_lightCore');
  const uLightHalo = uniform('u_lightHalo');

  // Touch devices get no warm core/halo, exactly like the site.
  const coarsePointer = typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: none), (pointer: coarse)').matches;
  gl.uniform1f(uLightCore, coarsePointer ? 0 : 0.14);
  gl.uniform1f(uLightHalo, coarsePointer ? 0 : 0.2);

  // The site's "fluid" uniform loop: each u_loopN is one slowly orbiting vec2
  // that offsets the noise domains.
  const loops = LOOP_PERIODS.map((period, index) => ({
    period,
    elapsed: 0,
    radius: LOOP_AMPLITUDES[index] * period / TWO_PI,
    location: uniform('u_loop' + String(index + 1)),
  }));
  const tick = (deltaSeconds: number): void => {
    for (const loop of loops) {
      loop.elapsed = ((loop.elapsed + deltaSeconds) % loop.period + loop.period) % loop.period;
      const angle = loop.elapsed / loop.period * TWO_PI;
      gl.uniform2f(
        loop.location,
        loop.radius * Math.sin(angle),
        loop.radius * (1 - Math.cos(angle)),
      );
    }
  };

  let width = 0;
  let height = 0;
  let raf = 0;
  let lastFrame = 0;
  let lastDraw = 0;
  let needsRender = true;
  let intersecting = false;
  let lost = false;
  let disposed = false;

  const stop = (): void => {
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
    lastDraw = 0;
    lastFrame = 0;
  };

  const frame = (now: number): void => {
    raf = 0;
    if (disposed || lost || !intersecting || document.hidden || width === 0 || height === 0) return;
    if (!needsRender && lastDraw !== 0 && now - lastDraw < FRAME_MS) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const deltaSeconds = lastFrame === 0 ? 0 : 0.001 * Math.min(now - lastFrame, 100);
    lastDraw = lastDraw === 0 ? now : now - (now - lastDraw) % FRAME_MS;
    lastFrame = now;
    tick(deltaSeconds);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (canvas.style.opacity !== '1') canvas.style.opacity = '1';
    needsRender = false;
    if (!firstFrameOnly) raf = requestAnimationFrame(frame);
  };

  const schedule = (): void => {
    stop();
    if (disposed || lost || !intersecting || document.hidden) return;
    if (!needsRender && firstFrameOnly) return;
    raf = requestAnimationFrame(frame);
  };

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pixelWidth = Math.max(1, Math.floor(Math.max(1, rect.width) * dpr));
    const pixelHeight = Math.max(1, Math.floor(Math.max(1, rect.height) * dpr));
    const scale = Math.min(
      1,
      MAX_CANVAS_WIDTH / pixelWidth,
      Math.sqrt(MAX_CANVAS_AREA / (pixelWidth * pixelHeight)),
    );
    const nextWidth = Math.max(1, Math.floor(pixelWidth * scale));
    const nextHeight = Math.max(1, Math.floor(pixelHeight * scale));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
    gl.uniform2f(uResolution, width, height);
    gl.uniform2f(uGrainResolution, pixelWidth, pixelHeight);
    needsRender = true;
    schedule();
  };

  const observer = new IntersectionObserver((entries) => {
    const [entry] = entries;
    intersecting = entry.isIntersecting;
    schedule();
  });
  observer.observe(canvas);

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(canvas);

  const onVisibilityChange = (): void => schedule();
  document.addEventListener('visibilitychange', onVisibilityChange);

  const onContextLost = (): void => {
    lost = true;
    stop();
    canvas.style.opacity = '0';
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  resize();

  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    disposeGl();
  };
}

/**
 * The layered backdrop: gradient + mask on the layer, shader canvas inside,
 * and the site's fade-in.
 */
function HeroBackdrop(): React.ReactElement {
  const layerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    if (layer === null || canvas === null) return undefined;
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    layer.style.transition = reduceMotion ? 'none' : 'opacity 1.8s ease-out';
    const reveal = requestAnimationFrame(() => {
      layer.style.opacity = '1';
    });
    const dispose = startHeroShader(canvas, reduceMotion);
    return () => {
      cancelAnimationFrame(reveal);
      if (dispose !== null) dispose();
    };
  }, []);

  return React.createElement(
    'div',
    {
      ref: layerRef,
      'aria-hidden': true,
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        opacity: 0,
        background: HERO_FALLBACK,
        mask: HERO_MASK,
        WebkitMask: HERO_MASK,
      } as React.CSSProperties,
    },
    React.createElement('canvas', {
      ref: canvasRef,
      'aria-hidden': true,
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        transition: 'opacity 0.3s ease-out',
      },
    }),
  );
}

/** Component-local styles: hover/focus states need real class selectors. */
const PANEL_CSS = `
.dshwb-content{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:24px}
.dshwb-stack{display:flex;flex-direction:column;align-items:center;gap:10px;max-width:440px;text-align:center}
.dshwb-hint{margin:0;color:#eef3fb;font-size:17px;font-weight:500;letter-spacing:.02em}
.dshwb-sub{margin:0;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.7}
.dshwb-created-name{margin:0;color:#eef3fb;font-size:24px;font-weight:600;letter-spacing:.02em;word-break:break-word}
.dshwb-primary{display:inline-flex;align-items:center;justify-content:center;margin-top:8px;padding:9px 20px;border:1px solid transparent;border-radius:10px;background:var(--dsw-alias-brand-primary);color:#fff;font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;cursor:pointer;transition:filter .15s ease,transform .15s ease}
.dshwb-primary:hover{filter:brightness(1.08)}
.dshwb-primary:active{transform:translateY(1px)}
.dshwb-primary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-primary:disabled{opacity:.45;cursor:not-allowed;filter:none;transform:none}
.dshwb-secondary{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;cursor:pointer;transition:background .15s ease}
.dshwb-secondary:hover{background:var(--dsw-alias-bg-layer-2)}
.dshwb-secondary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(3,7,16,.58)}
.dshwb-dialog{box-sizing:border-box;width:360px;max-width:100%;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 24px 70px rgba(0,0,0,.5);text-align:left}
.dshwb-dialog-title{margin:0 0 4px;font-size:15px;font-weight:600;line-height:1.4}
.dshwb-dialog-sub{margin:0 0 14px;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.6}
.dshwb-label{display:block;margin:0 0 6px;color:var(--dsw-alias-label-secondary);font-size:12px}
.dshwb-input{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.4;outline:none;transition:border-color .15s ease}
.dshwb-input:focus{border-color:var(--dsw-alias-brand-primary)}
.dshwb-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.dshwb-actions .dshwb-primary{margin-top:0}
`;

/** In-memory workbench so switching panels and coming back keeps it. */
let rememberedWorkbench: string | null = null;

/** Props injected by the panel slot. */
export interface HelloPanelProps {
  /** Locale translate function bound to this plugin's namespace. */
  t?: (key: string) => string;
}

/**
 * The central panel: hero backdrop, an empty state that creates a workbench,
 * and the creation dialog.
 */
export function HelloPanel(props: HelloPanelProps): React.ReactElement {
  const translate = props.t;
  const tr = (key: string, fallback: string): string => {
    if (typeof translate !== 'function') return fallback;
    const value = translate(key);
    return value === key ? fallback : value;
  };

  const [workbench, setWorkbench] = React.useState<string | null>(() => rememberedWorkbench);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const closeDialog = React.useCallback((): void => {
    setDialogOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openDialog = React.useCallback((): void => {
    setDraftName('');
    setDialogOpen(true);
  }, []);

  React.useEffect(() => {
    if (!dialogOpen) return undefined;
    const input = inputRef.current;
    input?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [dialogOpen, closeDialog]);

  const createWorkbench = (): void => {
    const next = draftName.trim();
    if (next === '') return;
    rememberedWorkbench = next;
    setWorkbench(next);
    closeDialog();
  };

  const canCreate = draftName.trim() !== '';
  const empty = workbench === null;

  return React.createElement(
    'div',
    {
      style: {
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: HERO_BASE,
      },
    },
    React.createElement('style', {
      dangerouslySetInnerHTML: { __html: PANEL_CSS },
    }),
    React.createElement(HeroBackdrop),
    React.createElement(
      'div',
      { className: 'dshwb-content' },
      empty
        ? React.createElement(
            'div',
            { className: 'dshwb-stack' },
            React.createElement('p', { className: 'dshwb-hint' }, tr('empty.hint', '还没有工作台')),
            React.createElement('p', { className: 'dshwb-sub' }, tr('empty.sub', '创建你的第一个工作台，沉淀任务、资料与工作流。')),
            React.createElement(
              'button',
              {
                type: 'button',
                ref: triggerRef,
                className: 'dshwb-primary',
                onClick: openDialog,
              },
              tr('empty.action', '创建工作台'),
            ),
          )
        : React.createElement(
            'div',
            { className: 'dshwb-stack' },
            React.createElement('p', { className: 'dshwb-hint' }, tr('created.hint', '当前工作台')),
            React.createElement('p', { className: 'dshwb-created-name' }, workbench),
            React.createElement(
              'button',
              {
                type: 'button',
                ref: triggerRef,
                className: 'dshwb-secondary',
                onClick: openDialog,
              },
              tr('created.action', '新建工作台'),
            ),
          ),
    ),
    dialogOpen &&
      React.createElement(
        'div',
        {
          className: 'dshwb-overlay',
          onClick: closeDialog,
        },
        React.createElement(
          'div',
          {
            className: 'dshwb-dialog',
            role: 'dialog',
            'aria-modal': true,
            'aria-label': tr('dialog.title', '创建工作台'),
            onClick: (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation(),
          },
          React.createElement('h2', { className: 'dshwb-dialog-title' }, tr('dialog.title', '创建工作台')),
          React.createElement('p', { className: 'dshwb-dialog-sub' }, tr('dialog.sub', '给它起个名字，之后可以随时修改。')),
          React.createElement(
            'label',
            { className: 'dshwb-label' },
            tr('dialog.nameLabel', '工作台名称'),
            React.createElement('input', {
              ref: inputRef,
              className: 'dshwb-input',
              type: 'text',
              value: draftName,
              placeholder: tr('dialog.namePlaceholder', '例如：我的工作台'),
              autoComplete: 'off',
              spellCheck: false,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraftName(event.target.value),
              onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                createWorkbench();
              },
            }),
          ),
          React.createElement(
            'div',
            { className: 'dshwb-actions' },
            React.createElement(
              'button',
              { type: 'button', className: 'dshwb-secondary', onClick: closeDialog },
              tr('dialog.cancel', '取消'),
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshwb-primary',
                disabled: !canCreate,
                onClick: createWorkbench,
              },
              tr('dialog.create', '创建'),
            ),
          ),
        ),
      ),
  );
}
