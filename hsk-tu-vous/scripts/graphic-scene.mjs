// Declarative drawings, not executable SVG/HTML. New teaching actions are data.
export const GRAPHIC_TYPES = ["g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon"];
export const GRAPHIC_COLORS = ["foreground", "muted", "secondary", "red", "gold", "teal", "poolDeck", "poolWater", "poolRipple", "none"];
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

function pathBounds(data) {
  const tokens = data.match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?|[MmLlHhVvCcSsQqTtAaZz]/g) ?? [];
  const bounds = {minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  const add = (x,y) => {
    bounds.minX = Math.min(bounds.minX,x); bounds.maxX = Math.max(bounds.maxX,x);
    bounds.minY = Math.min(bounds.minY,y); bounds.maxY = Math.max(bounds.maxY,y);
  };
  const expand = (x,y,radius) => {
    bounds.minX=Math.min(bounds.minX,x-radius); bounds.maxX=Math.max(bounds.maxX,x+radius);
    bounds.minY=Math.min(bounds.minY,y-radius); bounds.maxY=Math.max(bounds.maxY,y+radius);
  };
  const arity = {M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7};
  let index=0, command="", x=0, y=0, subX=0, subY=0, cubicControl=null, quadControl=null, previous="";
  while (index<tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      command=tokens[index++];
      if (command.toUpperCase()==="Z") { x=subX;y=subY;add(x,y);previous=command;command="";continue; }
    }
    if (!command) invalid("path bounds could not be resolved");
    const upper=command.toUpperCase(), relative=command!==upper, count=arity[upper];
    if (!count || index+count>tokens.length || tokens.slice(index,index+count).some(token=>/^[A-Za-z]$/.test(token)))
      invalid("path bounds could not be resolved");
    const a=tokens.slice(index,index+count).map(Number); index+=count;
    const point=(dx,dy)=>relative?{x:x+dx,y:y+dy}:{x:dx,y:dy};
    if (upper==="M" || upper==="L" || upper==="T") {
      let p=point(a[0],a[1]);
      if (upper==="T") {
        const control=(previous.toUpperCase()==="Q"||previous.toUpperCase()==="T")&&quadControl
          ? {x:2*x-quadControl.x,y:2*y-quadControl.y}:{x,y};
        add(control.x,control.y); quadControl=control;
      } else { cubicControl=null;quadControl=null; }
      x=p.x;y=p.y;add(x,y);
      if(upper==="M"){subX=x;subY=y;command=relative?"l":"L";}
    } else if (upper==="H") {
      x=relative?x+a[0]:a[0];add(x,y);cubicControl=null;quadControl=null;
    } else if (upper==="V") {
      y=relative?y+a[0]:a[0];add(x,y);cubicControl=null;quadControl=null;
    } else if (upper==="C") {
      const origin={x,y};
      const c1=relative?{x:origin.x+a[0],y:origin.y+a[1]}:{x:a[0],y:a[1]};
      const c2=relative?{x:origin.x+a[2],y:origin.y+a[3]}:{x:a[2],y:a[3]};
      const end=relative?{x:origin.x+a[4],y:origin.y+a[5]}:{x:a[4],y:a[5]};
      add(c1.x,c1.y);add(c2.x,c2.y);add(end.x,end.y);x=end.x;y=end.y;cubicControl=c2;quadControl=null;
    } else if (upper==="S" || upper==="Q") {
      const origin={x,y};
      const first=upper==="S" && (previous.toUpperCase()==="C"||previous.toUpperCase()==="S") && cubicControl
        ? {x:2*x-cubicControl.x,y:2*y-cubicControl.y}
        : relative?{x:origin.x+a[0],y:origin.y+a[1]}:{x:a[0],y:a[1]};
      const endpointIndex=upper==="S"?2:2;
      const end=relative?{x:origin.x+a[endpointIndex],y:origin.y+a[endpointIndex+1]}:{x:a[endpointIndex],y:a[endpointIndex+1]};
      add(first.x,first.y);add(end.x,end.y);x=end.x;y=end.y;
      cubicControl=upper==="S"?{x:relative?origin.x+a[0]:a[0],y:relative?origin.y+a[1]:a[1]}:null;
      quadControl=upper==="Q"?first:null;
    } else if (upper==="A") {
      const origin={x,y};
      const end=relative?{x:origin.x+a[5],y:origin.y+a[6]}:{x:a[5],y:a[6]};
      const radius=Math.max(Math.abs(a[0]),Math.abs(a[1]),Math.hypot(end.x-origin.x,end.y-origin.y));
      add(origin.x,origin.y);add(end.x,end.y);
      if(radius>0)expand(origin.x,origin.y,radius*2);
      x=end.x;y=end.y;cubicControl=null;quadControl=null;
    }
    previous=upper;
  }
  return bounds;
}

function nodeGeometryBounds(node) {
  const a=node.attrs, bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  const add=(x,y)=>{bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y);};
  if(node.type==="g") return null;
  if(node.type==="path") Object.assign(bounds,pathBounds(a.d));
  else if(node.type==="circle"){add(a.cx??0,a.cy??0);bounds.minX-=a.r;bounds.maxX+=a.r;bounds.minY-=a.r;bounds.maxY+=a.r;}
  else if(node.type==="ellipse"){add(a.cx??0,a.cy??0);bounds.minX-=a.rx;bounds.maxX+=a.rx;bounds.minY-=a.ry;bounds.maxY+=a.ry;}
  else if(node.type==="rect"){add(a.x??0,a.y??0);add((a.x??0)+a.width,(a.y??0)+a.height);}
  else if(node.type==="line"){add(a.x1,a.y1);add(a.x2,a.y2);}
  else if(node.type==="polyline"||node.type==="polygon"){
    const coords=a.points.match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)?.map(Number)??[];
    for(let i=0;i+1<coords.length;i+=2)add(coords[i],coords[i+1]);
  }
  const strokeMargin=a.stroke&&a.stroke!=="none"?(a.strokeWidth??1)*(a.strokeLinejoin==="miter"?4:1):0;
  bounds.minX-=strokeMargin;bounds.maxX+=strokeMargin;bounds.minY-=strokeMargin;bounds.maxY+=strokeMargin;
  return bounds;
}

function transformedBounds(scene,node,bounds,nodes,time) {
  const points=[{x:bounds.minX,y:bounds.minY},{x:bounds.maxX,y:bounds.minY},
    {x:bounds.maxX,y:bounds.maxY},{x:bounds.minX,y:bounds.maxY}];
  let current=node;
  while(current){
    const state=graphicNodeState(scene,current,time),angle=state.rotate*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    for(const point of points){
      const sx=point.x*state.scale,sy=point.y*state.scale;
      point.x=state.x+sx*cos-sy*sin;point.y=state.y+sx*sin+sy*cos;
    }
    current=nodes.get(current.parentId);
  }
  return {minX:Math.min(...points.map(point=>point.x)),maxX:Math.max(...points.map(point=>point.x)),
    minY:Math.min(...points.map(point=>point.y)),maxY:Math.max(...points.map(point=>point.y))};
}

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
    if (node.type === "line" && (!node.attrs.stroke || node.attrs.stroke === "none"))
      invalid("line geometry requires a visible stroke; fill does not paint SVG lines");
    if (node.type === "line" && ((node.attrs.strokeWidth ?? 1) < 1 ||
        (node.attrs.x1 === node.attrs.x2 && node.attrs.y1 === node.attrs.y2)))
      invalid("line geometry needs a visible stroke width and nonzero length");
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
  // Check visible, painted geometry in the actual viewBox at every 30 fps
  // render sample plus authored key poses. Include nested group transforms.
  const lastTrackMs=Math.max(0,...scene.tracks.map(track=>track.keyframes.at(-1).atMs));
  const samples=new Set([0,500,...scene.tracks.flatMap(track=>track.keyframes.map(key=>key.atMs))]);
  for(let frame=0;frame<=Math.ceil(lastTrackMs*30/1000);frame++)samples.add(frame*1000/30);
  const visibleOnCanvas=[...samples].some(time=>scene.nodes.some(node=>{
    const hasFill=node.attrs.fill&&node.attrs.fill!=="none";
    const hasStroke=node.attrs.stroke&&node.attrs.stroke!=="none";
    if(node.type==="g"||(!hasFill&&!hasStroke))return false;
    let opacity=1,current=node;
    while(current){opacity*=graphicNodeState(scene,current,time).opacity;current=nodes.get(current.parentId);}
    if(opacity<=0.05)return false;
    const box=transformedBounds(scene,node,nodeGeometryBounds(node),nodes,time);
    return box.maxX>0&&box.minX<scene.width&&box.maxY>0&&box.minY<scene.height;
  }));
  if(!visibleOnCanvas)invalid("all painted geometry is hidden or outside the SVG viewBox");
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
