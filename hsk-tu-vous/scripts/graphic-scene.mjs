// Declarative drawings, not executable SVG/HTML. New teaching actions are data.
export const GRAPHIC_TYPES = ["g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon"];
export const GRAPHIC_COLORS = ["foreground", "muted", "secondary", "red", "gold", "teal", "none"];
const properties = ["x", "y", "rotate", "scale", "opacity"];
const geometry = {
  g: [], path: ["d"], circle: ["cx", "cy", "r"], ellipse: ["cx", "cy", "rx", "ry"],
  rect: ["x", "y", "width", "height", "rx", "ry"], line: ["x1", "y1", "x2", "y2"],
  polyline: ["points"], polygon: ["points"],
};
const paint = ["fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin"];
const ownKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
const object = value => value && typeof value === "object" && !Array.isArray(value);
const finite = value => typeof value === "number" && Number.isFinite(value);
const invalid = message => { throw Error("Graphic scene: " + message); };

export function validateGraphicScene(scene) {
  if (!object(scene) || !ownKeys(scene, ["width", "height", "nodes", "tracks"]) ||
      !finite(scene.width) || !finite(scene.height) || scene.width < 100 || scene.width > 1600 ||
      scene.height < 100 || scene.height > 1200 || !Array.isArray(scene.nodes) ||
      !scene.nodes.length || scene.nodes.length > 120 || !Array.isArray(scene.tracks) || scene.tracks.length > 40)
    invalid("expected a bounded canvas, 1–120 drawing nodes and up to 40 tracks");
  const nodes = new Map();
  let painted = 0;
  for (const node of scene.nodes) {
    if (!object(node) || !ownKeys(node, ["id", "parentId", "type", "attrs", ...properties]) ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(node.id ?? "") || nodes.has(node.id) ||
        !GRAPHIC_TYPES.includes(node.type) || !object(node.attrs) ||
        !ownKeys(node.attrs, [...geometry[node.type], ...paint]))
      invalid("unsupported/duplicate drawing node; text, scripts, images and external resources are not supported");
    if (node.parentId !== undefined && nodes.get(node.parentId)?.type !== "g")
      invalid("parent must be an earlier group; cycles and dangling groups are forbidden");
    for (const key of properties) {
      const value = node[key];
      if (value === undefined) continue;
      if (!finite(value) || Math.abs(value) > 3200 ||
          (key === "scale" && (value < 0.1 || value > 4)) ||
          (key === "opacity" && (value < 0 || value > 1))) invalid("invalid base transform " + key);
    }
    for (const [key, value] of Object.entries(node.attrs)) {
      if (["fill", "stroke"].includes(key)) {
        if (!GRAPHIC_COLORS.includes(value)) invalid("use a canonical color token");
      } else if (key === "d") {
        if (typeof value !== "string" || value.length > 6000 ||
            !/^\s*[Mm]/.test(value) || !/[LlHhVvCcSsQqTtAa]/.test(value) ||
            !/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(value)) invalid("invalid path geometry");
      } else if (key === "points") {
        if (typeof value !== "string" || value.length > 2000 || !/^[0-9+.,\s-]+$/.test(value) ||
            (value.match(/-?(?:\d*\.)?\d+/g)?.length ?? 0) < 4) invalid("invalid points");
      } else if (key === "strokeLinecap") {
        if (!["round", "butt", "square"].includes(value)) invalid("invalid line cap");
      } else if (key === "strokeLinejoin") {
        if (!["round", "bevel", "miter"].includes(value)) invalid("invalid line join");
      } else if (!finite(value) || Math.abs(value) > 3200 ||
          (["r", "rx", "ry", "width", "height", "strokeWidth"].includes(key) && value <= 0)) invalid("invalid geometry " + key);
    }
    const required = {path:["d"],circle:["r"],ellipse:["rx","ry"],rect:["width","height"],
      line:["x1","y1","x2","y2"],polyline:["points"],polygon:["points"],g:[]}[node.type];
    if (required.some(key => node.attrs[key] === undefined)) invalid("missing " + node.type + " geometry");
    nodes.set(node.id, node);
    if (node.type !== "g" && (node.attrs.fill && node.attrs.fill !== "none" ||
        node.attrs.stroke && node.attrs.stroke !== "none")) painted++;
  }
  if (!painted) invalid("a drawing must contain painted geometry");
  const targets = new Set();
  for (const track of scene.tracks) {
    if (!object(track) || !ownKeys(track, ["nodeId", "property", "keyframes", "loop"]) ||
        !nodes.has(track.nodeId) || !properties.includes(track.property) ||
        !Array.isArray(track.keyframes) || track.keyframes.length < 2 || track.keyframes.length > 12 ||
        (track.loop !== undefined && typeof track.loop !== "boolean")) invalid("invalid motion track");
    const target = track.nodeId + "/" + track.property;
    if (targets.has(target)) invalid("duplicate property track");
    targets.add(target);
    let previous = -1;
    for (const key of track.keyframes) {
      if (!object(key) || !ownKeys(key, ["atMs", "value"]) || !finite(key.atMs) ||
          key.atMs <= previous || key.atMs < 0 || key.atMs > 10000 || !finite(key.value) ||
          Math.abs(key.value) > 3200 ||
          (track.property === "opacity" && (key.value < 0 || key.value > 1)) ||
          (track.property === "scale" && (key.value < 0.1 || key.value > 4))) invalid("invalid keyframe");
      previous = key.atMs;
    }
    if (track.keyframes[0].atMs !== 0 || previous < 160 ||
        new Set(track.keyframes.map(key => key.value)).size < 2) invalid("motion must change after its spoken anchor");
    if (track.loop && (previous < 700 || ["opacity", "scale"].includes(track.property) ||
        track.keyframes[0].value !== track.keyframes.at(-1).value)) invalid("loops must be smooth, closed and non-flashing");
  }
  // A hidden group cannot satisfy the drawable-content requirement. Probe the
  // authored key poses, not a guessed scene duration or fabricated audio cue.
  const samples = new Set([0,500,...scene.tracks.flatMap(track => track.keyframes.map(key => key.atMs))]);
  const visible = [...samples].some(time => scene.nodes.some(node => {
    if (node.type === "g" || !(node.attrs.fill && node.attrs.fill !== "none" ||
        node.attrs.stroke && node.attrs.stroke !== "none")) return false;
    let opacity = 1, current = node;
    while (current) {
      opacity *= graphicNodeState(scene,current,time).opacity;
      current = nodes.get(current.parentId);
    }
    return opacity > 0.05;
  }));
  if (!visible) invalid("all authored geometry is hidden");
  return {nodeCount: scene.nodes.length, trackCount: scene.tracks.length};
}

export function graphicNodeState(scene, node, elapsedMs) {
  const state = {x:node.x ?? 0,y:node.y ?? 0,rotate:node.rotate ?? 0,scale:node.scale ?? 1,opacity:node.opacity ?? 1};
  for (const track of scene.tracks.filter(track => track.nodeId === node.id)) {
    const last = track.keyframes.at(-1);
    const time = track.loop ? Math.max(0, elapsedMs) % last.atMs : Math.min(last.atMs, Math.max(0, elapsedMs));
    const next = track.keyframes.findIndex(key => key.atMs >= time);
    if (next <= 0) state[track.property] = track.keyframes[0].value;
    else {
      const left = track.keyframes[next - 1], right = track.keyframes[next];
      const t = (time - left.atMs) / (right.atMs - left.atMs);
      const eased = t * t * (3 - 2 * t);
      state[track.property] = left.value + (right.value - left.value) * eased;
    }
  }
  return state;
}

/** Match what is drawn, excluding planning text and arbitrary node IDs. */
export function graphicFingerprint(scene) {
  const indexes = new Map(scene.nodes.map((node, index) => [node.id, index]));
  return {
    width: scene.width, height: scene.height,
    nodes: scene.nodes.map(node => ({type:node.type,x:node.x??0,y:node.y??0,
      rotate:node.rotate??0,scale:node.scale??1,opacity:node.opacity??1,
      parent:node.parentId === undefined ? null : indexes.get(node.parentId),
      attrs:Object.fromEntries(Object.entries(node.attrs).sort(([a],[b]) => a.localeCompare(b)))})),
    tracks:scene.tracks.map(track => ({node:indexes.get(track.nodeId),property:track.property,
      loop:!!track.loop,keyframes:track.keyframes.map(key=>({atMs:key.atMs,value:key.value}))}))
      .sort((left,right)=>left.node-right.node || left.property.localeCompare(right.property)),
  };
}
