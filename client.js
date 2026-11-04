// 由 scripts/build.mjs 从 src/client/** 生成 —— 不要手改本文件。
window.__ModuleLoader__.load({
  id: "dsh-hello-word",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var React10 = __toESM(require("react"), 1);

// src/client/rpc.ts
var CARRIER_CHANNEL = "/api";
var CARRIER_ENDPOINT = "workbench";
var CONNECTION_WAIT_MS = 5e3;
var WorkbenchRpcError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "WorkbenchRpcError";
    this.code = code;
  }
};
async function resolveConnection(ctx) {
  const existing = ctx.get("connection");
  if (existing !== void 0 && existing.rpc !== void 0) return existing;
  if (typeof ctx.inject !== "function") return existing;
  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      ctx.inject?.(["connection"], done);
    } catch {
      done();
    }
    setTimeout(done, CONNECTION_WAIT_MS);
  });
  return ctx.get("connection");
}
function createWorkbenchClient(ctx) {
  async function call(method, payload) {
    const connection = await resolveConnection(ctx);
    const rpc = connection?.rpc;
    if (rpc === void 0 || typeof rpc.call !== "function") {
      throw new WorkbenchRpcError("internal", "连接服务不可用，请稍后重试");
    }
    let reply;
    try {
      reply = await rpc.call(CARRIER_CHANNEL, CARRIER_ENDPOINT, { method, payload });
    } catch (error) {
      throw new WorkbenchRpcError(
        "internal",
        error instanceof Error ? error.message : String(error)
      );
    }
    const envelope = reply;
    if (typeof envelope === "object" && envelope !== null && "ok" in envelope) {
      if (envelope.ok) return envelope.value;
      throw new WorkbenchRpcError(envelope.error.code, envelope.error.message);
    }
    throw new WorkbenchRpcError("internal", `RPC 返回格式不正确：${method}`);
  }
  return {
    getRootConfig: () => call("getRootConfig", {}),
    setRoot: (root) => call("setRoot", { root }),
    list: () => call("list", {}),
    read: (id) => call("read", { id }),
    save: (scene) => call("save", { scene }),
    delete: (id) => call("delete", { id })
  };
}

// src/client/workbench.ts
var React9 = __toESM(require("react"), 1);

// src/client/create-workbench-dialog.ts
var React2 = __toESM(require("react"), 1);

// src/client/clipboard.ts
var React = __toESM(require("react"), 1);
async function copyText(text) {
  try {
    const clipboard = typeof navigator === "undefined" ? void 0 : navigator.clipboard;
    if (clipboard === void 0 || typeof clipboard.writeText !== "function") return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
function useCopyToClipboard() {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);
  const copy = React.useCallback((text) => {
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setCopied(false);
      }, 1500);
    });
  }, []);
  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );
  return { copied, copy };
}

// src/shared/workbench/schema.ts
var WORKBENCH_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
var DEFAULT_COLS = 4;
var DEFAULT_SPAN = 2;

// src/shared/workbench/ids.ts
var RANDOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
var RANDOM_LENGTH = 6;
function slugifyWorkbenchName(name2) {
  return name2.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
function randomSuffix(random) {
  let suffix = "";
  for (let index = 0; index < RANDOM_LENGTH; index += 1) {
    const pick = Math.floor(random() * RANDOM_ALPHABET.length);
    suffix += RANDOM_ALPHABET[Math.min(RANDOM_ALPHABET.length - 1, Math.max(0, pick))];
  }
  return suffix;
}
function generateWorkbenchId(name2, takenIds, random = Math.random) {
  const taken = new Set(takenIds);
  let base = slugifyWorkbenchName(name2);
  if (base === "" || base === "wb") base = `wb-${randomSuffix(random)}`;
  if (!WORKBENCH_ID_PATTERN.test(base)) base = `wb-${randomSuffix(random)}`;
  let candidate = base;
  let attempt = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }
  return candidate;
}

// src/client/workbench-name.ts
function normalizeWorkbenchName(raw) {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

// src/client/create-workbench-dialog.ts
function CreateWorkbenchDialog(props) {
  const tr = props.translate;
  const [draftName, setDraftName] = React2.useState("");
  const [busy, setBusy] = React2.useState(false);
  const [error, setError] = React2.useState(null);
  const { copied, copy } = useCopyToClipboard();
  const inputRef = React2.useRef(null);
  React2.useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) props.onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [props.onClose, busy]);
  const name2 = normalizeWorkbenchName(draftName);
  const id = React2.useMemo(
    () => name2 === null ? "" : generateWorkbenchId(name2, props.takenIds),
    [name2, props.takenIds]
  );
  const create = () => {
    if (name2 === null || id === "" || busy) return;
    setBusy(true);
    setError(null);
    void props.onCreate(name2, id).catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    });
  };
  const canCreate = name2 !== null && !busy;
  return React2.createElement(
    "div",
    {
      className: "dshwb-overlay",
      onClick: () => {
        if (!busy) props.onClose();
      }
    },
    React2.createElement(
      "div",
      {
        className: "dshwb-dialog",
        role: "dialog",
        "aria-modal": true,
        "aria-label": tr("dialog.title", "创建工作台"),
        onClick: (event) => event.stopPropagation()
      },
      React2.createElement("h2", { className: "dshwb-dialog-title" }, tr("dialog.title", "创建工作台")),
      React2.createElement(
        "p",
        { className: "dshwb-dialog-sub" },
        tr("dialog.sub", "给它起个名字，之后再配置子面板与版面。")
      ),
      React2.createElement(
        "label",
        { className: "dshwb-label", htmlFor: "dshwb-create-name" },
        tr("dialog.nameLabel", "工作台名称")
      ),
      React2.createElement("input", {
        id: "dshwb-create-name",
        ref: inputRef,
        className: "dshwb-input",
        type: "text",
        value: draftName,
        placeholder: tr("dialog.namePlaceholder", "例如：我的工作台"),
        autoComplete: "off",
        spellCheck: false,
        disabled: busy,
        onChange: (event) => setDraftName(event.target.value),
        onKeyDown: (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          create();
        }
      }),
      React2.createElement(
        "label",
        { className: "dshwb-label dshwb-label-spaced", htmlFor: "dshwb-create-id" },
        tr("dialog.idLabel", "工作台 id（自动生成，只读）")
      ),
      React2.createElement(
        "div",
        { className: "dshwb-idrow" },
        React2.createElement("input", {
          id: "dshwb-create-id",
          className: "dshwb-idvalue",
          type: "text",
          value: id,
          readOnly: true,
          placeholder: tr("dialog.idPlaceholder", "输入名称后自动生成"),
          onFocus: (event) => event.currentTarget.select()
        }),
        React2.createElement(
          "button",
          {
            type: "button",
            className: "dshwb-secondary",
            disabled: id === "" || busy,
            onClick: () => copy(id)
          },
          copied ? tr("dialog.copied", "已复制") : tr("dialog.copy", "复制")
        )
      ),
      React2.createElement(
        "p",
        { className: "dshwb-dialog-hint" },
        tr("dialog.idHint", "id 也是文件夹名，创建后不可修改；可以复制给 AI 使用。")
      ),
      error !== null && React2.createElement("p", { className: "dshwb-error", role: "alert" }, error),
      React2.createElement(
        "div",
        { className: "dshwb-actions" },
        React2.createElement(
          "button",
          { type: "button", className: "dshwb-secondary", disabled: busy, onClick: props.onClose },
          tr("dialog.cancel", "取消")
        ),
        React2.createElement(
          "button",
          { type: "button", className: "dshwb-primary", disabled: !canCreate, onClick: create },
          busy ? tr("dialog.creating", "创建中…") : tr("dialog.create", "创建")
        )
      )
    )
  );
}

// src/client/hero-backdrop.ts
var React3 = __toESM(require("react"), 1);
var HERO_FALLBACK = "radial-gradient(ellipse at 89% 46%, #777f89 0%, #204a7e 35%, #000 75%)";
var HERO_MASK = "linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)";
var HERO_BASE = "#0f1722";
var VERTEX_SHADER = `#version 300 es
in vec4 a_position;
void main() { gl_Position = a_position; }`;
var FRAGMENT_SHADER = `#version 300 es
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
var LOOP_PERIODS = [3e3, 3300, 3900, 4200];
var LOOP_AMPLITUDES = [0.0102, 85e-4, 0.17 * 0.04, 0.17 * 0.035];
var TWO_PI = Math.PI * 2;
var FRAME_MS = 1e3 / 30;
var MAX_DPR = 1.5;
var MAX_CANVAS_WIDTH = 1400;
var MAX_CANVAS_AREA = 1e6;
function startHeroShader(canvas, firstFrameOnly) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: true
  });
  if (gl === null) return null;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("[workbench] hero shader failed to compile:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const disposeGl = () => {
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
    console.warn("[workbench] hero shader failed to link:", gl.getProgramInfoLog(program));
    disposeGl();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name2) => gl.getUniformLocation(program, name2);
  const uResolution = uniform("u_resolution");
  const uGrainResolution = uniform("u_grainResolution");
  const uLightCore = uniform("u_lightCore");
  const uLightHalo = uniform("u_lightHalo");
  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(hover: none), (pointer: coarse)").matches;
  gl.uniform1f(uLightCore, coarsePointer ? 0 : 0.14);
  gl.uniform1f(uLightHalo, coarsePointer ? 0 : 0.2);
  const loops = LOOP_PERIODS.map((period, index) => ({
    period,
    elapsed: 0,
    radius: LOOP_AMPLITUDES[index] * period / TWO_PI,
    location: uniform("u_loop" + String(index + 1))
  }));
  const tick = (deltaSeconds) => {
    for (const loop of loops) {
      loop.elapsed = ((loop.elapsed + deltaSeconds) % loop.period + loop.period) % loop.period;
      const angle = loop.elapsed / loop.period * TWO_PI;
      gl.uniform2f(
        loop.location,
        loop.radius * Math.sin(angle),
        loop.radius * (1 - Math.cos(angle))
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
  const stop = () => {
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
    lastDraw = 0;
    lastFrame = 0;
  };
  const frame = (now) => {
    raf = 0;
    if (disposed || lost || !intersecting || document.hidden || width === 0 || height === 0) return;
    if (!needsRender && lastDraw !== 0 && now - lastDraw < FRAME_MS) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const deltaSeconds = lastFrame === 0 ? 0 : 1e-3 * Math.min(now - lastFrame, 100);
    lastDraw = lastDraw === 0 ? now : now - (now - lastDraw) % FRAME_MS;
    lastFrame = now;
    tick(deltaSeconds);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (canvas.style.opacity !== "1") canvas.style.opacity = "1";
    needsRender = false;
    if (!firstFrameOnly) raf = requestAnimationFrame(frame);
  };
  const schedule = () => {
    stop();
    if (disposed || lost || !intersecting || document.hidden) return;
    if (!needsRender && firstFrameOnly) return;
    raf = requestAnimationFrame(frame);
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pixelWidth = Math.max(1, Math.floor(Math.max(1, rect.width) * dpr));
    const pixelHeight = Math.max(1, Math.floor(Math.max(1, rect.height) * dpr));
    const scale = Math.min(
      1,
      MAX_CANVAS_WIDTH / pixelWidth,
      Math.sqrt(MAX_CANVAS_AREA / (pixelWidth * pixelHeight))
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
  const onVisibilityChange = () => schedule();
  document.addEventListener("visibilitychange", onVisibilityChange);
  const onContextLost = () => {
    lost = true;
    stop();
    canvas.style.opacity = "0";
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  resize();
  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    disposeGl();
  };
}
function HeroBackdrop() {
  const layerRef = React3.useRef(null);
  const canvasRef = React3.useRef(null);
  React3.useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    if (layer === null || canvas === null) return void 0;
    const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    layer.style.transition = reduceMotion ? "none" : "opacity 1.8s ease-out";
    const reveal = requestAnimationFrame(() => {
      layer.style.opacity = "1";
    });
    const dispose = startHeroShader(canvas, reduceMotion);
    return () => {
      cancelAnimationFrame(reveal);
      if (dispose !== null) dispose();
    };
  }, []);
  return React3.createElement(
    "div",
    {
      ref: layerRef,
      "aria-hidden": true,
      style: {
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        opacity: 0,
        background: HERO_FALLBACK,
        mask: HERO_MASK,
        WebkitMask: HERO_MASK
      }
    },
    React3.createElement("canvas", {
      ref: canvasRef,
      "aria-hidden": true,
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0,
        transition: "opacity 0.3s ease-out"
      }
    })
  );
}

// src/client/scene-editor.ts
var React8 = __toESM(require("react"), 1);

// src/client/config-drawer.ts
var React4 = __toESM(require("react"), 1);

// src/client/workbench-draft.ts
var PANEL_TYPES = ["reserved", "harness"];
function nextPanelId(panels) {
  const taken = new Set(panels.map((panel) => panel.id));
  let index = 1;
  while (taken.has(`panel-${index}`)) index += 1;
  return `panel-${index}`;
}
function createPanel(type, panels, title) {
  const id = nextPanelId(panels);
  if (type === "harness") {
    return { id, title, type, sessionTitle: "", sessionId: "", pinTarget: [] };
  }
  return { id, title, type, text: "" };
}
function createWorkbenchScene(id, name2, panelTitle) {
  return {
    id,
    name: name2,
    cols: DEFAULT_COLS,
    panels: [createPanel("reserved", [], panelTitle)]
  };
}
function withPanels(scene, panels) {
  return { ...scene, panels };
}
function addPanel(scene, type, title) {
  return withPanels(scene, [...scene.panels, createPanel(type, scene.panels, title)]);
}
function removePanel(scene, id) {
  const panels = scene.panels.filter((panel) => panel.id !== id);
  return panels.length === scene.panels.length ? scene : withPanels(scene, panels);
}
function movePanel(scene, id, delta) {
  const from = scene.panels.findIndex((panel) => panel.id === id);
  if (from === -1) return scene;
  const to = from + delta;
  if (to < 0 || to >= scene.panels.length) return scene;
  const panels = [...scene.panels];
  const [moved] = panels.splice(from, 1);
  panels.splice(to, 0, moved);
  return withPanels(scene, panels);
}
function updatePanel(scene, id, patch) {
  const index = scene.panels.findIndex((panel) => panel.id === id);
  if (index === -1) return scene;
  const next = { ...scene.panels[index], ...patch };
  for (const key of Object.keys(patch)) {
    if (patch[key] === void 0) delete next[key];
  }
  const panels = [...scene.panels];
  panels[index] = next;
  return withPanels(scene, panels);
}
function updateWorkbench(scene, patch) {
  const next = { ...scene, ...patch };
  for (const key of Object.keys(patch)) {
    if (patch[key] === void 0) delete next[key];
  }
  return next;
}
function changePanelType(scene, id, type) {
  const current = scene.panels.find((panel) => panel.id === id);
  if (current === void 0 || current.type === type) return scene;
  const next = { ...current, type };
  const defaults = type === "harness" ? { id, title: current.title, type, sessionTitle: "", sessionId: "", pinTarget: [] } : { id, title: current.title, type, text: "" };
  for (const key of Object.keys(defaults)) {
    if (next[key] === void 0) next[key] = defaults[key];
  }
  return updatePanel(scene, id, next);
}

// src/client/config-drawer.ts
var DRAWER_CSS = `
.dshwb-drawer{box-sizing:border-box;display:flex;flex:0 0 380px;flex-direction:column;max-width:380px;min-height:0;overflow:auto;padding:12px 14px 20px;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:rgba(9,15,26,.82);backdrop-filter:blur(14px);box-shadow:0 14px 36px rgba(0,0,0,.28);color:#eef3fb}
.dshwb-drawer-head{display:flex;align-items:center;gap:8px;margin:0 0 4px}
.dshwb-drawer-title{margin:0;flex:1;font-size:14px;font-weight:600;line-height:1.4}
.dshwb-drawer-section{margin:12px 0 0;padding:12px 0 0;border-top:1px solid rgba(255,255,255,.1)}
.dshwb-drawer-section-title{margin:0 0 10px;color:rgba(226,234,248,.7);font-size:11.5px;font-weight:600;letter-spacing:.06em}
.dshwb-field{margin:0 0 10px}
.dshwb-field-label{display:block;margin:0 0 5px;color:rgba(226,234,248,.68);font-size:12px}
.dshwb-textarea{min-height:62px;resize:vertical;line-height:1.5;font-family:inherit}
.dshwb-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dshwb-idrow{display:flex;align-items:center;gap:8px}
.dshwb-idvalue{flex:1;min-width:0;overflow:hidden;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.04);color:rgba(226,234,248,.8);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}
.dshwb-panel-list{display:flex;flex-direction:column;gap:6px;margin:0 0 10px;padding:0;list-style:none}
.dshwb-panel-row{display:flex;align-items:center;gap:4px;padding:4px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.04)}
.dshwb-panel-row-active{border-color:var(--dsw-alias-brand-primary);background:rgba(86,160,255,.12)}
.dshwb-panel-pick{display:flex;flex:1;min-width:0;align-items:center;gap:7px;padding:4px 5px;border:0;border-radius:6px;background:none;color:inherit;font-family:inherit;font-size:12px;text-align:left;cursor:pointer}
.dshwb-panel-pick:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dshwb-panel-ordinal{flex:0 0 auto;color:rgba(169,206,255,.85);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px}
.dshwb-panel-name{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12.5px}
.dshwb-panel-kind{flex:0 0 auto;color:rgba(226,234,248,.45);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px}
.dshwb-icon-btn{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:transparent;color:rgba(226,234,248,.75);font-family:inherit;font-size:11px;line-height:1;cursor:pointer}
.dshwb-icon-btn:hover:not(:disabled){background:rgba(255,255,255,.1)}
.dshwb-icon-btn:disabled{opacity:.35;cursor:not-allowed}
.dshwb-icon-btn-danger:hover:not(:disabled){background:rgba(255,112,96,.18);color:#ffb4a8}
.dshwb-confirm{display:flex;flex:0 0 auto;align-items:center;gap:4px}
.dshwb-confirm-text{color:#ffb4a8;font-size:11px;white-space:nowrap}
.dshwb-add-row{display:flex;flex-wrap:wrap;gap:8px}
.dshwb-add-row .dshwb-input{flex:1;min-width:0;color-scheme:dark}
.dshwb-drawer select.dshwb-input{color-scheme:dark}
.dshwb-drawer-hint{margin:0;color:rgba(226,234,248,.55);font-size:11.5px;line-height:1.6}
@media (max-width: 900px){.dshwb-drawer{position:absolute;top:0;right:0;bottom:0;z-index:5;flex:none;width:min(380px,88%);max-width:none;box-shadow:-18px 0 48px rgba(0,0,0,.45)}}
`;
function panelTypeLabel(tr, type) {
  if (type === "reserved") return tr("panel.type.reserved", "占位");
  if (type === "harness") return tr("panel.type.harness", "会话门牌");
  return type;
}
function stringField(panel, key) {
  const value = panel[key];
  return typeof value === "string" ? value : "";
}
function stringArrayField(panel, key) {
  const value = panel[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function parseStringList(raw) {
  return raw.split(",").map((item) => item.trim()).filter((item) => item !== "");
}
function Field(props) {
  return React4.createElement(
    "div",
    { className: "dshwb-field" },
    React4.createElement("label", { className: "dshwb-field-label", htmlFor: props.htmlFor }, props.label),
    props.children,
    props.hint !== void 0 && React4.createElement("p", { className: "dshwb-drawer-hint" }, props.hint)
  );
}
function TextField(props) {
  return React4.createElement(
    Field,
    { label: props.label, htmlFor: props.id, hint: props.hint },
    React4.createElement("input", {
      id: props.id,
      className: "dshwb-input",
      type: "text",
      value: props.value,
      placeholder: props.placeholder,
      autoComplete: "off",
      spellCheck: false,
      onChange: (event) => props.onValue(event.target.value),
      onBlur: props.onBlur
    })
  );
}
function TextAreaField(props) {
  return React4.createElement(
    Field,
    { label: props.label, htmlFor: props.id },
    React4.createElement("textarea", {
      id: props.id,
      className: "dshwb-input dshwb-textarea",
      value: props.value,
      placeholder: props.placeholder,
      spellCheck: false,
      onChange: (event) => props.onValue(event.target.value)
    })
  );
}
function NumberField(props) {
  return React4.createElement(
    Field,
    { label: props.label, htmlFor: props.id },
    React4.createElement("input", {
      id: props.id,
      className: "dshwb-input",
      type: "number",
      inputMode: "numeric",
      min: props.min,
      max: props.max,
      value: props.value === void 0 ? "" : String(props.value),
      onChange: (event) => {
        const raw = event.target.value.trim();
        if (raw === "") {
          props.onValue(void 0);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < props.min) return;
        if (props.max !== void 0 && parsed > props.max) return;
        props.onValue(parsed);
      }
    })
  );
}
function TypeFields(props) {
  const { panel, tr, onValue } = props;
  if (panel.type === "reserved") {
    return React4.createElement(TextAreaField, {
      id: `dshwb-panel-text`,
      label: tr("panel.text", "占位文本"),
      value: stringField(panel, "text"),
      placeholder: tr("panel.textPlaceholder", "占位面板里显示的文字"),
      onValue: (value) => onValue({ text: value })
    });
  }
  if (panel.type === "harness") {
    return React4.createElement(
      React4.Fragment,
      null,
      React4.createElement(TextField, {
        id: "dshwb-panel-session-title",
        label: tr("panel.sessionTitle", "会话标题"),
        value: stringField(panel, "sessionTitle"),
        placeholder: tr("panel.sessionTitlePlaceholder", "显示在门牌上的标题"),
        onValue: (value) => onValue({ sessionTitle: value })
      }),
      React4.createElement(TextField, {
        id: "dshwb-panel-session-id",
        label: tr("panel.sessionId", "会话 id"),
        value: stringField(panel, "sessionId"),
        placeholder: tr("panel.sessionIdPlaceholder", "要打开的会话"),
        onValue: (value) => onValue({ sessionId: value })
      }),
      React4.createElement(TextField, {
        id: "dshwb-panel-pin-target",
        label: tr("panel.pinTarget", "定位目标"),
        value: stringArrayField(panel, "pinTarget").join(", "),
        placeholder: tr("panel.pinTargetPlaceholder", "多个用逗号分隔"),
        onValue: (value) => onValue({ pinTarget: parseStringList(value) })
      })
    );
  }
  return React4.createElement(
    "p",
    { className: "dshwb-drawer-hint" },
    tr("panel.unknownFields", "这个类型没有内置编辑器；它的未知字段会原样保存。")
  );
}
function ConfigDrawer(props) {
  const { scene, tr } = props;
  const { copied, copy } = useCopyToClipboard();
  const [nameDraft, setNameDraft] = React4.useState(scene.name);
  const [confirmDeleteId, setConfirmDeleteId] = React4.useState(null);
  const [addType, setAddType] = React4.useState("reserved");
  React4.useEffect(() => {
    setNameDraft(scene.name);
  }, [scene.id]);
  const commitName = (raw) => {
    setNameDraft(raw);
    if (normalizeWorkbenchName(raw) !== null) props.onWorkbenchChange({ name: raw.trim() });
  };
  const commitNameOnBlur = () => {
    if (normalizeWorkbenchName(nameDraft) === null) setNameDraft(scene.name);
  };
  const cols = scene.cols ?? DEFAULT_COLS;
  const selected = scene.panels.find((panel) => panel.id === props.selectedPanelId);
  const workbenchSection = React4.createElement(
    "section",
    { className: "dshwb-drawer-section" },
    React4.createElement("h3", { className: "dshwb-drawer-section-title" }, tr("drawer.workbench", "工作台")),
    React4.createElement(TextField, {
      id: "dshwb-scene-name",
      label: tr("drawer.name", "名称"),
      value: nameDraft,
      placeholder: tr("drawer.namePlaceholder", "例如：我的工作台"),
      onValue: commitName,
      onBlur: commitNameOnBlur
    }),
    React4.createElement(TextAreaField, {
      id: "dshwb-scene-description",
      label: tr("drawer.description", "描述"),
      value: scene.description ?? "",
      placeholder: tr("drawer.descriptionPlaceholder", "这个工作台是做什么的"),
      onValue: (value) => props.onWorkbenchChange({ description: value })
    }),
    React4.createElement(NumberField, {
      id: "dshwb-scene-cols",
      label: tr("drawer.cols", "列数"),
      value: cols,
      min: 1,
      max: 12,
      onValue: (value) => {
        if (value !== void 0) props.onWorkbenchChange({ cols: value });
      }
    }),
    React4.createElement(
      "div",
      { className: "dshwb-field" },
      React4.createElement(
        "label",
        { className: "dshwb-field-label", htmlFor: "dshwb-scene-id" },
        tr("drawer.id", "id（创建后只读）")
      ),
      React4.createElement(
        "div",
        { className: "dshwb-idrow" },
        React4.createElement(
          "input",
          {
            id: "dshwb-scene-id",
            className: "dshwb-idvalue",
            type: "text",
            value: scene.id,
            readOnly: true,
            onFocus: (event) => event.currentTarget.select()
          }
        ),
        React4.createElement(
          "button",
          {
            type: "button",
            className: "dshwb-secondary",
            onClick: () => copy(scene.id)
          },
          copied ? tr("drawer.copied", "已复制") : tr("drawer.copy", "复制")
        )
      )
    )
  );
  const panelSection = React4.createElement(
    "section",
    { className: "dshwb-drawer-section" },
    React4.createElement("h3", { className: "dshwb-drawer-section-title" }, tr("drawer.panels", "子面板")),
    scene.panels.length === 0 ? React4.createElement("p", { className: "dshwb-drawer-hint" }, tr("drawer.noPanels", "还没有子面板。")) : React4.createElement(
      "ul",
      { className: "dshwb-panel-list" },
      scene.panels.map(
        (panel, index) => React4.createElement(
          "li",
          {
            key: panel.id,
            className: panel.id === props.selectedPanelId ? "dshwb-panel-row dshwb-panel-row-active" : "dshwb-panel-row"
          },
          React4.createElement(
            "button",
            {
              type: "button",
              className: "dshwb-panel-pick",
              title: panel.title,
              onClick: () => props.onSelectPanel(panel.id)
            },
            React4.createElement(
              "span",
              { className: "dshwb-panel-ordinal" },
              String(index + 1).padStart(2, "0")
            ),
            React4.createElement(
              "span",
              { className: "dshwb-panel-name" },
              panel.title.trim() === "" ? tr("panel.untitled", "未命名") : panel.title
            ),
            React4.createElement("span", { className: "dshwb-panel-kind" }, panel.type)
          ),
          confirmDeleteId === panel.id ? React4.createElement(
            "span",
            { className: "dshwb-confirm" },
            React4.createElement(
              "span",
              { className: "dshwb-confirm-text" },
              tr("drawer.deleteConfirm", "确认删除？")
            ),
            React4.createElement(
              "button",
              {
                type: "button",
                className: "dshwb-icon-btn",
                title: tr("drawer.confirm", "确认"),
                onClick: () => {
                  setConfirmDeleteId(null);
                  props.onDeletePanel(panel.id);
                }
              },
              "✓"
            ),
            React4.createElement(
              "button",
              {
                type: "button",
                className: "dshwb-icon-btn",
                title: tr("drawer.cancel", "取消"),
                onClick: () => setConfirmDeleteId(null)
              },
              "✕"
            )
          ) : React4.createElement(
            React4.Fragment,
            null,
            React4.createElement(
              "button",
              {
                type: "button",
                className: "dshwb-icon-btn",
                title: tr("drawer.moveUp", "上移"),
                disabled: index === 0,
                onClick: () => props.onMovePanel(panel.id, -1)
              },
              "↑"
            ),
            React4.createElement(
              "button",
              {
                type: "button",
                className: "dshwb-icon-btn",
                title: tr("drawer.moveDown", "下移"),
                disabled: index === scene.panels.length - 1,
                onClick: () => props.onMovePanel(panel.id, 1)
              },
              "↓"
            ),
            React4.createElement(
              "button",
              {
                type: "button",
                className: "dshwb-icon-btn dshwb-icon-btn-danger",
                title: tr("drawer.delete", "删除"),
                onClick: () => setConfirmDeleteId(panel.id)
              },
              "✕"
            )
          )
        )
      )
    ),
    React4.createElement(
      "div",
      { className: "dshwb-add-row" },
      React4.createElement(
        "select",
        {
          className: "dshwb-input",
          "aria-label": tr("panel.type", "类型"),
          value: addType,
          onChange: (event) => setAddType(event.target.value)
        },
        PANEL_TYPES.map(
          (type) => React4.createElement("option", { key: type, value: type }, panelTypeLabel(tr, type))
        )
      ),
      React4.createElement(
        "button",
        {
          type: "button",
          className: "dshwb-secondary",
          onClick: () => props.onAddPanel(addType)
        },
        tr("drawer.add", "添加子面板")
      )
    )
  );
  const typeOptions = React4.useMemo(() => {
    const known = new Set(PANEL_TYPES);
    const options = [...PANEL_TYPES];
    if (selected !== void 0 && !known.has(selected.type)) options.push(selected.type);
    return options;
  }, [selected]);
  const selectedSection = React4.createElement(
    "section",
    { className: "dshwb-drawer-section" },
    React4.createElement(
      "h3",
      { className: "dshwb-drawer-section-title" },
      tr("drawer.panelProps", "子面板属性")
    ),
    selected === void 0 ? React4.createElement(
      "p",
      { className: "dshwb-drawer-hint" },
      tr("drawer.selectPanelHint", "在下面的列表里选择一个子面板来编辑它的属性。")
    ) : React4.createElement(
      React4.Fragment,
      null,
      React4.createElement(TextField, {
        id: "dshwb-panel-title",
        label: tr("panel.title", "标题"),
        value: selected.title,
        placeholder: tr("panel.titlePlaceholder", "显示在子面板顶部的标题"),
        onValue: (value) => props.onPanelChange(selected.id, { title: value })
      }),
      React4.createElement(TextField, {
        id: "dshwb-panel-sub",
        label: tr("panel.sub", "副标题"),
        value: selected.sub ?? "",
        placeholder: tr("panel.subPlaceholder", "可选的一行补充说明"),
        onValue: (value) => props.onPanelChange(selected.id, { sub: value })
      }),
      React4.createElement(
        Field,
        { label: tr("panel.type", "类型"), htmlFor: "dshwb-panel-type" },
        React4.createElement(
          "select",
          {
            id: "dshwb-panel-type",
            className: "dshwb-input",
            value: selected.type,
            onChange: (event) => props.onPanelTypeChange(selected.id, event.target.value)
          },
          typeOptions.map(
            (type) => React4.createElement(
              "option",
              { key: type, value: type },
              panelTypeLabel(tr, type)
            )
          )
        )
      ),
      React4.createElement(
        Field,
        { label: tr("panel.layout", "位置与跨度"), hint: tr("panel.layoutHint", "留空表示自动排列；坐标从 1 开始。") },
        React4.createElement(
          "div",
          { className: "dshwb-grid2" },
          React4.createElement(NumberField, {
            id: "dshwb-panel-col",
            label: tr("panel.col", "起始列"),
            value: selected.col,
            min: 1,
            onValue: (value) => props.onPanelChange(selected.id, { col: value })
          }),
          React4.createElement(NumberField, {
            id: "dshwb-panel-row",
            label: tr("panel.row", "起始行"),
            value: selected.row,
            min: 1,
            onValue: (value) => props.onPanelChange(selected.id, { row: value })
          }),
          React4.createElement(NumberField, {
            id: "dshwb-panel-w",
            label: tr("panel.w", "跨列"),
            value: selected.w,
            min: 1,
            max: 12,
            onValue: (value) => props.onPanelChange(selected.id, { w: value })
          }),
          React4.createElement(NumberField, {
            id: "dshwb-panel-h",
            label: tr("panel.h", "跨行"),
            value: selected.h,
            min: 1,
            onValue: (value) => props.onPanelChange(selected.id, { h: value })
          })
        )
      ),
      React4.createElement(TypeFields, {
        panel: selected,
        tr,
        onValue: (patch) => props.onPanelChange(selected.id, patch)
      })
    )
  );
  return React4.createElement(
    "aside",
    { className: "dshwb-drawer", "aria-label": tr("drawer.title", "配置") },
    React4.createElement("style", { dangerouslySetInnerHTML: { __html: DRAWER_CSS } }),
    React4.createElement(
      "header",
      { className: "dshwb-drawer-head" },
      React4.createElement("h2", { className: "dshwb-drawer-title" }, tr("drawer.title", "配置")),
      React4.createElement(
        "button",
        { type: "button", className: "dshwb-link", onClick: props.onClose },
        tr("drawer.close", "收起")
      )
    ),
    workbenchSection,
    panelSection,
    selectedSection
  );
}

// src/client/workbench-grid.ts
var React7 = __toESM(require("react"), 1);

// src/shared/workbench/grid.ts
function panelGridPlacement(panel) {
  const placement = {};
  const w = panel.w ?? DEFAULT_SPAN;
  const h = panel.h ?? DEFAULT_SPAN;
  if (panel.col !== void 0) placement.gridColumn = `${panel.col} / span ${w}`;
  if (panel.row !== void 0) placement.gridRow = `${panel.row} / span ${h}`;
  return placement;
}
function panelIndexLabel(index) {
  return String(index).padStart(2, "0");
}
function gridTemplateColumns(cols) {
  return `repeat(${cols ?? DEFAULT_COLS}, minmax(0, 1fr))`;
}
function panelBoundsIssues(panel, cols) {
  const columns = cols ?? DEFAULT_COLS;
  const w = panel.w ?? DEFAULT_SPAN;
  if (panel.col === void 0) {
    return w > columns ? [`跨度 ${w} 超过列数 ${columns}`] : [];
  }
  if (panel.col > columns) return [`起始列 ${panel.col} 超出列数 ${columns}`];
  if (panel.col + w - 1 > columns) {
    return [`第 ${panel.col} 列起跨 ${w} 列，超出列数 ${columns}`];
  }
  return [];
}

// src/client/renderers/reserved.ts
var React5 = __toESM(require("react"), 1);
function textField(panel, key) {
  const value = panel[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
function ReservedPanel(props) {
  const { panel, tr } = props;
  const text = textField(panel, "text") ?? tr("panel.reserved.placeholder", "占位面板，内容待补充");
  return React5.createElement(
    "div",
    { className: "dshwb-reserved" },
    React5.createElement("p", { className: "dshwb-reserved-text" }, text),
    React5.createElement("p", { className: "dshwb-reserved-type" }, `type: ${panel.type}`)
  );
}

// src/client/renderers/index.ts
var PANEL_RENDERERS = {
  reserved: ReservedPanel
};
function panelRenderer(type) {
  return Object.hasOwn(PANEL_RENDERERS, type) ? PANEL_RENDERERS[type] : void 0;
}

// src/client/renderers/unknown.ts
var React6 = __toESM(require("react"), 1);
function UnknownPanel(props) {
  const { panel, tr } = props;
  return React6.createElement(
    "p",
    { className: "dshwb-unknown" },
    `${tr("panel.unknown", "未知面板类型")}: ${panel.type}`
  );
}

// src/client/workbench-grid.ts
var GRID_CSS = `
.dshwb-grid-wrap{flex:1;min-height:0;width:100%;overflow:auto}
.dshwb-grid{display:grid;gap:12px;width:100%;min-height:100%;grid-auto-rows:minmax(150px,1fr);align-content:stretch}
.dshwb-panel{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:rgba(9,15,26,.62);backdrop-filter:blur(12px);box-shadow:0 14px 36px rgba(0,0,0,.28);color:#eef3fb}
.dshwb-panel-head{display:flex;align-items:flex-start;gap:8px;padding:10px 12px 8px;border-bottom:1px solid rgba(255,255,255,.09)}
.dshwb-panel-index{flex:0 0 auto;padding-top:1px;color:rgba(169,206,255,.85);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;letter-spacing:.06em}
.dshwb-panel-heading{flex:1;min-width:0}
.dshwb-panel-title{margin:0;overflow:hidden;font-size:13px;font-weight:600;line-height:1.45;white-space:nowrap;text-overflow:ellipsis}
.dshwb-panel-sub{margin:2px 0 0;overflow:hidden;color:rgba(226,234,248,.55);font-size:11.5px;line-height:1.45;white-space:nowrap;text-overflow:ellipsis}
.dshwb-panel-actions{display:flex;flex:0 0 auto;align-items:center;gap:6px}
.dshwb-panel-type{padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.07);color:rgba(226,234,248,.6);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px;line-height:1.6;white-space:nowrap}
.dshwb-panel-warn{padding:2px 7px;border-radius:999px;background:rgba(255,196,84,.16);color:#ffd88e;font-size:10.5px;line-height:1.6;white-space:nowrap;cursor:help}
.dshwb-panel-body{flex:1;min-height:0;overflow:auto;padding:11px 12px}
.dshwb-reserved{display:flex;flex-direction:column;gap:6px}
.dshwb-reserved-text{margin:0;color:rgba(226,234,248,.72);font-size:12.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.dshwb-reserved-type{margin:0;color:rgba(226,234,248,.4);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}
.dshwb-unknown{margin:0;color:rgba(226,234,248,.5);font-size:12.5px;line-height:1.65;word-break:break-word}
.dshwb-grid-empty{margin:0;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.7}
`;
function WorkbenchGrid(props) {
  const { scene, tr } = props;
  const cols = scene.cols ?? DEFAULT_COLS;
  return React7.createElement(
    "div",
    { className: "dshwb-grid-wrap" },
    React7.createElement("style", { dangerouslySetInnerHTML: { __html: GRID_CSS } }),
    scene.panels.length === 0 ? React7.createElement(
      "p",
      { className: "dshwb-grid-empty" },
      tr(
        "panel.empty",
        "这个工作台还没有子面板。在工作台 JSON 的 panels 里加一个，再点「刷新」。"
      )
    ) : React7.createElement(
      "div",
      {
        className: "dshwb-grid",
        style: { gridTemplateColumns: gridTemplateColumns(cols) }
      },
      scene.panels.map(
        (panel, index) => React7.createElement(PanelFrame, {
          key: panel.id,
          panel,
          index,
          cols,
          tr
        })
      )
    )
  );
}
function PanelFrame(props) {
  const { panel, index, cols, tr } = props;
  const issues = panelBoundsIssues(panel, cols);
  const issuesText = issues.join("；");
  const ordinal = panelIndexLabel(index + 1);
  React7.useEffect(() => {
    if (issuesText === "") return;
    console.warn(`[workbench] 子面板 ${ordinal}「${panel.title}」坐标越界：${issuesText}`);
  }, [issuesText, ordinal, panel.title]);
  const Renderer = panelRenderer(panel.type);
  return React7.createElement(
    "article",
    {
      className: "dshwb-panel",
      style: { ...panelGridPlacement(panel) },
      "data-panel-id": panel.id,
      "data-panel-type": panel.type
    },
    React7.createElement(
      "header",
      { className: "dshwb-panel-head" },
      React7.createElement("span", { className: "dshwb-panel-index" }, ordinal),
      React7.createElement(
        "div",
        { className: "dshwb-panel-heading" },
        React7.createElement("h3", { className: "dshwb-panel-title", title: panel.title }, panel.title),
        panel.sub !== void 0 && panel.sub.trim() !== "" && React7.createElement("p", { className: "dshwb-panel-sub", title: panel.sub }, panel.sub)
      ),
      React7.createElement(
        "div",
        { className: "dshwb-panel-actions" },
        issuesText !== "" && React7.createElement(
          "span",
          { className: "dshwb-panel-warn", title: issuesText },
          tr("panel.outOfBounds", "坐标越界")
        ),
        React7.createElement("span", { className: "dshwb-panel-type" }, panel.type)
      )
    ),
    React7.createElement(
      "div",
      { className: "dshwb-panel-body" },
      Renderer === void 0 ? React7.createElement(UnknownPanel, { panel, tr }) : React7.createElement(Renderer, { panel, tr })
    )
  );
}

// src/client/scene-editor.ts
var AUTOSAVE_DELAY_MS = 300;
var SCENE_CSS = `
.dshwb-scene{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;min-height:0;text-align:left}
.dshwb-scene-body{display:flex;flex:1;min-height:0;gap:12px;position:relative}
.dshwb-scene-body>.dshwb-grid-wrap{flex:1;min-width:0}
.dshwb-save-status{flex:0 0 auto;color:rgba(226,234,248,.6);font-size:11.5px;white-space:nowrap}
.dshwb-save-error{flex:0 1 auto;max-width:300px;min-width:0;overflow:hidden;color:#ffb4a8;font-size:11.5px;line-height:1.5;white-space:nowrap;text-overflow:ellipsis}
`;
function readableError(error) {
  if (error instanceof WorkbenchRpcError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
function SceneEditor(props) {
  const { tr, client } = props;
  const [scene, setScene] = React8.useState(props.scene);
  const [lastSaved, setLastSaved] = React8.useState(props.scene);
  const [saveError, setSaveError] = React8.useState(null);
  const [saving, setSaving] = React8.useState(false);
  const [drawerOpen, setDrawerOpen] = React8.useState(props.defaultDrawerOpen === true);
  const [selectedPanelId, setSelectedPanelId] = React8.useState(
    props.scene.panels[0]?.id ?? null
  );
  const sceneRef = React8.useRef(scene);
  sceneRef.current = scene;
  const lastSavedRef = React8.useRef(lastSaved);
  lastSavedRef.current = lastSaved;
  const retrySceneRef = React8.useRef(null);
  const timerRef = React8.useRef(null);
  const seqRef = React8.useRef(0);
  const clearTimer = React8.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const flush = React8.useCallback(async () => {
    clearTimer();
    const target = sceneRef.current;
    if (target === lastSavedRef.current) return true;
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setSaving(true);
    try {
      const saved = (await client.save(target)).scene;
      if (seq !== seqRef.current) return true;
      lastSavedRef.current = saved;
      setLastSaved(saved);
      retrySceneRef.current = null;
      setSaveError(null);
      if (sceneRef.current === target) {
        sceneRef.current = saved;
        setScene(saved);
      }
      return true;
    } catch (error) {
      if (seq !== seqRef.current) return false;
      setSaveError(readableError(error));
      retrySceneRef.current = target;
      sceneRef.current = lastSavedRef.current;
      setScene(lastSavedRef.current);
      return false;
    } finally {
      if (seq === seqRef.current) setSaving(false);
    }
  }, [clearTimer, client]);
  React8.useEffect(() => {
    if (scene === lastSaved) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, AUTOSAVE_DELAY_MS);
    return clearTimer;
  }, [scene, lastSaved, clearTimer, flush]);
  React8.useEffect(
    () => () => {
      clearTimer();
      const pending = sceneRef.current;
      if (pending !== lastSavedRef.current) {
        void client.save(pending).catch(() => void 0);
      }
    },
    [clearTimer, client]
  );
  React8.useEffect(() => {
    if (selectedPanelId !== null && scene.panels.some((panel) => panel.id === selectedPanelId)) {
      return;
    }
    setSelectedPanelId(scene.panels[0]?.id ?? null);
  }, [scene.panels, selectedPanelId]);
  const handleBack = () => {
    void flush().then((saved) => {
      if (saved) props.onBack();
    });
  };
  const handleReload = () => {
    void flush().then((saved) => {
      if (saved) props.onReload();
    });
  };
  const retrySave = () => {
    const target = retrySceneRef.current;
    if (target === null) return;
    setSaveError(null);
    setScene(target);
  };
  const onWorkbenchChange = (patch) => {
    setScene((current) => updateWorkbench(current, patch));
  };
  const onAddPanel = (type) => {
    const title = type === "harness" ? tr("panel.new.harness", "会话门牌") : tr("panel.new.reserved", "占位面板");
    const next = addPanel(sceneRef.current, type, title);
    const added = next.panels[next.panels.length - 1];
    if (added !== void 0) setSelectedPanelId(added.id);
    setScene(next);
  };
  const onDeletePanel = (id) => {
    setScene((current) => removePanel(current, id));
  };
  const onMovePanel = (id, delta) => {
    setScene((current) => movePanel(current, id, delta));
  };
  const onPanelChange = (id, patch) => {
    setScene((current) => updatePanel(current, id, patch));
  };
  const onPanelTypeChange = (id, type) => {
    setScene((current) => changePanelType(current, id, type));
  };
  const cols = scene.cols ?? DEFAULT_COLS;
  const status = scene === lastSaved ? tr("save.saved", "已保存") : saving ? tr("save.saving", "保存中…") : tr("save.pending", "待保存");
  return React8.createElement(
    "div",
    { className: "dshwb-scene" },
    React8.createElement("style", { dangerouslySetInnerHTML: { __html: SCENE_CSS } }),
    React8.createElement(
      "div",
      { className: "dshwb-scene-bar" },
      React8.createElement(
        "button",
        { type: "button", className: "dshwb-link", onClick: handleBack },
        `← ${tr("scene.back", "返回列表")}`
      ),
      React8.createElement(
        "div",
        { className: "dshwb-scene-heading" },
        React8.createElement(
          "h2",
          { className: "dshwb-scene-name", title: scene.name },
          scene.name.trim() === "" ? scene.id : scene.name
        ),
        React8.createElement("span", { className: "dshwb-scene-id", title: scene.id }, scene.id)
      ),
      React8.createElement(
        "span",
        { className: "dshwb-scene-meta" },
        `${cols} ${tr("scene.colsUnit", "列")} · ${scene.panels.length} ${tr("scene.panelsUnit", "个子面板")}`
      ),
      saveError !== null && React8.createElement(
        "span",
        { className: "dshwb-save-error", role: "alert", title: saveError },
        `${tr("save.errorPrefix", "保存失败：")}${saveError}`
      ),
      saveError !== null && React8.createElement(
        "button",
        { type: "button", className: "dshwb-link", onClick: retrySave },
        tr("save.retry", "重试")
      ),
      saveError === null && React8.createElement("span", { className: "dshwb-save-status" }, status),
      React8.createElement(
        "button",
        { type: "button", className: "dshwb-link", onClick: handleReload },
        tr("scene.refresh", "刷新")
      ),
      React8.createElement(
        "button",
        { type: "button", className: "dshwb-primary", onClick: props.onCreateWorkbench },
        tr("bar.new", "新建工作台")
      ),
      React8.createElement(
        "button",
        {
          type: "button",
          className: "dshwb-secondary",
          onClick: () => setDrawerOpen((open) => !open)
        },
        drawerOpen ? tr("drawer.hide", "收起配置") : tr("drawer.show", "配置")
      )
    ),
    scene.description !== void 0 && scene.description.trim() !== "" && React8.createElement("p", { className: "dshwb-scene-desc" }, scene.description),
    React8.createElement(
      "div",
      { className: "dshwb-scene-body" },
      React8.createElement(WorkbenchGrid, { scene, tr }),
      drawerOpen && React8.createElement(ConfigDrawer, {
        scene,
        selectedPanelId,
        tr,
        onClose: () => setDrawerOpen(false),
        onWorkbenchChange,
        onSelectPanel: setSelectedPanelId,
        onAddPanel,
        onDeletePanel,
        onMovePanel,
        onPanelChange,
        onPanelTypeChange
      })
    )
  );
}

// src/client/workbench.ts
var PANEL_ID = "hello-word";
var PANEL_CSS = `
.dshwb-content{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto}
.dshwb-stack{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:520px;text-align:center}
.dshwb-hint{margin:0;color:#eef3fb;font-size:17px;font-weight:500;letter-spacing:.02em}
.dshwb-sub{margin:0;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.7}
.dshwb-card{box-sizing:border-box;width:100%;padding:18px 18px 16px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(9,15,26,.62);backdrop-filter:blur(14px);color:#eef3fb;text-align:left;box-shadow:0 18px 48px rgba(0,0,0,.35)}
.dshwb-card-title{margin:0 0 6px;font-size:15px;font-weight:600;line-height:1.4}
.dshwb-card-sub{margin:0 0 14px;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.6}
.dshwb-label{display:block;margin:0 0 6px;color:rgba(226,234,248,.68);font-size:12px}
.dshwb-input{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(255,255,255,.06);color:#eef3fb;font-family:inherit;font-size:13px;line-height:1.4;outline:none;transition:border-color .15s ease}
.dshwb-input:focus{border-color:var(--dsw-alias-brand-primary)}
.dshwb-input::placeholder{color:rgba(226,234,248,.4)}
.dshwb-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.dshwb-primary{display:inline-flex;align-items:center;justify-content:center;padding:8px 18px;border:1px solid transparent;border-radius:9px;background:var(--dsw-alias-brand-primary);color:#fff;font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;cursor:pointer;transition:filter .15s ease}
.dshwb-primary:hover{filter:brightness(1.08)}
.dshwb-primary:active{transform:translateY(1px)}
.dshwb-primary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-primary:disabled{opacity:.45;cursor:not-allowed;filter:none;transform:none}
.dshwb-secondary{display:inline-flex;align-items:center;justify-content:center;padding:7px 14px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:transparent;color:#eef3fb;font-family:inherit;font-size:12.5px;font-weight:500;line-height:1.4;cursor:pointer;transition:background .15s ease}
.dshwb-secondary:hover{background:rgba(255,255,255,.08)}
.dshwb-secondary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-link{padding:0;border:0;background:none;color:rgba(226,234,248,.68);font-family:inherit;font-size:12px;line-height:1.4;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.dshwb-link:hover{color:#eef3fb}
.dshwb-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:4px}
.dshwb-error{margin:10px 0 0;color:#ffb4a8;font-size:12.5px;line-height:1.6;word-break:break-word}
.dshwb-root-bar{display:flex;align-items:center;gap:10px;width:100%;margin-bottom:10px;text-align:left}
.dshwb-root-path{flex:1;min-width:0;overflow:hidden;color:rgba(226,234,248,.6);font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
.dshwb-list{display:flex;flex-direction:column;gap:8px;width:100%;margin:0;padding:0;list-style:none;text-align:left}
.dshwb-item{display:flex;align-items:center;gap:10px;box-sizing:border-box;width:100%;padding:11px 13px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(255,255,255,.05);color:inherit;font-family:inherit;text-align:left;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.dshwb-item:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2)}
.dshwb-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-item-chevron{flex:0 0 auto;color:rgba(226,234,248,.45);font-size:15px;line-height:1}
.dshwb-content-scene{align-items:stretch;justify-content:stretch;padding:16px 18px;overflow:hidden}
.dshwb-scene{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;min-height:0;text-align:left}
.dshwb-scene-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.dshwb-scene-heading{display:flex;flex:1;min-width:0;align-items:baseline;gap:8px}
.dshwb-scene-name{margin:0;overflow:hidden;color:#eef3fb;font-size:15px;font-weight:600;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}
.dshwb-scene-id{overflow:hidden;max-width:40%;color:rgba(226,234,248,.48);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
.dshwb-scene-meta{flex:0 0 auto;color:rgba(226,234,248,.55);font-size:11.5px;white-space:nowrap}
.dshwb-scene-desc{margin:0;color:rgba(226,234,248,.62);font-size:12px;line-height:1.6}
.dshwb-item-name{flex:1;min-width:0;overflow:hidden;color:#eef3fb;font-size:13.5px;font-weight:500;white-space:nowrap;text-overflow:ellipsis}
.dshwb-item-id{overflow:hidden;max-width:45%;color:rgba(226,234,248,.48);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
.dshwb-badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;line-height:1.6;white-space:nowrap}
.dshwb-badge-external{background:rgba(86,160,255,.18);color:#a9ceff}
.dshwb-badge-missing{background:rgba(255,196,84,.16);color:#ffd88e}
.dshwb-badge-corrupt{background:rgba(255,112,96,.18);color:#ffb4a8}
.dshwb-loading{margin:0;color:rgba(226,234,248,.62);font-size:12.5px}
.dshwb-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(4,9,18,.6);backdrop-filter:blur(3px)}
.dshwb-dialog{box-sizing:border-box;width:100%;max-width:420px;padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(9,15,26,.94);box-shadow:0 24px 60px rgba(0,0,0,.45);color:#eef3fb}
.dshwb-dialog-title{margin:0 0 6px;font-size:16px;font-weight:600;line-height:1.4}
.dshwb-dialog-sub{margin:0 0 14px;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.6}
.dshwb-dialog-hint{margin:6px 0 0;color:rgba(226,234,248,.5);font-size:11.5px;line-height:1.6}
.dshwb-label-spaced{margin-top:12px}
.dshwb-idrow{display:flex;align-items:center;gap:8px}
.dshwb-idvalue{flex:1;min-width:0;overflow:hidden;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.04);color:rgba(226,234,248,.8);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}
`;
var STATUS_KEYS = {
  external: "list.status.external",
  missing: "list.status.missing",
  corrupt: "list.status.corrupt"
};
function HelloPanel(props) {
  const translate = props.t;
  const tr = React9.useCallback(
    (key, fallback) => {
      if (typeof translate !== "function") return fallback;
      const value = translate(key);
      return value === key ? fallback : value;
    },
    [translate]
  );
  const rpc = props.rpc;
  const [state, setState] = React9.useState({ phase: "loading" });
  const [attempt, setAttempt] = React9.useState(0);
  const [editingRoot, setEditingRoot] = React9.useState(false);
  const [pathDraft, setPathDraft] = React9.useState("");
  const [savingRoot, setSavingRoot] = React9.useState(false);
  const [saveError, setSaveError] = React9.useState(null);
  const [view, setView] = React9.useState({ kind: "list" });
  const [creating, setCreating] = React9.useState(false);
  const takenIds = React9.useMemo(
    () => state.phase === "ready" ? state.entries.map((entry) => entry.id) : [],
    [state]
  );
  const openCreate = () => setCreating(true);
  const createWorkbench = async (name2, id) => {
    if (rpc === void 0) {
      throw new WorkbenchRpcError("internal", tr("error.connection", "连接服务不可用，请稍后重试"));
    }
    const scene = createWorkbenchScene(id, name2, tr("panel.new.reserved", "占位面板"));
    const saved = (await rpc.save(scene)).scene;
    const list = await rpc.list();
    setState({ phase: "ready", root: list.root, entries: list.entries });
    setCreating(false);
    setView({ kind: "scene", scene: saved, configure: true });
  };
  const load = React9.useCallback(async () => {
    if (rpc === void 0) {
      setState({ phase: "error", message: tr("error.connection", "连接服务不可用，请稍后重试") });
      return;
    }
    setView({ kind: "list" });
    setState({ phase: "loading" });
    try {
      const config = await rpc.getRootConfig();
      if (config.root === null) {
        setState({ phase: "no-root" });
        return;
      }
      const list = await rpc.list();
      setState({ phase: "ready", root: list.root, entries: list.entries });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }, [rpc, tr]);
  React9.useEffect(() => {
    void load();
  }, [load, attempt]);
  const openWorkbench = async (id) => {
    if (rpc === void 0) return;
    setView({ kind: "opening", id });
    try {
      const { scene } = await rpc.read(id);
      setView({ kind: "scene", scene });
    } catch (error) {
      setView({
        kind: "open-error",
        id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };
  const startEditing = (prefill) => {
    setPathDraft(prefill);
    setSaveError(null);
    setEditingRoot(true);
  };
  const saveRoot = async () => {
    if (rpc === void 0) return;
    const path = pathDraft.trim();
    if (path === "") {
      setSaveError(tr("root.needPath", "请先填写文件夹路径"));
      return;
    }
    setSavingRoot(true);
    setSaveError(null);
    try {
      await rpc.setRoot(path);
      setEditingRoot(false);
      setPathDraft("");
      setAttempt((value) => value + 1);
    } catch (error) {
      setSaveError(
        error instanceof WorkbenchRpcError ? error.message : error instanceof Error ? error.message : String(error)
      );
    } finally {
      setSavingRoot(false);
    }
  };
  const renderRootForm = () => {
    return React9.createElement(
      "div",
      { className: "dshwb-card" },
      React9.createElement("h2", { className: "dshwb-card-title" }, tr("root.title", "设置工作台根目录")),
      React9.createElement(
        "p",
        { className: "dshwb-card-sub" },
        tr("root.sub", "工作台的索引与每个工作台的 JSON 都会写在这个文件夹里。")
      ),
      React9.createElement(
        "label",
        { className: "dshwb-label", htmlFor: "dshwb-root-input" },
        tr("root.label", "根目录路径")
      ),
      React9.createElement("input", {
        id: "dshwb-root-input",
        className: "dshwb-input",
        type: "text",
        value: pathDraft,
        placeholder: tr("root.placeholder", "例如：D:\\work\\my-workbenches"),
        autoComplete: "off",
        spellCheck: false,
        disabled: savingRoot,
        onChange: (event) => setPathDraft(event.target.value),
        onKeyDown: (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          void saveRoot();
        }
      }),
      saveError !== null && React9.createElement("p", { className: "dshwb-error", role: "alert" }, saveError),
      React9.createElement(
        "div",
        { className: "dshwb-actions" },
        editingRoot && React9.createElement(
          "button",
          {
            type: "button",
            className: "dshwb-secondary",
            disabled: savingRoot,
            onClick: () => {
              setEditingRoot(false);
              setSaveError(null);
            }
          },
          tr("root.cancel", "取消")
        ),
        React9.createElement(
          "button",
          {
            type: "button",
            className: "dshwb-primary",
            disabled: savingRoot,
            onClick: () => void saveRoot()
          },
          savingRoot ? tr("root.saving", "校验中…") : tr("root.save", "保存并继续")
        )
      )
    );
  };
  const renderList = (root, entries) => React9.createElement(
    React9.Fragment,
    null,
    React9.createElement(
      "div",
      { className: "dshwb-root-bar" },
      React9.createElement("span", { className: "dshwb-root-path", title: root }, root),
      React9.createElement(
        "button",
        { type: "button", className: "dshwb-primary", onClick: openCreate },
        tr("bar.new", "新建工作台")
      ),
      React9.createElement(
        "button",
        { type: "button", className: "dshwb-link", onClick: () => setAttempt((value) => value + 1) },
        tr("list.refresh", "刷新")
      ),
      React9.createElement(
        "button",
        { type: "button", className: "dshwb-link", onClick: () => startEditing(root) },
        tr("root.change", "更换根目录")
      )
    ),
    entries.length === 0 ? React9.createElement(
      "div",
      { className: "dshwb-card" },
      React9.createElement("h2", { className: "dshwb-card-title" }, tr("list.empty.title", "还没有工作台")),
      React9.createElement(
        "p",
        { className: "dshwb-card-sub" },
        tr(
          "list.empty.sub",
          "这个根目录里暂时没有工作台。可以让 AI 在根目录放一个 <id>/<id>.json，或点「新建工作台」创建。"
        )
      ),
      React9.createElement(
        "div",
        { className: "dshwb-actions" },
        React9.createElement(
          "button",
          { type: "button", className: "dshwb-primary", onClick: openCreate },
          tr("list.empty.action", "新建工作台")
        )
      )
    ) : React9.createElement(
      "ul",
      { className: "dshwb-list" },
      entries.map(
        (entry) => React9.createElement(
          "li",
          { key: entry.id },
          React9.createElement(
            "button",
            {
              type: "button",
              className: "dshwb-item",
              title: entry.name,
              onClick: () => void openWorkbench(entry.id)
            },
            React9.createElement("span", { className: "dshwb-item-name" }, entry.name),
            React9.createElement("span", { className: "dshwb-item-id" }, entry.id),
            entry.status !== "ok" && React9.createElement(
              "span",
              { className: `dshwb-badge dshwb-badge-${entry.status}` },
              tr(STATUS_KEYS[entry.status], entry.status)
            ),
            React9.createElement("span", { className: "dshwb-item-chevron", "aria-hidden": true }, "›")
          )
        )
      )
    )
  );
  const renderSceneEditor = (scene) => {
    const client = rpc;
    if (client === void 0) {
      return React9.createElement(
        "div",
        { className: "dshwb-card" },
        React9.createElement("p", { className: "dshwb-card-sub" }, tr("error.connection", "连接服务不可用，请稍后重试")),
        React9.createElement(
          "div",
          { className: "dshwb-actions" },
          React9.createElement(
            "button",
            { type: "button", className: "dshwb-secondary", onClick: () => void load() },
            tr("list.retry", "重试")
          )
        )
      );
    }
    return React9.createElement(SceneEditor, {
      key: scene.id,
      scene,
      tr,
      client,
      defaultDrawerOpen: view.kind === "scene" && view.configure === true,
      onBack: () => void load(),
      onReload: () => void openWorkbench(scene.id),
      onCreateWorkbench: openCreate
    });
  };
  const renderOpenError = (id, message) => React9.createElement(
    "div",
    { className: "dshwb-card" },
    React9.createElement("h2", { className: "dshwb-card-title" }, tr("scene.error.title", "打开工作台失败")),
    React9.createElement("p", { className: "dshwb-card-sub" }, message),
    React9.createElement(
      "div",
      { className: "dshwb-actions" },
      React9.createElement(
        "button",
        { type: "button", className: "dshwb-secondary", onClick: () => setView({ kind: "list" }) },
        tr("scene.back", "返回列表")
      ),
      React9.createElement(
        "button",
        { type: "button", className: "dshwb-primary", onClick: () => void openWorkbench(id) },
        tr("list.retry", "重试")
      )
    )
  );
  let body;
  let sceneView = false;
  if (state.phase === "loading") {
    body = React9.createElement("p", { className: "dshwb-loading" }, tr("list.loading", "正在读取…"));
  } else if (state.phase === "no-root") {
    body = renderRootForm();
  } else if (state.phase === "ready") {
    if (editingRoot) {
      body = renderRootForm();
    } else if (view.kind === "scene") {
      sceneView = true;
      body = renderSceneEditor(view.scene);
    } else if (view.kind === "opening") {
      body = React9.createElement("p", { className: "dshwb-loading" }, tr("scene.opening", "正在打开…"));
    } else if (view.kind === "open-error") {
      body = renderOpenError(view.id, view.message);
    } else {
      body = renderList(state.root, state.entries);
    }
  } else {
    body = React9.createElement(
      React9.Fragment,
      null,
      React9.createElement(
        "div",
        { className: "dshwb-card" },
        React9.createElement("h2", { className: "dshwb-card-title" }, tr("error.title", "读取失败")),
        React9.createElement("p", { className: "dshwb-card-sub" }, state.message),
        React9.createElement(
          "div",
          { className: "dshwb-actions" },
          React9.createElement(
            "button",
            { type: "button", className: "dshwb-secondary", onClick: () => setAttempt((value) => value + 1) },
            tr("list.retry", "重试")
          ),
          React9.createElement(
            "button",
            { type: "button", className: "dshwb-secondary", onClick: () => startEditing("") },
            tr("root.change", "更换根目录")
          )
        )
      ),
      editingRoot && renderRootForm()
    );
  }
  return React9.createElement(
    "div",
    {
      style: {
        position: "relative",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: HERO_BASE
      }
    },
    React9.createElement("style", { dangerouslySetInnerHTML: { __html: PANEL_CSS } }),
    React9.createElement(HeroBackdrop),
    React9.createElement(
      "div",
      { className: sceneView ? "dshwb-content dshwb-content-scene" : "dshwb-content" },
      sceneView ? body : React9.createElement("div", { className: "dshwb-stack" }, body)
    ),
    creating && React9.createElement(CreateWorkbenchDialog, {
      translate: tr,
      takenIds,
      onClose: () => setCreating(false),
      onCreate: createWorkbench
    })
  );
}

// src/client/sidebar-button.ts
var ROOT_ATTR = "data-dsh-workbench-root";
var BUTTON_MARK = "dsh-workbench-header-button";
var BUTTON_ATTR = "data-dsh-workbench-button";
var STYLE_ATTR = "data-dsh-workbench";
var GAP_PX = 6;
var SVG_NS = "http://www.w3.org/2000/svg";
function hasClassSuffix(element, suffix) {
  return Array.from(element.classList).some((name2) => name2.endsWith(suffix));
}
function findHeaderButton() {
  const buttons = document.querySelectorAll("button");
  for (const button of buttons) {
    if (button.hasAttribute(BUTTON_ATTR)) continue;
    if (hasClassSuffix(button, "_newSession")) return button;
  }
  return null;
}
function findSidebarRoot(button) {
  let element = button.parentElement;
  while (element !== null && element !== document.body) {
    if (Array.from(element.children).some((child) => hasClassSuffix(child, "_logoRow"))) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}
function glyph(size) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.3");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.style.display = "block";
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M2.5 3.5h11v7.5h-6l-3 2.5v-2.5h-2z");
  svg.appendChild(path);
  return svg;
}
function cloneHeaderButton(shell, label) {
  const button = shell.cloneNode(true);
  button.setAttribute(BUTTON_ATTR, "");
  button.setAttribute("aria-label", label);
  button.removeAttribute("aria-keyshortcuts");
  const parts = Array.from(button.querySelectorAll("span"));
  const shortcut = parts.find((part) => hasClassSuffix(part, "_newSessionShortcut"));
  if (shortcut !== void 0) shortcut.remove();
  const text = parts.find((part) => hasClassSuffix(part, "_newSessionLabel"));
  if (text !== void 0) text.textContent = label;
  const icon = button.querySelector("svg");
  if (icon !== null) icon.replaceWith(glyph(14));
  return button;
}
function mountHeaderButton(ctx, t) {
  if (document.querySelector(`style[${STYLE_ATTR}]`) === null) {
    const style = document.createElement("style");
    style.setAttribute(STYLE_ATTR, "");
    style.textContent = "[" + ROOT_ATTR + "]{position:relative}." + BUTTON_MARK + "{position:absolute;margin:0;z-index:1}." + BUTTON_MARK + ":focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}";
    document.head.appendChild(style);
  }
  let shell = null;
  let root = null;
  let button = null;
  let frame = 0;
  let rootObserver = null;
  let resizeObserver = null;
  let bodyObserver = null;
  const schedule = () => {
    if (frame !== 0) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  const onActivate = (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      ctx.layout.selectPanel(PANEL_ID);
    } catch (error) {
      console.error("[dsh-hello-word] cannot select the workbench panel", error);
    }
  };
  const observe = () => {
    if (root === null || shell === null) return;
    if (rootObserver !== null) rootObserver.disconnect();
    rootObserver = new MutationObserver(schedule);
    rootObserver.observe(root, { attributes: true, attributeFilter: ["class"] });
    if (resizeObserver !== null) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);
    resizeObserver.observe(shell);
  };
  const removeButton = () => {
    if (button === null) return;
    button.removeEventListener("click", onActivate);
    if (button.parentNode !== null) button.parentNode.removeChild(button);
    button = null;
  };
  const update = () => {
    const nextShell = findHeaderButton();
    if (nextShell === null) return;
    if (nextShell !== shell) {
      removeButton();
      shell = nextShell;
      root = findSidebarRoot(shell);
      if (root === null) {
        shell = null;
        return;
      }
      root.setAttribute(ROOT_ATTR, "");
      observe();
    }
    if (shell === null || root === null) return;
    if (!shell.isConnected || !root.isConnected) return;
    if (!root.hasAttribute(ROOT_ATTR)) root.setAttribute(ROOT_ATTR, "");
    const label = t("menu.label");
    const collapsed = hasClassSuffix(root, "_collapsed") || hasClassSuffix(root, "_fading");
    if (collapsed) {
      if (button !== null) button.style.display = "none";
      shell.style.removeProperty("width");
      return;
    }
    let target = button;
    if (target === null || !target.isConnected) {
      removeButton();
      target = cloneHeaderButton(shell, label);
      target.classList.add(BUTTON_MARK);
      target.addEventListener("click", onActivate);
      root.appendChild(target);
      button = target;
    } else {
      const text = Array.from(target.querySelectorAll("span")).find(
        (part) => hasClassSuffix(part, "_newSessionLabel")
      );
      if (text !== void 0 && text.textContent !== label) text.textContent = label;
      target.setAttribute("aria-label", label);
    }
    const rootStyle = getComputedStyle(root);
    const padLeft = parseFloat(rootStyle.paddingLeft) || 0;
    const padRight = parseFloat(rootStyle.paddingRight) || 0;
    const contentWidth = root.clientWidth - padLeft - padRight;
    const shellStyle = getComputedStyle(shell);
    const marginLeft = parseFloat(shellStyle.marginLeft) || 0;
    const marginRight = parseFloat(shellStyle.marginRight) || 0;
    const half = Math.max(60, (contentWidth - marginLeft - marginRight - GAP_PX) / 2);
    shell.style.width = half + "px";
    const shellRect = shell.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    target.style.position = "absolute";
    target.style.margin = "0";
    target.style.display = "";
    target.style.width = half + "px";
    target.style.height = shellRect.height + "px";
    target.style.left = shellRect.right - rootRect.left + GAP_PX + "px";
    target.style.top = shellRect.top - rootRect.top + "px";
  };
  bodyObserver = new MutationObserver(() => {
    if (shell !== null && shell.isConnected && root !== null && root.isConnected && button !== null && button.isConnected) {
      return;
    }
    schedule();
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  schedule();
  return () => {
    if (frame !== 0) window.cancelAnimationFrame(frame);
    if (rootObserver !== null) rootObserver.disconnect();
    if (resizeObserver !== null) resizeObserver.disconnect();
    if (bodyObserver !== null) bodyObserver.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    removeButton();
    if (shell !== null) shell.style.removeProperty("width");
    if (root !== null) root.removeAttribute(ROOT_ATTR);
    const style = document.querySelector(`style[${STYLE_ATTR}]`);
    if (style !== null) style.remove();
  };
}

// src/client/index.ts
var NS = "workbench";
var zh = {
  "menu.label": "工作台",
  "empty.hint": "还没有工作台",
  "empty.sub": "创建你的第一个工作台，沉淀任务、资料与工作流。",
  "empty.action": "创建工作台",
  "dialog.title": "创建工作台",
  "dialog.sub": "给它起个名字，之后再配置子面板与版面。",
  "dialog.nameLabel": "工作台名称",
  "dialog.namePlaceholder": "例如：我的工作台",
  "dialog.cancel": "取消",
  "dialog.create": "创建",
  "dialog.creating": "创建中…",
  "dialog.idLabel": "工作台 id（自动生成，只读）",
  "dialog.idPlaceholder": "输入名称后自动生成",
  "dialog.idHint": "id 也是文件夹名，创建后不可修改；可以复制给 AI 使用。",
  "dialog.copy": "复制",
  "dialog.copied": "已复制",
  "created.hint": "当前工作台",
  "created.action": "新建工作台",
  "root.title": "设置工作台根目录",
  "root.sub": "工作台的索引与每个工作台的 JSON 都会写在这个文件夹里。",
  "root.label": "根目录路径",
  "root.placeholder": "例如：D:\\work\\my-workbenches",
  "root.save": "保存并继续",
  "root.saving": "校验中…",
  "root.needPath": "请先填写文件夹路径",
  "root.change": "更换根目录",
  "root.cancel": "取消",
  "list.loading": "正在读取…",
  "list.refresh": "刷新",
  "list.retry": "重试",
  "list.empty.title": "还没有工作台",
  "list.empty.sub": "这个根目录里暂时没有工作台。可以让 AI 在根目录放一个 <id>/<id>.json，或点「新建工作台」创建。",
  "list.empty.action": "新建工作台",
  "bar.new": "新建工作台",
  "list.status.external": "外部新建",
  "list.status.missing": "缺失",
  "list.status.corrupt": "损坏",
  "scene.back": "返回列表",
  "scene.refresh": "刷新",
  "scene.opening": "正在打开…",
  "scene.colsUnit": "列",
  "scene.panelsUnit": "个子面板",
  "scene.error.title": "打开工作台失败",
  "save.saving": "保存中…",
  "save.saved": "已保存",
  "save.pending": "待保存",
  "save.errorPrefix": "保存失败：",
  "save.retry": "重试",
  "drawer.title": "配置",
  "drawer.show": "配置",
  "drawer.hide": "收起配置",
  "drawer.close": "收起",
  "drawer.workbench": "工作台",
  "drawer.name": "名称",
  "drawer.namePlaceholder": "例如：我的工作台",
  "drawer.description": "描述",
  "drawer.descriptionPlaceholder": "这个工作台是做什么的",
  "drawer.cols": "列数",
  "drawer.id": "id（创建后只读）",
  "drawer.copy": "复制",
  "drawer.copied": "已复制",
  "drawer.panels": "子面板",
  "drawer.noPanels": "还没有子面板。",
  "drawer.panelProps": "子面板属性",
  "drawer.selectPanelHint": "在下面的列表里选择一个子面板来编辑它的属性。",
  "drawer.add": "添加子面板",
  "drawer.moveUp": "上移",
  "drawer.moveDown": "下移",
  "drawer.delete": "删除",
  "drawer.deleteConfirm": "确认删除？",
  "drawer.confirm": "确认",
  "drawer.cancel": "取消",
  "panel.untitled": "未命名",
  "panel.title": "标题",
  "panel.titlePlaceholder": "显示在子面板顶部的标题",
  "panel.sub": "副标题",
  "panel.subPlaceholder": "可选的一行补充说明",
  "panel.type": "类型",
  "panel.type.reserved": "占位",
  "panel.type.harness": "会话门牌",
  "panel.layout": "位置与跨度",
  "panel.layoutHint": "留空表示自动排列；坐标从 1 开始。",
  "panel.col": "起始列",
  "panel.row": "起始行",
  "panel.w": "跨列",
  "panel.h": "跨行",
  "panel.text": "占位文本",
  "panel.textPlaceholder": "占位面板里显示的文字",
  "panel.sessionTitle": "会话标题",
  "panel.sessionTitlePlaceholder": "显示在门牌上的标题",
  "panel.sessionId": "会话 id",
  "panel.sessionIdPlaceholder": "要打开的会话",
  "panel.pinTarget": "定位目标",
  "panel.pinTargetPlaceholder": "多个用逗号分隔",
  "panel.unknownFields": "这个类型没有内置编辑器；它的未知字段会原样保存。",
  "panel.new.reserved": "占位面板",
  "panel.new.harness": "会话门牌",
  "panel.empty": "这个工作台还没有子面板。在工作台 JSON 的 panels 里加一个，再点「刷新」。",
  "panel.unknown": "未知面板类型",
  "panel.outOfBounds": "坐标越界",
  "panel.reserved.placeholder": "占位面板，内容待补充",
  "error.title": "读取失败",
  "error.connection": "连接服务不可用，请稍后重试"
};
var en = {
  "menu.label": "Workbench",
  "empty.hint": "No workbench yet",
  "empty.sub": "Create your first workbench to keep tasks, files and flows together.",
  "empty.action": "Create workbench",
  "dialog.title": "Create workbench",
  "dialog.sub": "Name it first — configure panels and layout next.",
  "dialog.nameLabel": "Workbench name",
  "dialog.namePlaceholder": "e.g. My workbench",
  "dialog.cancel": "Cancel",
  "dialog.create": "Create",
  "dialog.creating": "Creating…",
  "dialog.idLabel": "Workbench id (auto-generated, read-only)",
  "dialog.idPlaceholder": "Generated from the name",
  "dialog.idHint": "The id is also the folder name and cannot change after creation; copy it to an AI.",
  "dialog.copy": "Copy",
  "dialog.copied": "Copied",
  "created.hint": "Current workbench",
  "created.action": "New workbench",
  "root.title": "Set the workbench root folder",
  "root.sub": "The index and every workbench JSON will be written into this folder.",
  "root.label": "Root folder path",
  "root.placeholder": "e.g. D:\\work\\my-workbenches",
  "root.save": "Save and continue",
  "root.saving": "Checking…",
  "root.needPath": "Enter a folder path first",
  "root.change": "Change root",
  "root.cancel": "Cancel",
  "list.loading": "Loading…",
  "list.refresh": "Refresh",
  "list.retry": "Retry",
  "list.empty.title": "No workbench yet",
  "list.empty.sub": "This root has no workbench yet. Ask an AI to drop an <id>/<id>.json here, or click “New workbench”.",
  "list.empty.action": "New workbench",
  "bar.new": "New workbench",
  "list.status.external": "New on disk",
  "list.status.missing": "Missing",
  "list.status.corrupt": "Corrupt",
  "scene.back": "Back to list",
  "scene.refresh": "Refresh",
  "scene.opening": "Opening…",
  "scene.colsUnit": "columns",
  "scene.panelsUnit": "panels",
  "scene.error.title": "Could not open the workbench",
  "save.saving": "Saving…",
  "save.saved": "Saved",
  "save.pending": "Unsaved",
  "save.errorPrefix": "Save failed: ",
  "save.retry": "Retry",
  "drawer.title": "Settings",
  "drawer.show": "Settings",
  "drawer.hide": "Hide settings",
  "drawer.close": "Hide",
  "drawer.workbench": "Workbench",
  "drawer.name": "Name",
  "drawer.namePlaceholder": "e.g. My workbench",
  "drawer.description": "Description",
  "drawer.descriptionPlaceholder": "What this workbench is for",
  "drawer.cols": "Columns",
  "drawer.id": "id (read-only after creation)",
  "drawer.copy": "Copy",
  "drawer.copied": "Copied",
  "drawer.panels": "Panels",
  "drawer.noPanels": "No panel yet.",
  "drawer.panelProps": "Panel properties",
  "drawer.selectPanelHint": "Pick a panel in the list below to edit its properties.",
  "drawer.add": "Add panel",
  "drawer.moveUp": "Move up",
  "drawer.moveDown": "Move down",
  "drawer.delete": "Delete",
  "drawer.deleteConfirm": "Delete?",
  "drawer.confirm": "Confirm",
  "drawer.cancel": "Cancel",
  "panel.untitled": "Untitled",
  "panel.title": "Title",
  "panel.titlePlaceholder": "Shown in the panel header",
  "panel.sub": "Subtitle",
  "panel.subPlaceholder": "Optional one-line note",
  "panel.type": "Type",
  "panel.type.reserved": "Placeholder",
  "panel.type.harness": "Session badge",
  "panel.layout": "Position and span",
  "panel.layoutHint": "Empty means auto flow; coordinates are one-based.",
  "panel.col": "Start column",
  "panel.row": "Start row",
  "panel.w": "Column span",
  "panel.h": "Row span",
  "panel.text": "Placeholder text",
  "panel.textPlaceholder": "Text shown in the placeholder panel",
  "panel.sessionTitle": "Session title",
  "panel.sessionTitlePlaceholder": "Title shown on the badge",
  "panel.sessionId": "Session id",
  "panel.sessionIdPlaceholder": "Session to open",
  "panel.pinTarget": "Pin targets",
  "panel.pinTargetPlaceholder": "Comma-separated",
  "panel.unknownFields": "This type has no built-in editor; its unknown fields are saved as-is.",
  "panel.new.reserved": "Placeholder",
  "panel.new.harness": "Session badge",
  "panel.empty": "This workbench has no panel yet. Add one to panels in the workbench JSON, then hit Refresh.",
  "panel.unknown": "Unknown panel type",
  "panel.outOfBounds": "Out of bounds",
  "panel.reserved.placeholder": "Placeholder panel — content to come later",
  "error.title": "Could not load",
  "error.connection": "The connection service is unavailable; try again shortly"
};
var name = "dsh-hello-word";
var inject = ["slots", "locale", "layout"];
function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "workbench: dictionaries");
  const rpc = createWorkbenchClient(ctx);
  const panel = (props) => React10.createElement(HelloPanel, { ...props, t: props.t ?? t, rpc });
  ctx.slots.inject(
    "main",
    () => ctx.slots.register(
      { name: "main", key: PANEL_ID, locale: NS },
      panel
    )
  );
  ctx.effect(() => mountHeaderButton(ctx, t), "workbench: sidebar header button");
}

    return module.exports;
  },
});
