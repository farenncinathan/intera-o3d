import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CRANK_RADIUS, ROD_LENGTH, cylinderAngle, pistonPosition, valveLift, cycleAt, CYCLES } from './mechanics.js';
import { categoryById } from './data.js';

const Y = new THREE.Vector3(0, 1, 0);
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
function deck() {
  const s = new THREE.Shape(); s.moveTo(-2.35, -0.55); s.lineTo(2.35, -0.55); s.lineTo(2.35, 0.55); s.lineTo(-2.35, 0.55); s.closePath();
  for (let i = 0; i < 6; i++) { const hole = new THREE.Path(); hole.absarc((i - 2.5) * 0.72, 0, 0.28, 0, Math.PI * 2, true); s.holes.push(hole); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.025, bevelThickness: 0.025, steps: 1, curveSegments: 24 });
  g.rotateX(-Math.PI / 2); g.translate(0, -0.14, 0); return g;
}
const deckGeo = deck();
const crankY = -0.65;
const bankTilt = [Math.PI / 6, -Math.PI / 6];
const bankSign = [1, -1];
const axis = bank => new THREE.Vector3(0, Math.cos(bankTilt[bank]), Math.sin(bankTilt[bank]));

export class EngineViewer {
  constructor(container, labelsContainer, callbacks) {
    this.container = container; this.labelsContainer = labelsContainer; this.callbacks = callbacks;
    this.parts = []; this.partsById = new Map(); this.pickables = []; this.pistons = []; this.rods = []; this.valves = []; this.cams = []; this.fans = []; this.wheels = [];
    this.explosion = 0.56; this.targetExplosion = 0.56; this.selected = null; this.hovered = null; this.transparent = false; this.isolated = false; this.labelsVisible = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    this.defaultCamera = new THREE.Vector3(9.1, 6.1, 10.1); this.defaultTarget = new THREE.Vector3(0, 1.3, 0);
    this.camera.position.copy(this.defaultCamera);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.95;
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
    const key = new THREE.DirectionalLight(0xfff5e9, 3.6); key.position.set(4, 10, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 8, bottom: -6 }); key.shadow.bias = -0.001; key.shadow.normalBias = 0.025; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb9d3ff, 2.3); rim.position.set(-6, 4, -4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffbb9c, 1.1); fill.position.set(-1, 1, 8); this.scene.add(fill);
    const floor = mesh(this.scene, new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.22 }), [0, -2.55, 0], [-Math.PI / 2, 0, 0]); floor.castShadow = false;
    const grid = new THREE.GridHelper(20, 40, 0x4c4d50, 0x36373a); grid.position.y = -2.56; grid.material.transparent = true; grid.material.opacity = 0.11; this.scene.add(grid);
    this.materials = {
      red: new THREE.MeshStandardMaterial({ color: 0x9e0c1b, metalness: 0.62, roughness: 0.29 }),
      brightRed: new THREE.MeshStandardMaterial({ color: 0xb51320, metalness: 0.5, roughness: 0.27 }),
      silver: new THREE.MeshStandardMaterial({ color: 0x919ca5, metalness: 0.92, roughness: 0.24 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x525d68, metalness: 0.93, roughness: 0.25 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x191d22, metalness: 0.72, roughness: 0.36 }),
      black: new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0.35, roughness: 0.55 }),
      carbon: new THREE.MeshStandardMaterial({ color: 0x252b2e, metalness: 0.65, roughness: 0.4 }),
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
  build() {
    const m = this.materials;
    // Cárter e bloco são componentes separados para seleção e desmontagem.
    const sump = this.part('carter', 'Cárter de óleo', 'sump', [0, -1.23, 0], [0, -1.05, 0]);
    mesh(sump.group, roundedBox(4.5, 0.6, 1.42), m.dark);
    mesh(sump.group, box(4.7, 0.08, 1.65), m.silver, [0, 0.32, 0]);
    for (let i = 0; i < 10; i++) { mesh(sump.group, box(0.045, 0.42, 1.45), m.steel, [(i - 4.5) * 0.4, 0, 0]); for (const z of [-0.73, 0.73]) bolt(sump.group, m.silver, [(i - 4.5) * 0.43, 0.37, z]); }
    const block = this.part('bloco', 'Bloco e camisas dos cilindros', 'block', [0, crankY, 0], [0, -0.1, 0], { shell: true });
    mesh(block.group, roundedBox(4.7, 0.82, 1.38), m.red, [0, 0.45, 0]);
    for (const b of [0, 1]) {
      const bank = new THREE.Group(); bank.rotation.x = bankTilt[b]; block.group.add(bank);
      mesh(bank, box(4.65, 0.13, 0.91), m.silver, [0, 1.79, 0]);
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 0.72;
        ring(bank, 0.345, 0.29, 1.05, m.silver, [x, 1.24, 0]);
        for (const s of [-1, 1]) { mesh(bank, box(0.57, 0.67, 0.055), m.red, [x, 1.13, s * 0.35]); bolt(bank, m.steel, [x, 1.86, s * 0.43]); }
      }
      mesh(bank, deckGeo, m.silver, [0, 1.85, 0]);
      for (let i = 0; i < 9; i++) mesh(bank, box(0.052, 0.72, 0.85), m.red, [(i - 4) * 0.53, 0.81, 0]);
    }
    // Manivelas ilustrativas para os doze cilindros.
    const crank = this.part('virabrequim', 'Virabrequim e contrapesos', 'crank', [0, crankY, 0], [0, -0.74, 0]);
    this.crankPart = crank;
    mesh(crank.group, cylinder(0.13, 5.3), m.steel, [0, 0, 0], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 12; i++) {
      const b = i < 6 ? 0 : 1, c = i % 6;
      const phase = cylinderAngle(0, i + 1) + bankTilt[b];
      const x = (c - 2.5) * 0.72 + (b === 0 ? -0.09 : 0.09);
      const y = CRANK_RADIUS * Math.cos(phase), z = CRANK_RADIUS * Math.sin(phase);
      mesh(crank.group, cylinder(0.105, 0.16), m.silver, [x, y, z], [0, 0, Math.PI / 2]);
      const web = mesh(crank.group, roundedBox(0.1, 0.72, 0.42, 0.1), m.steel, [x - 0.075, -y * 0.12, -z * 0.12]); web.rotation.x = phase;
    }
    for (const x of [-2.35, 2.35]) mesh(crank.group, cylinder(0.32, 0.14), m.silver, [x, 0, 0], [0, 0, Math.PI / 2]);
    // Os doze mecanismos biela-manivela compartilham a mesma referência angular.
    for (let i = 0; i < 12; i++) {
      const number = i + 1, b = i < 6 ? 0 : 1, c = i % 6, x = (c - 2.5) * 0.72 + (b === 0 ? -0.09 : 0.09);
      const piston = this.part(`pistao-${number}`, `Pistão ${String(number).padStart(2, '0')}`, 'pistons', [x, 0, 0], [0, 1.06, bankSign[b] * 0.15], { cylinder: number, bank: b });
      piston.group.rotation.x = bankTilt[b];
      mesh(piston.group, cylinder(0.275, 0.42), m.silver);
      mesh(piston.group, cylinder(0.266, 0.035), m.steel, [0, 0.225, 0]);
      for (const y of [0.13, 0.075, -0.07]) { const r = mesh(piston.group, torus(0.276, 0.012), m.dark, [0, y, 0]); r.rotation.x = Math.PI / 2; }
      mesh(piston.group, cylinder(0.072, 0.58), m.steel, [0, -0.06, 0], [Math.PI / 2, 0, 0]);
      for (const z of [-0.12, 0.12]) mesh(piston.group, cylinder(0.075, 0.006), m.dark, [0, 0.246, z]);
      this.pistons.push({ part: piston, number, bank: b, x });
      const rod = this.part(`biela-${number}`, `Biela ${String(number).padStart(2, '0')}`, 'rods', [x, crankY, 0], [0, 0.22, 0], { cylinder: number, bank: b });
      mesh(rod.group, box(0.095, ROD_LENGTH - 0.22, 0.13), m.silver, [0, ROD_LENGTH / 2, 0]);
      for (const z of [-0.075, 0.075]) mesh(rod.group, box(0.035, ROD_LENGTH - 0.28, 0.025), m.steel, [0, ROD_LENGTH / 2, z]);
      ring(rod.group, 0.16, 0.11, 0.13, m.silver, [0, 0, 0], [0, 0, Math.PI / 2]);
      ring(rod.group, 0.095, 0.055, 0.11, m.silver, [0, ROD_LENGTH, 0], [0, 0, Math.PI / 2]);
      for (const z of [-0.19, 0.19]) mesh(rod.group, cylinder(0.035, 0.16), m.steel, [0, 0.02, z]);
      this.rods.push({ part: rod, number, bank: b, x });
    }
    // Cabeçotes, válvulas, comandos e tampas das duas bancadas.
    const springCurve = new THREE.CatmullRomCurve3(Array.from({ length: 55 }, (_, k) => new THREE.Vector3(Math.cos(k / 54 * Math.PI * 10) * 0.064, k / 54 * 0.23, Math.sin(k / 54 * Math.PI * 10) * 0.064)));
    const springGeo = new THREE.TubeGeometry(springCurve, 54, 0.013, 5, false);
    for (const b of [0, 1]) {
      const sign = bankSign[b], dir = axis(b);
      const headPos = dir.clone().multiplyScalar(2.13); headPos.y += crankY;
      const head = this.part(`cabecote-${b + 1}`, `Cabeçote da bancada ${b === 0 ? 'A' : 'B'}`, 'heads', headPos.toArray(), [0, 1.13, sign * 0.26], { bank: b, shell: true });
      head.group.rotation.x = bankTilt[b]; mesh(head.group, deckGeo, m.silver);
      for (const z of [-0.51, 0.51]) mesh(head.group, roundedBox(4.62, 0.36, 0.1, 0.04), m.silver, [0, 0.05, z]);
      for (let c = 0; c < 6; c++) {
        const x = (c - 2.5) * 0.72;
        for (const z of [-0.58, 0.58]) { mesh(head.group, cylinder(0.17, 0.02), m.dark, [x, 0, z], [Math.PI / 2, 0, 0]); ring(head.group, 0.195, 0.16, 0.04, m.steel, [x, 0, z], [Math.PI / 2, 0, 0]); }
        for (const z of [-0.44, 0.44]) bolt(head.group, m.steel, [x, 0.23, z]);
        const number = b * 6 + c + 1;
        for (const kind of ['intake', 'exhaust']) for (let v = 0; v < 2; v++) {
          const z = kind === 'intake' ? -0.18 : 0.18;
          const local = new THREE.Vector3(x + (v === 0 ? -0.12 : 0.12), 2.25, z).applyAxisAngle(new THREE.Vector3(1, 0, 0), bankTilt[b]); local.y += crankY;
          const valve = this.part(`valvula-${number}-${kind}-${v + 1}`, `${kind === 'intake' ? 'Admissão' : 'Escape'} ${v + 1} · cilindro ${String(number).padStart(2, '0')}`, 'valves', local.toArray(), [0, 1.72, sign * 0.26], { cylinder: number, bank: b });
          valve.group.rotation.x = bankTilt[b];
          mesh(valve.group, cylinder(0.023, 0.47), m.silver, [0, 0.18, 0]);
          mesh(valve.group, cylinder(0.105, 0.038, 0.073), m.steel, [0, -0.065, 0]);
          mesh(valve.group, springGeo, m.steel, [0, 0.19, 0]);
          mesh(valve.group, cylinder(0.081, 0.027), m.silver, [0, 0.425, 0]);
          this.valves.push({ part: valve, number, kind, bank: b });
        }
      }
      for (const kind of ['intake', 'exhaust']) {
        const localZ = kind === 'intake' ? -0.23 : 0.23;
        const camPos = new THREE.Vector3(0, 2.79, localZ).applyAxisAngle(new THREE.Vector3(1, 0, 0), bankTilt[b]); camPos.y += crankY;
        const cam = this.part(`comando-${b}-${kind}`, `Comando de ${kind === 'intake' ? 'admissão' : 'escape'} · bancada ${b === 0 ? 'A' : 'B'}`, 'cams', camPos.toArray(), [0, 2.25, sign * 0.26], { bank: b });
        mesh(cam.group, cylinder(0.065, 4.85), m.steel, [0, 0, 0], [0, 0, Math.PI / 2]);
        for (let c = 0; c < 6; c++) for (const dx of [-0.12, 0.12]) {
          const lobe = mesh(cam.group, cylinder(0.12, 0.09), m.silver, [(c - 2.5) * 0.72 + dx, 0.055, 0], [0, 0, Math.PI / 2]); lobe.scale.z = 0.7;
        }
        for (let i = 0; i < 7; i++) mesh(cam.group, cylinder(0.093, 0.055), m.silver, [(i - 3) * 0.72, 0, 0], [0, 0, Math.PI / 2]);
        mesh(cam.group, cylinder(0.19, 0.09), m.steel, [2.55, 0, 0], [0, 0, Math.PI / 2]);
        this.cams.push(cam);
      }
      const coverPos = dir.clone().multiplyScalar(2.87); coverPos.y += crankY;
      const cover = this.part(`tampa-${b + 1}`, `Tampa de válvulas · bancada ${b === 0 ? 'A' : 'B'}`, 'covers', coverPos.toArray(), [0, 2.88, sign * 0.6], { bank: b, shell: true });
      cover.group.rotation.x = bankTilt[b];
      mesh(cover.group, roundedBox(4.72, 0.32, 1.04), m.red);
      mesh(cover.group, roundedBox(3.7, 0.035, 0.4, 0.035), m.carbon, [0, 0.19, 0]);
      for (let i = 0; i < 17; i++) mesh(cover.group, box(0.025, 0.007, 0.36), m.steel, [(i - 8) * 0.21, 0.214, 0]);
      for (let i = 0; i < 7; i++) for (const z of [-0.45, 0.45]) bolt(cover.group, m.silver, [(i - 3) * 0.66, 0.19, z]);
      // Plenums e borboletas de admissão.
      const intake = this.part(`admissao-${b + 1}`, `Plenum de admissão · bancada ${b === 0 ? 'A' : 'B'}`, 'intake', [0, 2.78, sign * 0.58], [0, 3.53, sign * 0.12], { bank: b, shell: true });
      mesh(intake.group, roundedBox(4.35, 0.44, 0.75), m.brightRed);
      mesh(intake.group, roundedBox(3.8, 0.03, 0.19, 0.025), m.carbon, [0, 0.25, 0]);
      for (const z of [-0.2, 0.2]) mesh(intake.group, box(3.45, 0.015, 0.025), m.silver, [0, 0.24, z]);
      for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.65; pipe(intake.group, [[x, -0.12, 0], [x, -0.38, 0], [x, -0.6, -sign * 0.2]], 0.11, m.silver); }
      for (const x of [-1.35, 1.35]) {
        ring(intake.group, 0.29, 0.22, 0.32, m.silver, [x, -0.01, sign * 0.45], [Math.PI / 2, 0, 0]);
        mesh(intake.group, cylinder(0.215, 0.012), m.brass, [x, -0.01, sign * 0.54], [Math.PI / 2, 0, 0]);
        mesh(intake.group, box(0.035, 0.43, 0.035), m.steel, [x, -0.01, sign * 0.59]);
      }
      // Coletores de escape conectados aos turbos laterais.
      const exhaust = this.part(`escape-${b + 1}`, `Coletor de escape · bancada ${b === 0 ? 'A' : 'B'}`, 'exhaust', [0, 0, 0], [0.22, 0.2, sign * 0.6], { bank: b });
      for (let c = 0; c < 6; c++) {
        const x = (c - 2.5) * 0.72;
        pipe(exhaust.group, [[x, 0.94, sign * 1.48], [x, 0.64, sign * 1.9], [x + 0.24, -0.12, sign * 2.04], [2.05, -0.2, sign * 1.95]], 0.105, m.steel);
      }
      const turbo = this.part(`turbo-${b + 1}`, `Turbocompressor ${b === 0 ? 'A' : 'B'}`, 'turbo', [2.3, 0.03, sign * 2.03], [0.25, 0.1, sign * 0.95], { bank: b });
      const housing = mesh(turbo.group, new THREE.TorusGeometry(0.37, 0.17, 14, 40, Math.PI * 1.85), m.silver, [0, 0, 0], [0, Math.PI / 2, 0]);
      housing.rotation.x = sign * 0.5;
      ring(turbo.group, 0.32, 0.23, 0.32, m.silver, [0.19, 0, 0], [0, 0, Math.PI / 2]);
      mesh(turbo.group, cylinder(0.226, 0.02), m.dark, [0.29, 0, 0], [0, 0, Math.PI / 2]);
      const fan = new THREE.Group(); fan.position.x = 0.32; turbo.group.add(fan);
      mesh(fan, cylinder(0.05, 0.07), m.silver, [0, 0, 0], [0, 0, Math.PI / 2]);
      for (let f = 0; f < 10; f++) { const a = f / 10 * Math.PI * 2; mesh(fan, box(0.025, 0.18, 0.032), m.silver, [0, Math.cos(a) * 0.12, Math.sin(a) * 0.12], [a, 0.35, 0]); }
      this.fans.push(fan);
      for (let k = 0; k < 8; k++) bolt(turbo.group, m.steel, [0.2, Math.cos(k / 8 * Math.PI * 2) * 0.42, Math.sin(k / 8 * Math.PI * 2) * 0.42], [0, 0, Math.PI / 2]);
      pipe(turbo.group, [[-0.1, -0.32, 0], [-0.15, -0.53, sign * 0.08], [-0.6, -0.63, sign * 0.2], [-1.5, -0.63, sign * 0.18]], 0.155, m.silver);
      pipe(turbo.group, [[0, 0.36, 0], [-0.15, 0.6, 0], [-0.5, 0.8, -sign * 0.16]], 0.13, m.silver);
    }
    const timing = this.part('distribuicao', 'Corrente e engrenagens de distribuição', 'timing', [2.58, 0, 0], [0.67, 0, 0]);
    const wheels = [[crankY, 0, 0.24, 1], [1.79, 1.25, 0.4, 0.5], [1.79, -1.25, 0.4, 0.5]];
    for (const [y, z, r, ratio] of wheels) {
      const wheel = new THREE.Group(); wheel.position.set(0, y, z); timing.group.add(wheel);
      mesh(wheel, cylinder(r, 0.1), m.dark, [0, 0, 0], [0, 0, Math.PI / 2]);
      ring(wheel, r * 0.87, r * 0.69, 0.13, m.silver, [0, 0, 0], [0, 0, Math.PI / 2]);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; mesh(wheel, box(0.13, 0.05, r * 1.5), m.steel, [0, 0, 0], [a, 0, 0]); }
      mesh(wheel, cylinder(0.065, 0.18), m.silver, [0, 0, 0], [0, 0, Math.PI / 2]); this.wheels.push({ wheel, ratio });
    }
    pipe(timing.group, [[0.05, -0.89, 0], [0.05, -0.43, -0.3], [0.05, 1.65, -1.64], [0.05, 2.15, -1.25], [0.05, 1.92, 0], [0.05, 2.15, 1.25], [0.05, 1.65, 1.64], [0.05, -0.43, 0.3], [0.05, -0.89, 0]], 0.035, m.steel);
  }
  finishParts() {
    for (const p of this.parts) {
      // Mesclar a geometria estática de cada peça reduz chamadas à GPU, sem
      // perder a seleção individual. Turbos e distribuição têm subpeças móveis.
      if (p.category !== 'turbo' && p.category !== 'timing') {
        p.group.updateWorldMatrix(true, true);
        const inverse = p.group.matrixWorld.clone().invert(), batches = new Map();
        p.group.traverse(child => {
          if (!child.isMesh) return;
          const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
          geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld));
          if (!batches.has(child.material)) batches.set(child.material, []);
          batches.get(child.material).push(geometry);
        });
        p.group.clear();
        for (const [material, geometries] of batches) {
          const geometry = mergeGeometries(geometries, false);
          mesh(p.group, geometry, material);
          for (const source of geometries) source.dispose();
        }
      }
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
        mat.opacity = shell ? 0.12 : 1; mat.transparent = shell; mat.depthWrite = !shell;
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
  reset() {
    this.cameraTween = { from: this.camera.position.clone(), to: this.defaultCamera.clone(), targetFrom: this.controls.target.clone(), targetTo: this.defaultTarget.clone(), progress: 0 };
  }
  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
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
    for (const { part, number, bank, x } of this.pistons) {
      const a = cylinderAngle(angle, number), projection = pistonPosition(a);
      part.group.position.copy(axis(bank).multiplyScalar(projection)); part.group.position.x = x; part.group.position.y += crankY;
      part.group.position.addScaledVector(part.spread, e);
    }
    for (const { part, number, bank, x } of this.rods) {
      const a = cylinderAngle(angle, number), tilt = bankTilt[bank];
      const pin = new THREE.Vector3(x, crankY + CRANK_RADIUS * Math.cos(a + tilt), CRANK_RADIUS * Math.sin(a + tilt));
      const wrist = axis(bank).multiplyScalar(pistonPosition(a)); wrist.x = x; wrist.y += crankY;
      part.group.position.copy(pin).addScaledVector(part.spread, e);
      part.group.quaternion.setFromUnitVectors(Y, wrist.sub(pin).normalize());
    }
    for (const { part, number, kind, bank } of this.valves) part.group.position.addScaledVector(axis(bank), -valveLift(cylinderAngle(angle, number), kind));
    for (let i = 0; i < this.cams.length; i++) this.cams[i].group.rotation.x = angle / 2 + i * Math.PI / 2;
    for (const fan of this.fans) fan.rotation.x = angle * 3;
    for (const { wheel, ratio } of this.wheels) wheel.rotation.x = angle * ratio;
    if (cycleCylinder && !this.isolated) {
      const b = cycleCylinder <= 6 ? 0 : 1, p = this.partsById.get(`pistao-${cycleCylinder}`);
      const a = cylinderAngle(angle, cycleCylinder), current = cycleAt(a), projection = pistonPosition(a), height = Math.max(2.17 - projection - 0.21, 0.045);
      this.gas.position.copy(p.group.position).addScaledVector(axis(b), 0.23 + height / 2);
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
