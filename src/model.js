import * as THREE from 'three';
import { ROD_LENGTH } from './mechanics.js';
import { CRANK_Y, BANK_TILTS, HEAD_BOTTOM, HEAD_TOP, HEAD_CENTER, CAM_HEIGHT, COVER_CENTER, bankPoint, cylinderX, crankPin, camProfilePoints, VALVE_HOME_HEIGHT, SPRING_SEAT_HEIGHT, SPRING_REST_LENGTH, FOLLOWER_TOP_HEIGHT, FOLLOWER_HEIGHT, FOLLOWER_RADIUS } from './assembly.js';

// Geometria em unidades didáticas. As peças que se encaixam usam as mesmas
// âncoras; apenas a vista explodida adiciona deslocamentos de desmontagem.
export function buildEngine(v, h) {
  const { mesh, box, roundedBox, cylinder, ring, torus, bolt, pipe } = h;
  const m = v.materials;
  v.connections = [];
  const vec = a => new THREE.Vector3(...a);
  // Rounded cast housings have a continuous rim and an open underside. Unlike
  // stacked solid boxes, they leave room for the rotating assembly inside.
  function plan(length, width, radius) {
    const x = length / 2, z = width / 2, s = new THREE.Shape();
    s.moveTo(-x + radius, -z); s.lineTo(x - radius, -z);
    s.quadraticCurveTo(x, -z, x, -z + radius); s.lineTo(x, z - radius);
    s.quadraticCurveTo(x, z, x - radius, z); s.lineTo(-x + radius, z);
    s.quadraticCurveTo(-x, z, -x, z - radius); s.lineTo(-x, -z + radius);
    s.quadraticCurveTo(-x, -z, -x + radius, -z); return s;
  }
  function slab(shape, height) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 12 });
    g.rotateX(-Math.PI / 2); return g;
  }
  function hollowCase(parent, length, width, bottom, top, wall, material, closedTop = true) {
    const outline = plan(length, width, .19);
    outline.holes.push(new THREE.Path(plan(length - wall * 2, width - wall * 2, .13).getPoints(12)));
    mesh(parent, slab(outline, top - bottom), material, [0, bottom, 0]);
    if (closedTop) mesh(parent, slab(plan(length, width, .19), wall), material, [0, top - wall, 0]);
  }
  function volute(parent, sign) {
    const positions = [], normals = [], uvs = [], indices = [], sections = 96, sides = 16;
    const end = Math.atan2(sign * .18, .39);
    for (let i = 0; i <= sections; i++) {
      const t = i / sections, a = end - Math.PI * 1.85 * (1 - t), r = .23 + (Math.hypot(.39, .18) - .23) * t;
      const tube = .075 + .075 * t;
      for (let j = 0; j <= sides; j++) {
        const f = j / sides * Math.PI * 2, u = Math.cos(f), w = Math.sin(f);
        positions.push(u * tube, Math.cos(a) * (r + w * tube), Math.sin(a) * (r + w * tube));
        normals.push(u, w * Math.cos(a), w * Math.sin(a));
        uvs.push(t, j / sides);
        if (i < sections && j < sides) { const k = i * (sides + 1) + j; indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.setIndex(indices);
    mesh(parent, g, m.silver);
  }
  function connect(label, a, pa, b, pb) { v.connections.push({ label, a: { id: a.id, point: pa }, b: { id: b.id, point: pb } }); }
  function local(p, world) { p.group.updateMatrixWorld(true); return p.group.worldToLocal(vec(world)).toArray(); }
  function flange(parent, center, radius, direction, material = m.silver) {
    const g = new THREE.Group(); g.position.set(...center); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec(direction).normalize()); parent.add(g);
    ring(g, radius + .045, radius, .055, material, [0, 0, 0]);
    for (let j = 0; j < 4; j++) bolt(g, m.steel, [Math.cos(j * Math.PI / 2) * (radius + .065), .034, Math.sin(j * Math.PI / 2) * (radius + .065)]);
  }
  function deck(bank, depth) {
    const shape = new THREE.Shape(); shape.moveTo(-2.38, -.57); shape.lineTo(2.38, -.57); shape.lineTo(2.38, .57); shape.lineTo(-2.38, .57); shape.closePath();
    for (let c = 0; c < 6; c++) { const hole = new THREE.Path(); hole.absarc(cylinderX(bank * 6 + c + 1), 0, .294, 0, Math.PI * 2, true); shape.holes.push(hole); }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 }); geometry.rotateX(-Math.PI / 2); geometry.translate(0, -depth / 2, 0); return geometry;
  }
  function bearingGeometry() {
    const shape = new THREE.Shape(); shape.moveTo(-.13, -.43); shape.lineTo(.13, -.43); shape.lineTo(.13, .12); shape.lineTo(-.13, .12); shape.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, .092, 0, Math.PI * 2, true); shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .11, bevelEnabled: false, curveSegments: 24 }); geometry.translate(0, 0, -.055); geometry.rotateY(Math.PI / 2); return geometry;
  }
  const bearing = bearingGeometry();
  const sump = v.part('carter', 'Cárter de óleo', 'sump', [0, -1.235, 0], [0, -1.1, 0]);
  hollowCase(sump.group, 4.58, 1.52, -.28, .28, .075, m.red, false);
  mesh(sump.group, slab(plan(4.58, 1.52, .19), .075), m.red, [0, -.28, 0]);
  const sumpRim = plan(4.8, 1.72, .19);
  sumpRim.holes.push(new THREE.Path(plan(4.4, 1.34, .13).getPoints(12)));
  mesh(sump.group, slab(sumpRim, .055), m.silver, [0, .25, 0]);
  for (let i = 0; i < 12; i++) { for (const z of [-.76, .76]) mesh(sump.group, roundedBox(.045, .38, .04, .018), m.red, [(i - 5.5) * .35, -.02, z]); for (const z of [-.79, .79]) bolt(sump.group, m.steel, [(i - 5.5) * .38, .3225, z]); }
  mesh(sump.group, cylinder(.16, .43), m.black, [-1.75, -.45, .35]);
  ring(sump.group, .165, .14, .04, m.polished, [-1.75, -.255, .35]);
  bolt(sump.group, m.brass, [1.8, -.29, .33]);
  const block = v.part('bloco', 'Bloco e camisas dos cilindros', 'block', [0, CRANK_Y, 0], [0, -.1, 0], { shell: true });
  for (const z of [-.8, .8]) mesh(block.group, roundedBox(4.6, .91, .1, .04), m.silver, [0, .175, z]);
  const endFace = new THREE.Shape(); endFace.moveTo(-.85, -.28); endFace.lineTo(.85, -.28); endFace.lineTo(.85, .63); endFace.lineTo(-.85, .63); endFace.closePath();
  const journal = new THREE.Path(); journal.absarc(0, 0, .19, 0, Math.PI * 2, true); endFace.holes.push(journal);
  const endGeometry = new THREE.ExtrudeGeometry(endFace, { depth: .1, bevelEnabled: false, curveSegments: 32 }); endGeometry.translate(0, 0, -.05); endGeometry.rotateY(Math.PI / 2);
  for (const x of [-2.35, 2.35]) mesh(block.group, endGeometry, m.silver, [x, 0, 0]);
  const sumpGasket = plan(4.78, 1.7, .19);
  sumpGasket.holes.push(new THREE.Path(plan(4.5, 1.42, .13).getPoints(12)));
  mesh(block.group, slab(sumpGasket, .025), m.black, [0, -.28, 0]);
  connect('Vedação cárter/bloco', sump, [0, .305, 0], block, [0, -.28, 0]);
  for (let c = 0; c < 7; c++) {
    const x = (c - 3) * .72;
    for (const z of [-.84, .84]) mesh(block.group, roundedBox(.12, .66, .12, .04), m.silver, [x, .12, z]);
    for (const z of [-.86, .86]) bolt(block.group, m.steel, [x, .14, z], [Math.PI / 2, 0, 0]);
  }
  const crank = v.part('virabrequim', 'Virabrequim e contrapesos', 'crank', [0, CRANK_Y, 0], [0, -.8, 0]); v.crankPart = crank;
  mesh(crank.group, cylinder(.125, 5.56), m.steel, [0, 0, 0], [0, 0, Math.PI / 2]);
  for (let n = 1; n <= 12; n++) {
    const [x, worldY, z] = crankPin(0, n), y = worldY - CRANK_Y;
    mesh(crank.group, cylinder(.108, .24), m.polished, [x, y, z], [0, 0, Math.PI / 2]);
    // As almas chegam ao munhão principal e à manivela, sem ressaltos flutuantes.
    for (const dx of [-.095, .095]) {
      const web = mesh(crank.group, roundedBox(.05, .59, .24, .022), m.steel, [x + dx, y * .5, z * .5]); web.rotation.x = Math.atan2(z, y);
      const weight = mesh(crank.group, cylinder(.27, .05, .27, 32), m.steel, [x + dx, -y * .4, -z * .4], [0, 0, Math.PI / 2]); weight.scale.z = .8;
    }
  }
  for (let i = 0; i < 7; i++) mesh(crank.group, cylinder(.18, .15), m.polished, [(i - 3) * .72, 0, 0], [0, 0, Math.PI / 2]);
  mesh(crank.group, cylinder(.64, .14), m.steel, [-2.61, 0, 0], [0, 0, Math.PI / 2]);
  ring(crank.group, .66, .6, .12, m.polished, [-2.61, 0, 0], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; bolt(crank.group, m.steel, [-2.69, Math.cos(a) * .49, Math.sin(a) * .49], [0, 0, Math.PI / 2]); }
  for (let n = 1; n <= 12; n++) {
    const b = n <= 6 ? 0 : 1, sign = b === 0 ? 1 : -1;
    const piston = v.part(`pistao-${n}`, `Pistão ${String(n).padStart(2, '0')}`, 'pistons', [cylinderX(n), 0, 0], [0, 1.06, sign * .15], { cylinder: n, bank: b }); piston.group.rotation.x = BANK_TILTS[b];
    ring(piston.group, .274, .225, .36, m.silver, [0, -.03, 0]);
    mesh(piston.group, cylinder(.274, .06), m.silver, [0, .18, 0]);
    mesh(piston.group, cylinder(.271, .025), m.polished, [0, .221, 0]);
    for (const y of [.13, .075, -.07]) { const r = mesh(piston.group, torus(.274, .009), m.steel, [0, y, 0]); r.rotation.x = Math.PI / 2; }
    // O pino está no centro do olhal superior e paralelo ao virabrequim.
    mesh(piston.group, cylinder(.057, .55), m.polished, [0, 0, 0], [0, 0, Math.PI / 2]);
    for (const z of [-.12, .12]) for (const x of [-.10, .10]) mesh(piston.group, cylinder(.061, .003), m.steel, [x, .235, z]);
    v.pistons.push({ part: piston, number: n, bank: b, x: cylinderX(n) });
    const rod = v.part(`biela-${n}`, `Biela ${String(n).padStart(2, '0')}`, 'rods', [cylinderX(n), CRANK_Y, 0], [0, .22, 0], { cylinder: n, bank: b });
    mesh(rod.group, roundedBox(.095, ROD_LENGTH - .2, .095, .035), m.silver, [0, ROD_LENGTH / 2, 0]);
    for (const x of [-.056, .056]) mesh(rod.group, roundedBox(.027, ROD_LENGTH - .2, .16, .01), m.steel, [x, ROD_LENGTH / 2, 0]);
    ring(rod.group, .157, .109, .13, m.silver, [0, 0, 0], [0, 0, Math.PI / 2]);
    ring(rod.group, .09, .057, .11, m.brass, [0, ROD_LENGTH, 0], [0, 0, Math.PI / 2]);
    for (const z of [-.15, .15]) mesh(rod.group, cylinder(.026, .16, .026, 6), m.polished, [0, -.03, z]);
    v.rods.push({ part: rod, number: n, bank: b, x: cylinderX(n) });
  }
  const springCurve = new THREE.CatmullRomCurve3(Array.from({ length: 65 }, (_, k) => new THREE.Vector3(Math.cos(k / 64 * Math.PI * 12) * .061, k / 64 * SPRING_REST_LENGTH, Math.sin(k / 64 * Math.PI * 12) * .061)));
  const springGeo = new THREE.TubeGeometry(springCurve, 64, .012, 6, false);
  const timing = v.part('distribuicao', 'Corrente e engrenagens de distribuição', 'timing', [2.72, 0, 0], [.75, 0, 0]);
  const wheelCenters = [[CRANK_Y, 0, .1025, 1]];
  for (const b of [0, 1]) {
    const sign = b === 0 ? 1 : -1;
    const bank = new THREE.Group(); bank.rotation.x = BANK_TILTS[b]; block.group.add(bank);
    for (const z of [-.49, .49]) mesh(bank, roundedBox(4.76, 1.25, .16, .06), m.red, [0, 1.47, z]);
    for (const x of [-2.33, 2.33]) mesh(bank, roundedBox(.16, 1.25, 1.08, .06), m.red, [x, 1.47, 0]);
    mesh(bank, deck(b, .18), m.silver, [0, HEAD_BOTTOM - .09, 0]);
    for (let c = 0; c < 6; c++) {
      const x = cylinderX(b * 6 + c + 1);
      ring(bank, .329, .291, 1.25, m.silver, [x, 1.405, 0]);
      for (const z of [-.59, .59]) {
        mesh(bank, roundedBox(.085, 1.1, .06, .02), m.red, [x, 1.43, z]);
        bolt(bank, m.steel, [x, HEAD_BOTTOM + .02, z * .85]);
        ring(bank, .11, .077, .032, m.polished, [x, 1.45, z * 1.015], [Math.PI / 2, 0, 0]);
        mesh(bank, cylinder(.077, .026), m.steel, [x, 1.45, z * 1.015], [Math.PI / 2, 0, 0]);
      }
    }
    const head = v.part(`cabecote-${b + 1}`, `Cabeçote da bancada ${b === 0 ? 'A' : 'B'}`, 'heads', bankPoint(b, 0, HEAD_CENTER), [0, 1.2, sign * .26], { bank: b, shell: true }); head.group.rotation.x = BANK_TILTS[b];
    mesh(head.group, deck(b, HEAD_TOP - HEAD_BOTTOM), m.silver);
    mesh(head.group, deck(b, .014), m.black, [0, -(HEAD_TOP - HEAD_BOTTOM) / 2 + .004, 0]);
    connect(`Junta cabeçote ${b}`, block, local(block, bankPoint(b, 0, HEAD_BOTTOM)), head, [0, HEAD_BOTTOM - HEAD_CENTER, 0]);
    for (const z of [-.57, .57]) {
      mesh(head.group, roundedBox(4.78, .4, .06, .025), m.silver, [0, 0, z]);
      for (const y of [-.13, -.04, .05]) mesh(head.group, box(4.5, .025, .03), m.dark, [0, y, z * 1.065]);
    }
    for (let c = 0; c < 6; c++) {
      const n = b * 6 + c + 1, x = cylinderX(n);
      for (const z of [-.61, .61]) { ring(head.group, .156, .115, .09, m.silver, [x, 0, z], [Math.PI / 2, 0, 0]); for (const dx of [-.2, .2]) bolt(head.group, m.steel, [x + dx, .09, z], [Math.PI / 2, 0, 0]); }
      for (const z of [-.48, .48]) bolt(head.group, m.steel, [x, .23, z]);
      // Poço e isolador cerâmico da vela, integrados ao cabeçote.
      mesh(head.group, cylinder(.046, .19), m.ceramic, [x, .21, 0]); mesh(head.group, cylinder(.055, .06, .055, 6), m.steel, [x, .13, 0]);
      for (const kind of ['intake', 'exhaust']) for (let i = 0; i < 2; i++) {
        const z = (kind === 'intake' ? -sign : sign) * .18;
        const valve = v.part(`valvula-${n}-${kind}-${i + 1}`, `${kind === 'intake' ? 'Admissão' : 'Escape'} ${i + 1} · cilindro ${String(n).padStart(2, '0')}`, 'valves', bankPoint(b, x + (i ? .12 : -.12), VALVE_HOME_HEIGHT, z), [0, 1.8, sign * .26], { cylinder: n, bank: b }); valve.group.rotation.x = BANK_TILTS[b];
        mesh(valve.group, cylinder(.023, .59), m.polished, [0, .25, 0]);
        mesh(valve.group, cylinder(.075, .033, .055), m.steel, [0, -.065, 0]);
        const spring = new THREE.Group(); spring.position.y = SPRING_SEAT_HEIGHT - VALVE_HOME_HEIGHT;
        spring.userData.animated = true; valve.group.add(spring);
        mesh(spring, springGeo, m.steel);
        v.springs.push({ spring, number: n, kind });
        mesh(valve.group, cylinder(.082, .025), m.silver, [0, .54, 0]);
        mesh(valve.group, cylinder(FOLLOWER_RADIUS, FOLLOWER_HEIGHT), m.polished, [0, FOLLOWER_TOP_HEIGHT - VALVE_HOME_HEIGHT - FOLLOWER_HEIGHT / 2, (kind === 'intake' ? -sign : sign) * .05]);
        v.valves.push({ part: valve, number: n, kind, bank: b });
      }
    }
    for (const kind of ['intake', 'exhaust']) {
      const lateral = (kind === 'intake' ? -sign : sign) * .23;
      const home = bankPoint(b, 0, CAM_HEIGHT, lateral);
      const cam = v.part(`comando-${b}-${kind}`, `Comando de ${kind === 'intake' ? 'admissão' : 'escape'} · bancada ${b === 0 ? 'A' : 'B'}`, 'cams', home, [0, 2.3, sign * .26], { bank: b });
      mesh(cam.group, cylinder(.065, 5.4), m.polished, [0, 0, 0], [0, 0, Math.PI / 2]);
      for (let c = 0; c < 6; c++) {
        const n = b * 6 + c + 1;
        const profile = new THREE.Shape();
        camProfilePoints(b, n, kind).forEach(([y, z], sample) => {
          if (sample === 0) profile.moveTo(-z, y); else profile.lineTo(-z, y);
        });
        profile.closePath();
        const lobe = new THREE.ExtrudeGeometry(profile, { depth: .085, bevelEnabled: false, curveSegments: 1 }); lobe.translate(0, 0, -.0425); lobe.rotateY(Math.PI / 2);
        for (const dx of [-.12, .12]) mesh(cam.group, lobe, m.steel, [cylinderX(n) + dx, 0, 0]);
      }
      for (let i = 0; i < 7; i++) mesh(cam.group, cylinder(.09, .08), m.polished, [(i - 3) * .72, 0, 0], [0, 0, Math.PI / 2]);
      v.cams.push(cam); wheelCenters.push([home[1], home[2], .205, .5]);
      connect(`Eixo comando ${b}-${kind}`, cam, [2.7, 0, 0], timing, [-.02, home[1], home[2]]);
      for (let i = 0; i < 7; i++) {
        const support = new THREE.Group(); support.position.set((i - 3) * .72, 0, 0); head.group.add(support);
        mesh(support, bearing, m.silver, [0, CAM_HEIGHT - HEAD_CENTER, lateral]);
      }
    }
    const cover = v.part(`tampa-${b + 1}`, `Tampa de válvulas · bancada ${b === 0 ? 'A' : 'B'}`, 'covers', bankPoint(b, 0, COVER_CENTER), [0, 2.95, sign * .55], { bank: b, shell: true }); cover.group.rotation.x = BANK_TILTS[b];
    // A single cast shell and gasket share the head's mating plane. Rounded
    // shoulders, twin raised ribs and a recessed carbon insert recall the reference.
    hollowCase(cover.group, 4.78, 1.17, -.302, .40, .075, m.red);
    const coverGasket = plan(4.78, 1.17, .19);
    coverGasket.holes.push(new THREE.Path(plan(4.60, .99, .13).getPoints(12)));
    mesh(cover.group, slab(coverGasket, .018), m.black, [0, -.32, 0]);
    for (const z of [-.36, .36]) mesh(cover.group, roundedBox(4.34, .105, .21, .08), m.red, [0, .415, z]);
    mesh(cover.group, roundedBox(3.84, .035, .41, .016), m.carbon, [0, .419, 0]);
    for (const z of [-.225, .225]) mesh(cover.group, roundedBox(3.78, .018, .019, .008), m.polished, [0, .43, z]);
    for (let c = 0; c < 7; c++) for (const z of [-.48, .48]) {
      const x = (c - 3) * .69;
      ring(cover.group, .061, .033, .018, m.dark, [x, .409, z]); bolt(cover.group, m.polished, [x, .428, z]);
    }
    ring(cover.group, .145, .11, .04, m.polished, [-1.91, .425, 0]);
    mesh(cover.group, cylinder(.113, .055, .113, 12), m.dark, [-1.91, .455, 0]);
    mesh(cover.group, roundedBox(.14, .018, .027, .009), m.polished, [-1.91, .49, 0]);
    connect(`Tampa cabeçote ${b}`, head, [0, HEAD_TOP - HEAD_CENTER, .53], cover, [0, -.32, .53]);
    const intake = v.part(`admissao-${b + 1}`, `Plenum de admissão · bancada ${b === 0 ? 'A' : 'B'}`, 'intake', [0, 2.72, sign * .37], [0, 3.6, sign * .12], { bank: b, shell: true });
    mesh(intake.group, roundedBox(4.38, .57, .72, .18), m.brightRed);
    mesh(intake.group, roundedBox(3.65, .028, .22, .012), m.carbon, [0, .305, 0]);
    for (const z of [-.18, .18]) mesh(intake.group, box(3.7, .012, .025), m.polished, [0, .303, z]);
    for (const z of [-.26, .26]) mesh(intake.group, roundedBox(3.88, .045, .035, .016), m.red, [0, .286, z]);
    for (let c = 0; c < 6; c++) {
      const x = cylinderX(b * 6 + c + 1), target = bankPoint(b, x, HEAD_CENTER, -sign * .61), end = local(intake, target);
      pipe(intake.group, [[x, -.22, 0], [x, -.4, sign * .06], [x, end[1] + .12, end[2] - sign * .09], end], .113, m.silver);
      flange(intake.group, end, .115, [0, -Math.sin(BANK_TILTS[b]), Math.cos(BANK_TILTS[b])]);
      connect(`Admissão cilindro ${b * 6 + c + 1}`, intake, end, head, [x, 0, -sign * .61]);
    }
    ring(intake.group, .283, .224, .37, m.silver, [2.27, 0, 0], [0, 0, Math.PI / 2]);
    mesh(intake.group, cylinder(.22, .016), m.brass, [2.44, 0, 0], [0, 0, Math.PI / 2]);
    mesh(intake.group, cylinder(.022, .44), m.steel, [2.47, 0, 0], [Math.PI / 2, 0, 0]);
    flange(intake.group, [2.27, 0, 0], .283, [1, 0, 0]);
    mesh(intake.group, roundedBox(.18, .21, .15, .04), m.dark, [2.31, -.19, .23]);
    // Fuel rail, injectors and their short wiring loom remain part of the
    // selectable intake assembly, in both mounted and exploded views.
    const railZ = sign * .32;
    mesh(intake.group, cylinder(.043, 4.25), m.red, [0, -.31, railZ], [0, 0, Math.PI / 2]);
    for (let c = 0; c < 6; c++) {
      const x = cylinderX(b * 6 + c + 1);
      mesh(intake.group, cylinder(.039, .16), m.steel, [x, -.40, railZ]);
      mesh(intake.group, roundedBox(.075, .085, .075, .018), m.black, [x, -.36, railZ + sign * .05]);
    }
    const turboHome = [2.08, -.06, sign * 2.16];
    const turbo = v.part(`turbo-${b + 1}`, `Turbocompressor ${b === 0 ? 'A' : 'B'}`, 'turbo', turboHome, [.28, .1, sign * .95], { bank: b });
    // Increasing scroll section, backing plate, bellmouth and hot housing.
    // The scroll ends at the actual charge-pipe anchor on both banks.
    volute(turbo.group, sign);
    ring(turbo.group, .40, .115, .11, m.silver, [-.06, 0, 0], [0, 0, Math.PI / 2]);
    ring(turbo.group, .43, .255, .12, m.silver, [.035, 0, 0], [0, 0, Math.PI / 2]);
    const bellmouth = new THREE.LatheGeometry([
      new THREE.Vector2(.218, -.13), new THREE.Vector2(.22, .04), new THREE.Vector2(.246, .13),
      new THREE.Vector2(.275, .17), new THREE.Vector2(.292, .17), new THREE.Vector2(.272, .10),
      new THREE.Vector2(.25, -.13), new THREE.Vector2(.218, -.13),
    ], 48);
    mesh(turbo.group, bellmouth, m.polished, [.22, 0, 0], [0, 0, -Math.PI / 2]);
    mesh(turbo.group, cylinder(.215, .012), m.dark, [.04, 0, 0], [0, 0, Math.PI / 2]);
    const fan = new THREE.Group(); fan.position.x = .12; turbo.group.add(fan);
    mesh(fan, cylinder(.053, .1, .023), m.polished, [.06, 0, 0], [0, 0, Math.PI / 2]);
    for (let f = 0; f < 12; f++) { const a = f / 12 * Math.PI * 2; mesh(fan, roundedBox(.035, .18, .018, .007), m.polished, [0, Math.cos(a) * .12, Math.sin(a) * .12], [a, .5, 0]); } v.fans.push(fan);
    const hot = mesh(turbo.group, torus(.27, .12), m.hot, [-.31, 0, 0], [0, Math.PI / 2, 0]); hot.scale.z = 1.12;
    ring(turbo.group, .29, .115, .18, m.hot, [-.37, 0, 0], [0, 0, Math.PI / 2]);
    mesh(turbo.group, cylinder(.115, .35), m.steel, [-.14, 0, 0], [0, 0, Math.PI / 2]);
    for (let k = 0; k < 8; k++) bolt(turbo.group, m.steel, [.105, Math.cos(k / 8 * Math.PI * 2) * .37, Math.sin(k / 8 * Math.PI * 2) * .37], [0, 0, Math.PI / 2]);
    // Wastegate diaphragm, actuator rod and compressor fastening band.
    mesh(turbo.group, cylinder(.145, .13, .11), m.brass, [-.17, .60, sign * .23]);
    ring(turbo.group, .147, .125, .018, m.polished, [-.17, .635, sign * .23]);
    pipe(turbo.group, [[-.17, .535, sign * .23], [-.17, .34, sign * .34], [-.31, .15, sign * .34]], .017, m.polished);
    pipe(turbo.group, [[-.17, .665, sign * .23], [.10, .71, sign * .23], [.23, .52, sign * .25]], .018, m.black);
    const turbineEntry = [-.31, .37, -sign * .14];
    pipe(turbo.group, [[-.31, .14, 0], [-.31, .3, -sign * .1], turbineEntry], .165, m.hot); flange(turbo.group, turbineEntry, .17, [0, 1, 0], m.hot);
    const exhaust = v.part(`escape-${b + 1}`, `Coletor de escape · bancada ${b === 0 ? 'A' : 'B'}`, 'exhaust', [0, 0, 0], [.15, .2, sign * .65], { bank: b });
    const collector = [turboHome[0] + turbineEntry[0], turboHome[1] + turbineEntry[1], turboHome[2] + turbineEntry[2]];
    for (let c = 0; c < 6; c++) {
      const x = cylinderX(b * 6 + c + 1), port = bankPoint(b, x, HEAD_CENTER, sign * .61);
      pipe(exhaust.group, [port, [x, port[1] - .22, port[2] + sign * .23], [x + .23, .37 + c * .035, sign * (2.24 + c * .017)], collector], .087, m.exhaust);
      flange(exhaust.group, port, .115, [0, -Math.sin(BANK_TILTS[b]), Math.cos(BANK_TILTS[b])]);
      connect(`Escape cilindro ${b * 6 + c + 1}`, head, [x, 0, sign * .61], exhaust, port);
    }
    flange(exhaust.group, collector, .17, [0, 1, 0], m.hot); connect(`Coletor/turbina ${b}`, exhaust, collector, turbo, turbineEntry);
    // Duto de pressão contínuo entre compressor e borboleta, com mangotes.
    ring(intake.group, .244, .221, .14, m.black, [2.48, 0, 0], [0, 0, Math.PI / 2]);
    for (const x of [2.425, 2.535]) ring(intake.group, .25, .242, .025, m.polished, [x, 0, 0], [0, 0, Math.PI / 2]);
    const chargeEnd = [2.5, 2.72, sign * .37], chargeStart = [0, .39, .18 * sign];
    pipe(turbo.group, [chargeStart, [.43, .62, .22 * sign], [.81, 1.86, -sign * .55], [chargeEnd[0] - turboHome[0] + .25, chargeEnd[1] - turboHome[1], chargeEnd[2] - turboHome[2]], chargeEnd.map((x, i) => x - turboHome[i])], .15, m.silver);
    flange(turbo.group, chargeEnd.map((x, i) => x - turboHome[i]), .15, [1, 0, 0]); connect(`Compressor/admissão ${b}`, turbo, chargeEnd.map((x, i) => x - turboHome[i]), intake, [2.5, 0, 0]);
    pipe(turbo.group, [[-.49, 0, 0], [-.74, -.31, sign * .1], [-1.2, -.62, sign * .2], [-2.0, -.62, sign * .2]], .16, m.exhaust);
    flange(turbo.group, [-.49, 0, 0], .16, [1, 0, 0], m.hot);
    ring(turbo.group, .182, .161, .24, m.black, [-1.64, -.62, sign * .2], [0, 0, Math.PI / 2]);
    for (const x of [-1.735, -1.545]) ring(turbo.group, .188, .18, .027, m.polished, [x, -.62, sign * .2], [0, 0, Math.PI / 2]);
    ring(turbo.group, .168, .146, .035, m.polished, [-2.0, -.62, sign * .2], [0, 0, Math.PI / 2]);
    // Suporte visível fixa cada turbo ao bloco; a linha fina representa o óleo.
    const mount = bankPoint(b, 1.67, .9, sign * .53), mountLocal = mount.map((x, i) => x - turboHome[i]);
    pipe(turbo.group, [[-.2, -.1, -.2 * sign], mountLocal], .045, m.steel);
    pipe(turbo.group, [[-.12, .11, 0], [-.48, .18, -sign * .5], mountLocal], .023, m.brass);
    connect(`Suporte turbo ${b}`, turbo, mountLocal, block, local(block, mount));
  }
  // Corrente pelo envelope das cinco engrenagens: quatro comandos + virabrequim.
  for (const [y, z, r, ratio] of wheelCenters) {
    const wheel = new THREE.Group(); wheel.position.set(0, y, z); timing.group.add(wheel);
    ring(wheel, r, r * .68, .1, m.steel, [0, 0, 0], [0, 0, Math.PI / 2]);
    for (let k = 0; k < 6; k++) mesh(wheel, box(.1, .027, r * 1.7), m.silver, [0, 0, 0], [k * Math.PI / 3, 0, 0]);
    mesh(wheel, cylinder(.052, .14), m.polished, [0, 0, 0], [0, 0, Math.PI / 2]);
    const teeth = ratio === 1 ? 16 : 32;
    for (let k = 0; k < teeth; k++) { const a = k / teeth * Math.PI * 2; mesh(wheel, box(.1, .024, .024), m.steel, [0, Math.cos(a) * r, Math.sin(a) * r], [a, 0, 0]); }
    v.wheels.push({ wheel, ratio });
  }
  const points = wheelCenters.flatMap(([y, z, r]) => Array.from({ length: 48 }, (_, i) => ({ x: z + Math.sin(i / 48 * Math.PI * 2) * (r + .012), y: y + Math.cos(i / 48 * Math.PI * 2) * (r + .012) })));
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = []; for (const p of points) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); } for (const p of [...points].reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  const curve = new THREE.CurvePath(); hull.forEach((p, i) => { const q = hull[(i + 1) % hull.length]; curve.add(new THREE.LineCurve3(new THREE.Vector3(.055, p.y, p.x), new THREE.Vector3(.055, q.y, q.x))); });
  const length = curve.getLength(), links = Math.ceil(length / .061);
  for (let i = 0; i < links; i++) { const p = curve.getPoint(i / links), tangent = curve.getTangent(i / links); const link = mesh(timing.group, roundedBox(.055, .052, .026, .009), i % 2 ? m.steel : m.silver, p.toArray()); link.rotation.x = Math.atan2(tangent.z, tangent.y); }
  connect('Virabrequim/distribuição', crank, [2.7, 0, 0], timing, [-.02, CRANK_Y, 0]);
}
