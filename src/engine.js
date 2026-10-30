import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** A procedural, inspectable V8 study. Every visible piece belongs to a system. */
export function createEngine(THREE) {
  const group = new THREE.Group();
  group.name = "INTERA — V8 biturbo";
  const moving = [];
  const selectable = [];
  const materials = {
    red: new THREE.MeshStandardMaterial({
      color: "#a90f0c",
      metalness: 0.42,
      roughness: 0.29,
    }),
    redEdge: new THREE.MeshStandardMaterial({
      color: "#c51d16",
      metalness: 0.4,
      roughness: 0.24,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: "#bcc1c0",
      metalness: 0.9,
      roughness: 0.27,
    }),
    brushed: new THREE.MeshStandardMaterial({
      color: "#8b9394",
      metalness: 0.84,
      roughness: 0.35,
    }),
    polished: new THREE.MeshStandardMaterial({
      color: "#e4e6e3",
      metalness: 0.94,
      roughness: 0.19,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: "#292d2e",
      metalness: 0.7,
      roughness: 0.34,
    }),
    black: new THREE.MeshStandardMaterial({
      color: "#151b1b",
      metalness: 0.25,
      roughness: 0.56,
    }),
    gasket: new THREE.MeshStandardMaterial({
      color: "#585952",
      metalness: 0.65,
      roughness: 0.52,
    }),
    bronze: new THREE.MeshStandardMaterial({
      color: "#aa9474",
      metalness: 0.85,
      roughness: 0.29,
    }),
  };
  const geo = {
    bolt: new THREE.CylinderGeometry(0.047, 0.047, 0.055, 6),
    shaft: new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8),
    washer: new THREE.TorusGeometry(0.045, 0.009, 5, 12),
  };

  function layer(id, dy = 0, dz = 0) {
    const g = new THREE.Group();
    g.userData.partId = id;
    group.add(g);
    moving.push({ object: g, dy, dz });
    return g;
  }
  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    let root = parent;
    while (root && !root.userData.partId) root = root.parent;
    m.userData.partId = root?.userData.partId;
    if (m.userData.partId) selectable.push(m);
    parent.add(m);
    return m;
  }
  function bevelBox(w, h, d, radius = 0.045) {
    const r = Math.min(radius, w / 3, h / 3, d / 3);
    const shape = new THREE.Shape();
    const x = -w / 2 + r,
      y = -h / 2 + r;
    shape.moveTo(x, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, y);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(x, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, y);
    shape.quadraticCurveTo(-w / 2, -h / 2, x, -h / 2);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, d - 2 * r),
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: r,
      bevelThickness: r,
      curveSegments: 4,
    });
    g.center();
    return g;
  }
  function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, radius = 0.04) {
    return mesh(parent, bevelBox(w, h, d, radius), mat, x, y, z);
  }
  function cyl(
    parent,
    r,
    h,
    mat,
    x = 0,
    y = 0,
    z = 0,
    axis = "y",
    segments = 28,
  ) {
    const m = mesh(
      parent,
      new THREE.CylinderGeometry(r, r, h, segments),
      mat,
      x,
      y,
      z,
    );
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    return m;
  }
  function ring(parent, r, t, mat, x = 0, y = 0, z = 0, axis = "y") {
    const m = mesh(parent, new THREE.TorusGeometry(r, t, 8, 32), mat, x, y, z);
    if (axis === "y") m.rotation.x = Math.PI / 2;
    if (axis === "x") m.rotation.y = Math.PI / 2;
    return m;
  }
  function bolt(parent, x, y, z, axis = "y", long = false) {
    const b = mesh(parent, geo.bolt, materials.polished, x, y, z);
    if (axis === "x") b.rotation.z = Math.PI / 2;
    if (axis === "z") b.rotation.x = Math.PI / 2;
    if (long) {
      const s = mesh(parent, geo.shaft, materials.dark, x, y - 0.09, z);
      if (axis === "x") s.rotation.z = Math.PI / 2;
      if (axis === "z") s.rotation.x = Math.PI / 2;
    }
    return b;
  }
  function pipe(parent, points, r, mat) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    return mesh(parent, new THREE.TubeGeometry(curve, 28, r, 10, false), mat);
  }
  function bank(parent, side, y, z) {
    const b = new THREE.Group();
    b.position.set(0, y, side * z);
    b.rotation.x = side * 0.57;
    parent.add(b);
    return b;
  }
  function drilledDeck(parent, w, d, depth, r, mat, x = 0, y = 0, z = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -d / 2);
    shape.lineTo(w / 2, -d / 2);
    shape.lineTo(w / 2, d / 2);
    shape.lineTo(-w / 2, d / 2);
    shape.closePath();
    for (let i = 0; i < 4; i++) {
      const hole = new THREE.Path();
      hole.absarc(-1.35 + i * 0.9, 0, r, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 1,
      curveSegments: 24,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -depth / 2, 0);
    return mesh(parent, g, mat, x, y, z);
  }

  // The main cast block: deep red lower crankcase, two angled cylinder banks.
  const block = layer("block");
  box(block, 3.76, 0.94, 1.6, materials.red, 0, -0.25, 0, 0.09);
  box(block, 3.98, 0.16, 1.85, materials.redEdge, 0, -0.78, 0, 0.025);
  for (const side of [-1, 1]) {
    const b = bank(block, side, 0.28, 0.49);
    drilledDeck(b, 3.78, 0.98, 0.67, 0.345, materials.red, 0, 0, 0);
    drilledDeck(b, 3.81, 1, 0.035, 0.347, materials.brushed, 0, 0.355, 0);
    for (let i = 0; i < 4; i++) {
      const x = -1.35 + i * 0.9;
      ring(b, 0.346, 0.024, materials.polished, x, 0.38, 0);
      for (const z of [-0.43, 0.43]) bolt(b, x, 0.4, z);
      box(
        block,
        0.13,
        0.74,
        0.08,
        materials.redEdge,
        x,
        -0.1,
        side * 0.83,
        0.015,
      );
      cyl(block, 0.095, 0.045, materials.dark, x, -0.27, side * 0.86, "z", 16);
      ring(block, 0.095, 0.012, materials.brushed, x, -0.27, side * 0.89, "z");
    }
    for (let i = 0; i < 9; i++)
      bolt(block, -1.76 + i * 0.44, -0.82, side * 0.85);
    // Cast side rails and small coolant plugs.
    box(
      block,
      3.58,
      0.11,
      0.12,
      materials.redEdge,
      0,
      -0.52,
      side * 0.84,
      0.025,
    );
  }
  box(block, 0.18, 1.15, 1.8, materials.brushed, -1.96, -0.1, 0, 0.07);
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++)
      bolt(block, -2.07, -0.59 + i * 0.25, side * 0.7, "x");

  // Eight individual pistons with rings, wristpins and machined connecting rods.
  const pistons = layer("pistons", 1.05);
  for (const side of [-1, 1]) {
    const b = bank(pistons, side, 0.53, 0.61);
    for (let i = 0; i < 4; i++) {
      const x = -1.35 + i * 0.9;
      cyl(b, 0.305, 0.39, materials.polished, x, 0.37, 0);
      cyl(b, 0.292, 0.025, materials.brushed, x, 0.58, 0);
      cyl(b, 0.235, 0.012, materials.polished, x, 0.595, 0);
      for (let k = 0; k < 3; k++)
        ring(b, 0.306, 0.009, materials.dark, x, 0.48 - k * 0.045, 0);
      cyl(b, 0.071, 0.635, materials.dark, x, 0.29, 0, "z", 16);
      ring(b, 0.072, 0.012, materials.polished, x, 0.29, 0.32, "z");
      // Forged connecting rod, lightening cut between a pair of ribs.
      box(b, 0.12, 0.74, 0.095, materials.steel, x, -0.19, 0, 0.025);
      for (const z of [-0.065, 0.065])
        box(b, 0.055, 0.63, 0.035, materials.polished, x, -0.16, z, 0.012);
      ring(b, 0.14, 0.052, materials.steel, x, -0.57, 0, "z");
      for (const dx of [-0.15, 0.15]) bolt(b, x + dx, -0.6, 0);
    }
  }

  // Machined heads. The black recesses and port flanges add real depth.
  const heads = layer("heads", 1.75, 0.08);
  for (const side of [-1, 1]) {
    const b = bank(heads, side, 1.02, 0.83);
    drilledDeck(b, 3.96, 1.15, 0.44, 0.275, materials.steel);
    box(b, 4.04, 0.065, 1.21, materials.brushed, 0, -0.235, 0, 0.015);
    for (let i = 0; i < 4; i++) {
      const x = -1.35 + i * 0.9;
      cyl(b, 0.2, 0.08, materials.dark, x, -0.025, side * 0.61, "z");
      ring(b, 0.205, 0.025, materials.polished, x, -0.025, side * 0.66, "z");
      box(b, 0.59, 0.09, 0.08, materials.brushed, x, -0.24, side * 0.61, 0.015);
      for (const z of [-0.49, 0.49]) bolt(b, x, 0.27, z);
    }
    for (const x of [-1.9, 1.9])
      for (const z of [-0.45, 0.45]) bolt(b, x, 0.27, z, true);
    for (let i = 0; i < 10; i++)
      box(
        b,
        0.035,
        0.2,
        0.06,
        materials.brushed,
        -1.75 + i * 0.39,
        -0.02,
        -side * 0.57,
        0.006,
      );
  }

  // Valve springs, stems, keepers. They separate above each head.
  const valves = layer("heads", 2.28, 0.08);
  for (const side of [-1, 1]) {
    const b = bank(valves, side, 1.27, 0.84);
    for (let i = 0; i < 4; i++)
      for (const z of [-0.25, 0.25]) {
        const x = -1.35 + i * 0.9;
        cyl(b, 0.026, 0.52, materials.polished, x, 0.04, z, undefined, 10);
        cyl(b, 0.096, 0.025, materials.brushed, x, -0.23, z);
        cyl(b, 0.089, 0.045, materials.dark, x, 0.24, z);
        const points = [];
        for (let k = 0; k <= 65; k++) {
          const a = (k / 65) * Math.PI * 2 * 6;
          points.push(
            new THREE.Vector3(
              x + Math.cos(a) * 0.066,
              -0.1 + (k / 65) * 0.3,
              z + Math.sin(a) * 0.066,
            ),
          );
        }
        mesh(
          b,
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            65,
            0.015,
            5,
            false,
          ),
          materials.dark,
        );
        ring(b, 0.073, 0.017, materials.polished, x, 0.2, z);
      }
  }

  // Four overhead camshafts with offset polished lobes and toothed sprockets.
  const cams = layer("heads", 2.85, 0.1);
  for (const side of [-1, 1]) {
    const b = bank(cams, side, 1.65, 0.91);
    for (const z of [-0.26, 0.26]) {
      cyl(b, 0.059, 4.13, materials.brushed, 0, 0, z, "x");
      for (let i = 0; i < 8; i++) {
        const x = -1.55 + i * 0.44;
        cyl(
          b,
          0.108,
          0.13,
          materials.polished,
          x,
          0.025,
          z,
          "x",
          20,
        ).rotation.x = i * 0.93;
        cyl(b, 0.075, 0.045, materials.dark, x + 0.1, 0, z, "x");
      }
      cyl(b, 0.25, 0.09, materials.dark, -2.13, 0, z, "x");
      ring(b, 0.24, 0.025, materials.brushed, -2.19, 0, z, "x");
      cyl(b, 0.085, 0.13, materials.polished, -2.19, 0, z, "x", 12);
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        box(
          b,
          0.1,
          0.039,
          0.055,
          materials.brushed,
          -2.13,
          Math.cos(a) * 0.25,
          z + Math.sin(a) * 0.25,
          0.007,
        ).rotation.x = -a;
      }
    }
  }

  // Red cam covers with dark inserts, fine cooling fins and polished fasteners.
  const intake = layer("intake", 3.53, 0.14);
  for (const side of [-1, 1]) {
    const b = bank(intake, side, 1.97, 1.0);
    box(b, 4.15, 0.39, 1.16, materials.redEdge, 0, 0, 0, 0.105);
    box(b, 3.86, 0.19, 0.53, materials.black, 0, 0.2, 0, 0.045);
    for (let j = 0; j < 13; j++)
      box(
        b,
        3.48,
        0.015,
        0.015,
        materials.brushed,
        0,
        0.305,
        -0.2 + j * 0.033,
        0.004,
      );
    box(b, 1.04, 0.016, 0.22, materials.steel, -0.5, 0.32, 0, 0.015);
    box(b, 0.68, 0.021, 0.035, materials.dark, -0.5, 0.335, 0, 0.005);
    for (let i = 0; i < 8; i++)
      for (const z of [-0.51, 0.51]) bolt(b, -1.8 + i * 0.515, 0.21, z);
    cyl(b, 0.105, 0.07, materials.black, 1.48, 0.24, 0);
    for (let i = 0; i < 4; i++) {
      box(
        b,
        0.19,
        0.18,
        0.31,
        materials.dark,
        -1.35 + i * 0.9,
        0.27,
        -side * 0.35,
        0.04,
      );
      cyl(
        b,
        0.041,
        0.21,
        materials.brushed,
        -1.35 + i * 0.9,
        0.1,
        -side * 0.35,
      );
    }
    // Front throttle butterfly and alloy connector.
    cyl(b, 0.34, 0.3, materials.brushed, 2.24, 0.01, 0, "x");
    cyl(b, 0.292, 0.016, materials.black, 2.405, 0.01, 0, "x");
    cyl(b, 0.255, 0.02, materials.bronze, 2.42, 0.01, 0, "x");
    ring(b, 0.31, 0.034, materials.polished, 2.42, 0.01, 0, "x");
    for (const y of [-0.29, 0.29])
      for (const z of [-0.29, 0.29]) bolt(b, 2.43, y, z, "x");
    box(b, 0.16, 0.11, 0.65, materials.dark, 2.44, 0.01, 0, 0.02);
  }

  // A cross-plane crankshaft with offset journals, counterweights and end flywheel.
  const crank = layer("crankshaft", -0.92);
  cyl(crank, 0.12, 4.72, materials.polished, 0, -0.69, 0, "x");
  for (let i = 0; i < 5; i++) {
    const x = -1.8 + i * 0.9;
    cyl(crank, 0.175, 0.18, materials.brushed, x, -0.69, 0, "x");
    for (const offset of [-0.16, 0.16]) {
      const weight = box(
        crank,
        0.13,
        0.61,
        0.48,
        materials.dark,
        x + offset,
        -0.8,
        0,
        0.085,
      );
      weight.rotation.x = (i * Math.PI) / 2;
      ring(crank, 0.16, 0.023, materials.polished, x + offset, -0.69, 0, "x");
    }
    if (i < 4) {
      const a = (i * Math.PI) / 2;
      cyl(
        crank,
        0.128,
        0.38,
        materials.polished,
        x + 0.45,
        -0.69 + Math.sin(a) * 0.24,
        Math.cos(a) * 0.24,
        "x",
      );
    }
  }
  cyl(crank, 0.81, 0.12, materials.brushed, 2.48, -0.69, 0, "x");
  cyl(crank, 0.72, 0.08, materials.steel, 2.57, -0.69, 0, "x");
  ring(crank, 0.76, 0.033, materials.dark, 2.55, -0.69, 0, "x");
  cyl(crank, 0.24, 0.14, materials.dark, 2.64, -0.69, 0, "x");
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    bolt(crank, 2.64, -0.69 + Math.cos(a) * 0.49, Math.sin(a) * 0.49, "x");
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const m = box(
      crank,
      0.13,
      0.045,
      0.055,
      materials.steel,
      2.48,
      -0.69 + Math.cos(a) * 0.81,
      Math.sin(a) * 0.81,
      0.006,
    );
    m.rotation.x = -a;
  }

  // Oil sump with inset dark lip, fins, drain plug and long pan screws.
  const oil = layer("oilpan", -1.67);
  box(oil, 3.94, 0.09, 1.85, materials.gasket, 0, -1.05, 0, 0.025);
  box(oil, 3.84, 0.13, 1.76, materials.steel, 0, -1.14, 0, 0.03);
  box(oil, 3.56, 0.64, 1.55, materials.red, 0, -1.51, 0, 0.11);
  box(oil, 3.69, 0.09, 1.68, materials.redEdge, 0, -1.24, 0, 0.025);
  for (let i = 0; i < 9; i++) {
    const x = -1.58 + i * 0.395;
    for (const side of [-1, 1]) {
      box(
        oil,
        0.07,
        0.51,
        0.08,
        materials.redEdge,
        x,
        -1.49,
        side * 0.77,
        0.015,
      );
      bolt(oil, x, -1.22, side * 0.82, undefined, true);
    }
  }
  cyl(oil, 0.105, 0.08, materials.polished, 1.42, -1.85, 0, undefined, 6);
  cyl(oil, 0.19, 0.46, materials.black, -1.45, -1.92, 0.62);
  ring(oil, 0.17, 0.015, materials.brushed, -1.45, -2.12, 0.62);

  // Twin turbochargers with snail housings, visible compressor fans and headers.
  const turbos = layer("turbos", 0.17, 0.28);
  for (const side of [-1, 1]) {
    const tx = 1.22,
      ty = 0.17,
      tz = side * 1.92;
    const housing = ring(turbos, 0.38, 0.17, materials.steel, tx, ty, tz, "x");
    cyl(turbos, 0.35, 0.19, materials.brushed, tx + 0.05, ty, tz, "x");
    cyl(turbos, 0.28, 0.055, materials.black, tx + 0.17, ty, tz, "x");
    ring(turbos, 0.286, 0.042, materials.polished, tx + 0.21, ty, tz, "x");
    cyl(turbos, 0.075, 0.12, materials.polished, tx + 0.24, ty, tz, "x");
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const fan = box(
        turbos,
        0.055,
        0.19,
        0.028,
        materials.steel,
        tx + 0.21,
        ty + Math.cos(a) * 0.13,
        tz + Math.sin(a) * 0.13,
        0.009,
      );
      fan.rotation.x = -a + 0.45;
    }
    cyl(turbos, 0.245, 0.36, materials.dark, tx - 0.35, ty, tz, "x");
    ring(turbos, 0.23, 0.075, materials.bronze, tx - 0.43, ty, tz, "x");
    pipe(
      turbos,
      [
        [tx, ty + 0.35, tz],
        [tx - 0.08, ty + 0.62, tz],
        [tx - 0.55, ty + 0.7, tz],
        [tx - 0.93, ty + 0.49, tz],
      ],
      0.12,
      materials.steel,
    );
    pipe(
      turbos,
      [
        [tx + 0.1, ty - 0.34, tz],
        [tx + 0.5, ty - 0.55, tz],
        [tx + 0.6, ty - 0.65, tz - side * 0.47],
        [tx + 0.4, ty - 0.5, tz - side * 0.65],
      ],
      0.16,
      materials.polished,
    );
    for (let i = 0; i < 4; i++) {
      const x = -1.35 + i * 0.9;
      pipe(
        turbos,
        [
          [x, 0.84, side * 1.03],
          [x, 0.65, side * 1.4],
          [x * 0.55 + 0.1, 0.16, side * 1.58],
          [tx - 0.5, ty, side * 1.86],
        ],
        0.085,
        materials.polished,
      );
      box(
        turbos,
        0.42,
        0.08,
        0.2,
        materials.brushed,
        x,
        0.85,
        side * 1.03,
        0.02,
      );
    }
    cyl(turbos, 0.145, 0.2, materials.bronze, tx - 0.1, ty + 0.79, tz);
    ring(turbos, 0.147, 0.02, materials.polished, tx - 0.1, ty + 0.88, tz);
    pipe(
      turbos,
      [
        [tx - 0.1, ty + 0.7, tz],
        [tx + 0.23, ty + 0.6, tz],
        [tx + 0.38, ty + 0.3, tz],
      ],
      0.02,
      materials.brushed,
    );
  }

  // Front timing enclosure, grooved pulleys, visible belt and alternator.
  const timing = layer("block", -0.06);
  box(timing, 0.19, 1.42, 1.3, materials.black, -2.18, -0.3, 0, 0.1);
  const pulleys = [
    [-0.55, 0, 0.34],
    [0.3, 0.49, 0.24],
    [0.31, -0.49, 0.24],
    [-0.1, 0.82, 0.19],
  ];
  for (const [y, z, r] of pulleys) {
    cyl(timing, r, 0.14, materials.dark, -2.34, y, z, "x");
    ring(timing, r * 0.83, 0.022, materials.brushed, -2.43, y, z, "x");
    cyl(timing, r * 0.37, 0.18, materials.brushed, -2.42, y, z, "x");
    cyl(timing, 0.05, 0.2, materials.polished, -2.44, y, z, "x", 6);
  }
  pipe(
    timing,
    [
      [-2.42, -0.87, 0],
      [-2.42, -0.45, -0.38],
      [-2.42, 0.28, -0.74],
      [-2.42, 0.56, -0.48],
      [-2.42, 0.65, 0],
      [-2.42, 0.4, 0.72],
      [-2.42, -0.1, 1.02],
      [-2.42, -0.57, 0.43],
      [-2.42, -0.87, 0],
    ],
    0.036,
    materials.black,
  );
  cyl(timing, 0.31, 0.46, materials.brushed, -2.17, 0.24, 1.08, "x");
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    box(
      timing,
      0.37,
      0.025,
      0.045,
      materials.dark,
      -2.18,
      0.24 + Math.cos(a) * 0.27,
      1.08 + Math.sin(a) * 0.27,
      0.005,
    ).rotation.x = -a;
  }
  cyl(timing, 0.2, 0.07, materials.dark, -2.46, 0.24, 1.08, "x");
  ring(timing, 0.19, 0.022, materials.polished, -2.5, 0.24, 1.08, "x");
  for (let k = 0; k < 8; k++)
    bolt(timing, -2.305, -0.78 + k * 0.17, -0.57, "x");

  // All pieces in one exploded layer move together. Batch equal materials here
  // so the fine bolts, spring coils and cam lobes do not cost separate draw calls.
  const sourceGeometries = new Set();
  selectable.length = 0;
  group.updateMatrixWorld(true);
  for (const { object } of moving) {
    const batches = new Map();
    const inverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
    object.traverse((piece) => {
      if (!piece.isMesh) return;
      sourceGeometries.add(piece.geometry);
      let geometry = piece.geometry.index
        ? piece.geometry.toNonIndexed()
        : piece.geometry.clone();
      geometry.applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverse, piece.matrixWorld),
      );
      if (!batches.has(piece.material)) batches.set(piece.material, []);
      batches.get(piece.material).push(geometry);
    });
    object.clear();
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries, false);
      for (const source of geometries) source.dispose();
      mesh(object, geometry, material);
    }
  }
  for (const geometry of sourceGeometries) geometry.dispose();

  const originals = new Map();
  function setSelected(id) {
    for (const m of selectable) {
      if (!originals.has(m)) originals.set(m, m.material);
      if (m.userData.partId === id) {
        if (!m.userData.highlightMaterial) {
          const mat = originals.get(m).clone();
          mat.emissive = new THREE.Color("#f25229");
          mat.emissiveIntensity = 0.14;
          m.userData.highlightMaterial = mat;
        }
        m.material = m.userData.highlightMaterial;
      } else m.material = originals.get(m);
    }
  }
  function setExplosion(value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    for (const { object, dy, dz } of moving) {
      object.position.y = dy * t;
      object.position.z = dz * t;
    }
  }
  setExplosion(1);
  return {
    group,
    setExplosion,
    setSelected,
    parts: [
      {
        id: "intake",
        name: "Admissão e tampas",
        label: "Admissão e tampas",
        description:
          "Duas tampas de válvulas protegem o comando. A admissão conduz o ar até as câmaras de combustão.",
      },
      {
        id: "heads",
        name: "Cabeçotes e válvulas",
        label: "Cabeçotes e válvulas",
        description:
          "Comandos, molas e válvulas sincronizam a entrada de ar e a saída dos gases em cada cilindro.",
      },
      {
        id: "pistons",
        name: "Pistões e bielas",
        label: "Pistões e bielas",
        description:
          "Oito pistões transformam a pressão da combustão em movimento, transmitido pelas bielas.",
      },
      {
        id: "block",
        name: "Bloco do motor",
        label: "Bloco do motor",
        description:
          "A estrutura central abriga os oito cilindros dispostos em V e os canais de arrefecimento.",
      },
      {
        id: "crankshaft",
        name: "Virabrequim",
        label: "Virabrequim",
        description:
          "Converte o movimento alternado dos pistões em rotação para transmitir potência.",
      },
      {
        id: "oilpan",
        name: "Cárter e lubrificação",
        label: "Cárter e lubrificação",
        description:
          "O reservatório inferior recolhe o óleo que lubrifica e protege os componentes internos.",
      },
      {
        id: "turbos",
        name: "Turbocompressores",
        label: "Turbocompressores",
        description:
          "Dois turbocompressores aproveitam os gases do escape para comprimir o ar de admissão.",
      },
    ],
  };
}
