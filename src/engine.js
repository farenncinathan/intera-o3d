import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cylinderAngle, pistonPosition, valveLift, cycleAt, CYCLES } from './mechanics.js';
import { categoryById } from './data.js';
import { buildEngine } from './model.js';
import { CRANK_Y, BANK_TILTS, pistonPin, crankPin, rodRotationX } from './assembly.js';

const geometryCache = new Map();
function cached(key, create) { if (!geometryCache.has(key)) geometryCache.set(key, create()); return geometryCache.get(key); }
function box(w, h, d) { return cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)); }
function cylinder(r, h, r2 = r, segments = 24) { return cached(`c${r},${h},${r2},${segments}`, () => new THREE.CylinderGeometry(r, r2, h, segments)); }
function torus(r, t) { return cached(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 8, 32)); }
function roundedBox(w, h, d, radius = 0.1) {
  radius = Math.min(radius, w * 0.45, h * 0.45, d * 0.45);
  return cached(`r${w},${h},${d},${radius}`, () => {
    const x = -w / 2, y = -h / 2, s = new THREE.Shape();
    s.moveTo(x + radius, y); s.lineTo(x + w - radius, y);
    s.quadraticCurveTo(x + w, y, x + w, y + radius); s.lineTo(x + w, y + h - radius);
    s.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); s.lineTo(x + radius, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - radius); s.lineTo(x, y + radius);
    s.quadraticCurveTo(x, y, x + radius, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - radius, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: radius / 2, bevelThickness: radius / 2, curveSegments: 6 });
    g.translate(0, 0, -(d - radius) / 2); return g;
  });
}
function mesh(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, material); m.position.set(...pos); m.rotation.set(...rot); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function pipe(parent, points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(parent, new THREE.TubeGeometry(curve, 28, radius, 8, false), mat);
}
function bolt(parent, mat, p, rot = [0, 0, 0]) { return mesh(parent, cylinder(0.047, 0.035, 0.047, 6), mat, p, rot); }
function ring(parent, outer, inner, height, mat, pos, rot = [0, 0, 0]) {
  const key = `ring${outer},${inner},${height}`;
  const geo = cached(key, () => new THREE.LatheGeometry([
    new THREE.Vector2(inner, -height / 2), new THREE.Vector2(outer, -height / 2),
    new THREE.Vector2(outer, height / 2), new THREE.Vector2(inner, height / 2), new THREE.Vector2(inner, -height / 2),
  ], 32));
  return mesh(parent, geo, mat, pos, rot);
}
function surfaceTexture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'); let seed = 73;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  if (kind === 'carbon') {
    ctx.fillStyle = '#202326'; ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) {
      const alternate = ((x + y) / 8) % 2;
      for (let k = 0; k < 4; k++) { ctx.fillStyle = `rgb(${alternate ? 36 + k * 4 : 22 + k * 3},${alternate ? 38 + k * 4 : 24 + k * 3},${alternate ? 40 + k * 4 : 26 + k * 3})`; ctx.fillRect(x + (alternate ? 0 : k * 2), y + (alternate ? k * 2 : 0), alternate ? 8 : 1, alternate ? 1 : 8); }
    }
  } else {
    const image = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const value = kind === 'brush' ? 140 + Math.sin(y * 27) * 12 + random() * 12 : 140 + random() * 60; const i = (y * 128 + x) * 4; image.data[i] = image.data[i + 1] = image.data[i + 2] = value; image.data[i + 3] = 255; }
    ctx.putImageData(image, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(kind === 'carbon' ? 5 : 2, kind === 'carbon' ? 2 : 3); return texture;
}
const crankY = CRANK_Y;
const bankTilt = BANK_TILTS;
const axis = bank => new THREE.Vector3(0, Math.cos(bankTilt[bank]), Math.sin(bankTilt[bank]));

export class EngineViewer {
  constructor(container, labelsContainer, callbacks) {
    this.container = container; this.labelsContainer = labelsContainer; this.callbacks = callbacks;
    this.parts = []; this.partsById = new Map(); this.pickables = []; this.pistons = []; this.rods = []; this.valves = []; this.cams = []; this.fans = []; this.wheels = [];
    this.explosion = 0; this.targetExplosion = 0; this.selected = null; this.hovered = null; this.transparent = false; this.isolated = false; this.labelsVisible = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    this.defaultCamera = new THREE.Vector3(7.2, 4.6, 8.2); this.defaultTarget = new THREE.Vector3(0, 0.85, 0);
    this.camera.position.copy(this.defaultCamera);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.88;
    this.renderer.domElement.setAttribute('aria-label', 'Modelo 3D interativo de um motor V12. Arraste para girar e use a lista de componentes para selecionar peças.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.dataset.testid = 'engine-canvas';
    container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.defaultTarget); this.controls.enableDamping = true; this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false; this.controls.minDistance = 3; this.controls.maxDistance = 22;
    this.controls.minPolarAngle = 0.12; this.controls.maxPolarAngle = Math.PI * 0.87;
    this.controls.addEventListener('start', () => { this.cameraTween = null; });
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(); this.envTarget = pmrem.fromScene(room, 0.04); this.scene.environment = this.envTarget.texture; room.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x28202b, 1.1));
    const key = new THREE.DirectionalLight(0xfff5e9, 2.9); key.position.set(4, 10, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 8, bottom: -6 }); key.shadow.bias = -0.001; key.shadow.normalBias = 0.025; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb9d3ff, 2.3); rim.position.set(-6, 4, -4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffbb9c, 1.1); fill.position.set(-1, 1, 8); this.scene.add(fill);
    const floor = mesh(this.scene, new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.22 }), [0, -2.55, 0], [-Math.PI / 2, 0, 0]); floor.castShadow = false;
    const grid = new THREE.GridHelper(20, 40, 0x4c4d50, 0x36373a); grid.position.y = -2.56; grid.material.transparent = true; grid.material.opacity = 0.11; this.scene.add(grid);
    const grain = surfaceTexture('cast'), brush = surfaceTexture('brush'), carbon = surfaceTexture('carbon');
    carbon.colorSpace = THREE.SRGBColorSpace;
    this.materials = {
      red: new THREE.MeshPhysicalMaterial({ color: 0x8f0815, metalness: 0.45, roughness: 0.31, clearcoat: .65, clearcoatRoughness: .24, bumpMap: grain, bumpScale: .003 }),
      brightRed: new THREE.MeshPhysicalMaterial({ color: 0xb10b18, metalness: 0.4, roughness: 0.27, clearcoat: .8, clearcoatRoughness: .2, bumpMap: grain, bumpScale: .003 }),
      silver: new THREE.MeshStandardMaterial({ color: 0x919ca5, metalness: 0.88, roughness: 0.33, bumpMap: grain, bumpScale: .003 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x525d68, metalness: 0.92, roughness: 0.25, bumpMap: brush, bumpScale: .003 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x191d22, metalness: 0.72, roughness: 0.36 }),
      black: new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0.35, roughness: 0.55 }),
      carbon: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: carbon, metalness: .3, roughness: .38, clearcoat: .65, bumpMap: carbon, bumpScale: .015 }),
      polished: new THREE.MeshStandardMaterial({ color: 0xbcc4cd, metalness: 1, roughness: .18, bumpMap: brush, bumpScale: .002 }),
      ceramic: new THREE.MeshStandardMaterial({ color: 0xddd7c7, metalness: 0, roughness: .28 }),
      hot: new THREE.MeshStandardMaterial({ color: 0x504840, metalness: .65, roughness: .8, bumpMap: grain, bumpScale: .025 }),
      exhaust: new THREE.MeshStandardMaterial({ color: 0x8c877c, metalness: .95, roughness: .26, bumpMap: brush, bumpScale: .004 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xba9150, metalness: 0.8, roughness: 0.34 }),
    };
    this.build(); this.finishParts(); this.createGas(); this.createLabels(); this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize();
  }
  part(id, name, category, pos, spread = [0, 0, 0], options = {}) {
    const g = new THREE.Group(); g.position.set(...pos); this.scene.add(g);
    const p = { id, name, category, group: g, home: new THREE.Vector3(...pos), spread: new THREE.Vector3(...spread), ...options };
    this.parts.push(p); this.partsById.set(id, p); return p;
  }
  build() { buildEngine(this, { mesh, box, roundedBox, cylinder, ring, torus, bolt, pipe }); }
  finishParts() {
    const mergeStatic = group => {
      group.updateWorldMatrix(true, true);
      const inverse = group.matrixWorld.clone().invert(), batches = new Map(), moving = [];
      function visit(child) {
        if (child.userData.animated) { moving.push(child); return; }
        if (child.isMesh) {
          const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
          geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld));
          if (!batches.has(child.material)) batches.set(child.material, []);
          batches.get(child.material).push(geometry);
        }
        for (const nested of child.children) visit(nested);
      }
      for (const child of group.children) visit(child);
      group.clear();
      for (const [material, geometries] of batches) {
        mesh(group, mergeGeometries(geometries, false), material);
        for (const source of geometries) source.dispose();
      }
      for (const child of moving) group.add(child);
    };
    for (const fan of this.fans) { mergeStatic(fan); fan.userData.animated = true; }
    for (const { wheel } of this.wheels) { mergeStatic(wheel); wheel.userData.animated = true; }
    for (const p of this.parts) {
      mergeStatic(p.group);
      const mats = new Map();
      p.group.traverse(child => {
        if (!child.isMesh) return;
        if (!mats.has(child.material)) {
          const clone = child.material.clone(); clone.userData.initialOpacity = clone.opacity; clone.userData.initialTransparent = clone.transparent; mats.set(child.material, clone);
        }
        child.material = mats.get(child.material); child.userData.partId = p.id; this.pickables.push(child);
      });
      p.materials = [...mats.values()];
    }
    this.container.dataset.partsCount = String(this.parts.length);
  }
  createGas() {
    this.gas = new THREE.Mesh(cylinder(0.25, 1), new THREE.MeshBasicMaterial({ color: 0x5ea7f2, transparent: true, opacity: 0.22, depthWrite: false }));
    this.gas.visible = false; this.scene.add(this.gas);
    this.spark = new THREE.PointLight(0xffaa55, 0, 2); this.scene.add(this.spark);
  }
  createLabels() {
    const ids = ['admissao-1', 'comando-0-intake', 'cabecote-1', 'pistao-1', 'virabrequim', 'turbo-1'];
    this.labels = ids.map(id => {
      const part = this.partsById.get(id), button = document.createElement('button');
      button.className = 'model-label'; button.textContent = categoryById[part.category].name;
      button.addEventListener('click', () => this.callbacks.select(id)); this.labelsContainer.append(button);
      return { button, part };
    });
  }
  bindPointer() {
    const canvas = this.renderer.domElement;
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); let down = null;
    canvas.addEventListener('pointerdown', event => { down = [event.clientX, event.clientY]; });
    canvas.addEventListener('pointerup', event => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) { down = null; return; }
      down = null; const id = this.hit(event); if (id) this.callbacks.select(id); else this.callbacks.select(null);
    });
    canvas.addEventListener('pointermove', event => {
      if (event.buttons) return;
      const id = this.hit(event); if (id !== this.hovered) { this.hovered = id; this.styleParts(); }
      this.container.style.cursor = id ? 'pointer' : 'grab';
      this.callbacks.hover(id, event.clientX, event.clientY);
    });
    canvas.addEventListener('pointerleave', () => { this.hovered = null; this.styleParts(); this.callbacks.hover(null); });
    canvas.addEventListener('dblclick', event => { const id = this.hit(event); if (id) { this.callbacks.select(id); this.focus(id); } });
  }
  hit(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.pickables, false);
    const hit = intersects.find(h => {
      const p = this.partsById.get(h.object.userData.partId);
      return p.group.visible && (!this.transparent || !p.shell || p.id === this.selected);
    });
    return hit?.object.userData.partId || null;
  }
  setSelection(id) { this.selected = id; this.hovered = null; this.styleParts(); }
  setTransparent(on) { this.transparent = on; this.styleParts(); }
  setIsolated(on) { this.isolated = on; this.styleParts(); if (on && this.selected) this.focus(this.selected); }
  styleParts() {
    for (const p of this.parts) {
      const active = p.id === this.selected, hover = !active && p.id === this.hovered;
      p.group.visible = !this.isolated || !this.selected || active;
      for (const mat of p.materials) {
        const shell = this.transparent && p.shell && !active;
        mat.opacity = shell ? 0.07 : 1;
        if (mat.transparent !== shell) { mat.transparent = shell; mat.needsUpdate = true; }
        mat.depthWrite = !shell;
        mat.emissive.set(active ? 0xe84d32 : hover ? 0xa85026 : 0x000000); mat.emissiveIntensity = active ? 0.3 : 0.15;
      }
    }
  }
  focus(id) {
    const part = this.partsById.get(id); if (!part) return;
    this.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(part.group), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const distance = Math.max(size.length() * 1.35, 2.5);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    this.cameraTween = { from: this.camera.position.clone(), to: center.clone().addScaledVector(direction, distance), targetFrom: this.controls.target.clone(), targetTo: center, progress: 0 };
  }
  setExplosion(value) {
    if (value !== this.targetExplosion) { this.targetExplosion = value; this.reset(); }
  }
  reset() {
    const direction = this.defaultCamera.clone().sub(this.defaultTarget);
    const target = this.defaultTarget.clone(); target.y += this.targetExplosion * 1.35;
    const camera = target.clone().addScaledVector(direction, (1 + this.targetExplosion * .46) * (this.fitFactor || 1));
    this.cameraTween = { from: this.camera.position.clone(), to: camera, targetFrom: this.controls.target.clone(), targetTo: target, progress: 0 };
  }
  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    const fit = window.innerWidth <= 600 ? 1.24 : 1;
    if (fit !== this.fitFactor) {
      const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(fit / (this.fitFactor || 1));
      this.camera.position.copy(this.controls.target).add(offset); this.fitFactor = fit;
      this.cameraTween = null;
    }
    this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  }
  project(id) {
    const p = this.partsById.get(id); if (!p) return null;
    const v = p.group.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v.y * 0.5 + 0.5) * this.container.clientHeight, visible: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
  }
  render(dt, angle, cycleCylinder = null) {
    this.explosion = THREE.MathUtils.damp(this.explosion, this.targetExplosion, 7, dt);
    const e = this.explosion;
    for (const p of this.parts) p.group.position.copy(p.home).addScaledVector(p.spread, e);
    this.crankPart.group.rotation.x = angle;
    for (const { part, number } of this.pistons) {
      part.group.position.set(...pistonPin(angle, number));
      part.group.position.addScaledVector(part.spread, e);
    }
    for (const { part, number } of this.rods) {
      part.group.position.set(...crankPin(angle, number)).addScaledVector(part.spread, e);
      part.group.rotation.set(rodRotationX(angle, number), 0, 0);
    }
    for (const { part, number, kind, bank } of this.valves) part.group.position.addScaledVector(axis(bank), -valveLift(cylinderAngle(angle, number), kind));
    for (let i = 0; i < this.cams.length; i++) this.cams[i].group.rotation.x = angle / 2;
    for (const fan of this.fans) fan.rotation.x = angle * 3;
    for (const { wheel, ratio } of this.wheels) wheel.rotation.x = angle * ratio;
    if (cycleCylinder && !this.isolated) {
      const b = cycleCylinder <= 6 ? 0 : 1, p = this.partsById.get(`pistao-${cycleCylinder}`);
      const a = cylinderAngle(angle, cycleCylinder), current = cycleAt(a), projection = pistonPosition(a), height = Math.max(2.20 - projection - 0.235, 0.045);
      this.gas.position.copy(p.group.position).addScaledVector(axis(b), 0.235 + height / 2);
      this.gas.rotation.x = bankTilt[b]; this.gas.scale.y = height; this.gas.material.color.set(CYCLES[current].color); this.gas.visible = true;
      this.spark.position.copy(this.gas.position); this.spark.intensity = current === 2 && a < Math.PI * 2.15 ? 2 : 0;
    } else { this.gas.visible = false; this.spark.intensity = 0; }
    if (this.cameraTween) {
      const tween = this.cameraTween; tween.progress = Math.min(tween.progress + dt * 1.6, 1); const t = tween.progress * tween.progress * (3 - 2 * tween.progress);
      this.camera.position.lerpVectors(tween.from, tween.to, t); this.controls.target.lerpVectors(tween.targetFrom, tween.targetTo, t);
      if (tween.progress === 1) this.cameraTween = null;
    }
    this.controls.update(); this.renderer.render(this.scene, this.camera);
    for (const { button, part } of this.labels) {
      const point = this.project(part.id); button.hidden = !this.labelsVisible || !part.group.visible || !point.visible;
      if (!button.hidden) button.style.transform = `translate(${point.x}px, ${point.y}px)`;
    }
  }
  dispose() { this.resizeObserver.disconnect(); this.controls.dispose(); this.renderer.dispose(); this.envTarget.dispose(); }
}
