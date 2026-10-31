import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as geometry from '../src/geometry.js';
import { buildEngine } from '../src/model.js';
import { EngineViewer } from '../src/engine.js';
import { ROD_LENGTH, cylinderAngle, valveLift } from '../src/mechanics.js';
import {
  BANK_TILTS, VALVE_HOME_HEIGHT, SPRING_SEAT_HEIGHT, SPRING_REST_LENGTH,
  pistonPin, crankPin, rodRotationX, bankPoint, valveSpringState, cylinderX,
  FOLLOWER_TOP_HEIGHT, FOLLOWER_RADIUS,
} from '../src/assembly.js';

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
const nearPoint = (a, b) => a.forEach((value, i) => near(value, b[i]));

// Exercise the same construction helpers and Three transforms used by the
// renderer, without a WebGL context or a browser DOM.
function createModel() {
  const scene = new THREE.Scene(), parts = [], partsById = new Map();
  const materials = Object.fromEntries(['red', 'brightRed', 'silver', 'steel', 'dark', 'black', 'carbon', 'polished', 'ceramic', 'hot', 'exhaust', 'brass'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const viewer = {
    scene, materials, parts, partsById,
    pistons: [], rods: [], valves: [], cams: [], fans: [], wheels: [], springs: [],
    part(id, name, category, pos, spread, options = {}) {
      const group = new THREE.Group(); group.position.set(...pos); scene.add(group);
      const part = { id, name, category, group, home: new THREE.Vector3(...pos), spread: new THREE.Vector3(...spread), ...options };
      parts.push(part); partsById.set(id, part); return part;
    },
  };
  buildEngine(viewer, geometry);
  scene.updateMatrixWorld(true);
  return viewer;
}

test('os chanfros respeitam as dimensões externas usadas nos encaixes', () => {
  for (const dimensions of [[4.78, .7, .1, .045], [4.8, .91, 1.7, .16], [.095, 1.28, .095, .035]]) {
    const shape = geometry.roundedBox(...dimensions); shape.computeBoundingBox();
    const size = shape.boundingBox.getSize(new THREE.Vector3());
    nearPoint(size.toArray(), dimensions.slice(0, 3));
  }
});

const model = createModel();

test('o modelo real preserva os 90 componentes individuais e produz geometrias finitas', () => {
  assert.equal(model.parts.length, 90);
  assert.equal(model.partsById.size, 90);
  assert.equal(model.pistons.length, 12);
  assert.equal(model.rods.length, 12);
  assert.equal(model.valves.length, 48);
  assert.equal(model.cams.length, 4);
  for (const part of model.parts) {
    let meshes = 0;
    part.group.traverse(child => {
      if (!child.isMesh) return;
      meshes++;
      for (const value of child.geometry.attributes.position.array) assert.ok(Number.isFinite(value), part.id);
    });
    assert.ok(meshes > 0, part.id);
  }
});

test('a preparação real do renderizador combina materiais sem perder peças ou animações', () => {
  const viewer = createModel();
  viewer.pickables = []; viewer.container = { dataset: {} };
  const animated = [...viewer.fans, ...viewer.wheels.map(({ wheel }) => wheel), ...viewer.springs.map(({ spring }) => spring)];
  const parents = animated.map(group => group.parent);
  const verticesBefore = new Map(viewer.parts.map(part => {
    let count = 0;
    part.group.traverse(child => { if (child.isMesh) count += child.geometry.index?.count ?? child.geometry.attributes.position.count; });
    return [part.id, count];
  }));

  // Run production batching rather than an approximation. This catches
  // incompatible vertex attributes (e.g. a hand-built volute missing UVs),
  // which pass syntax/build checks but make mergeGeometries return null.
  EngineViewer.prototype.finishParts.call(viewer);

  assert.equal(viewer.container.dataset.partsCount, '90');
  assert.equal(new Set(viewer.pickables.map(child => child.userData.partId)).size, 90);
  for (const part of viewer.parts) {
    let verticesAfter = 0;
    part.group.traverse(child => {
      if (!child.isMesh) return;
      const attributes = child.geometry.attributes;
      assert.ok(attributes.position && attributes.normal && attributes.uv, part.id);
      assert.equal(attributes.normal.count, attributes.position.count, part.id);
      assert.equal(attributes.uv.count, attributes.position.count, part.id);
      verticesAfter += child.geometry.index?.count ?? attributes.position.count;
      assert.equal(child.userData.partId, part.id);
      assert.ok(viewer.pickables.includes(child));
    });
    assert.equal(verticesAfter, verticesBefore.get(part.id), part.id);
    assert.ok(part.materials.length > 0, part.id);
  }
  animated.forEach((group, index) => {
    assert.equal(group.parent, parents[index]);
    assert.equal(group.userData.animated, true);
    assert.ok(group.children.length > 0);
  });
});

test('as conexões do modelo real coincidem quando montadas', () => {
  assert.ok(model.connections.length >= 35);
  for (const connection of model.connections) {
    const a = model.partsById.get(connection.a.id).group.localToWorld(new THREE.Vector3(...connection.a.point));
    const b = model.partsById.get(connection.b.id).group.localToWorld(new THREE.Vector3(...connection.b.point));
    assert.ok(a.distanceTo(b) < 1e-6, `${connection.label}: folga ${a.distanceTo(b)}`);
  }
  // Check the actual flange faces too: matching anchor points alone cannot
  // detect a flange that extends beyond its declared mounting surface.
  const sump = model.partsById.get('carter');
  const rim = sump.group.children.find(child => child.material === model.materials.silver);
  const gasket = model.partsById.get('bloco').group.children.find(child => child.material === model.materials.black);
  const rimBounds = new THREE.Box3().setFromObject(rim);
  const gasketBounds = new THREE.Box3().setFromObject(gasket);
  near(rimBounds.max.y, gasketBounds.min.y);
});

test('os munhões dos comandos cabem nos furos dos mancais reais', () => {
  const journal = model.cams[0].group.children.find(child => child.geometry?.type === 'CylinderGeometry' && Math.abs(child.geometry.parameters.height - .08) < 1e-9);
  assert.ok(journal);
  const radius = journal.geometry.parameters.radiusTop;
  const doubleSided = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  let supports = 0;
  for (const id of ['cabecote-1', 'cabecote-2']) {
    for (const support of model.partsById.get(id).group.children.filter(child => child.isGroup)) {
      for (const child of support.children.filter(child => child.geometry?.type === 'ExtrudeGeometry')) {
        supports++;
        const bearing = new THREE.Mesh(child.geometry, doubleSided);
        bearing.updateMatrixWorld(true);
        for (let degrees = 0; degrees < 360; degrees += 15) {
          const angle = degrees * Math.PI / 180;
          const ray = new THREE.Raycaster(new THREE.Vector3(-1, Math.cos(angle) * radius, Math.sin(angle) * radius), new THREE.Vector3(1, 0, 0));
          assert.equal(ray.intersectObject(bearing).length, 0, `${id}: munhão invade mancal em ${degrees}°`);
        }
      }
    }
  }
  assert.equal(supports, 28);
  doubleSided.dispose();
});

test('os olhais reais das bielas continuam no pino e na manivela nos 720 graus', () => {
  for (let degrees = 0; degrees <= 720; degrees += 15) {
    const angle = degrees * Math.PI / 180;
    model.crankPart.group.rotation.x = angle;
    for (const { part, number } of model.pistons) part.group.position.set(...pistonPin(angle, number));
    for (const { part, number } of model.rods) {
      part.group.position.set(...crankPin(angle, number));
      part.group.rotation.x = rodRotationX(angle, number);
    }
    model.scene.updateMatrixWorld(true);
    for (const { part, number } of model.rods) {
      const lower = part.group.localToWorld(new THREE.Vector3());
      const upper = part.group.localToWorld(new THREE.Vector3(0, ROD_LENGTH, 0));
      const piston = model.partsById.get(`pistao-${number}`).group.getWorldPosition(new THREE.Vector3());
      nearPoint(lower.toArray(), crankPin(angle, number));
      nearPoint(upper.toArray(), piston.toArray());
      const journalAtRest = new THREE.Vector3(...crankPin(0, number));
      journalAtRest.y -= model.crankPart.home.y;
      const journalInMotion = model.crankPart.group.localToWorld(journalAtRest);
      nearPoint(lower.toArray(), journalInMotion.toArray());
    }
  }
  // Restore transforms for subsequent tests and keep the shared fixture mounted.
  for (const part of model.parts) part.group.position.copy(part.home);
  model.crankPart.group.rotation.x = 0;
  model.scene.updateMatrixWorld(true);
});

test('as molas comprimem mantendo o assento fixo e o prato solidário à haste', () => {
  assert.equal(model.springs.length, 48);
  for (const { spring } of model.springs) assert.equal(spring.userData.animated, true);
  for (let number = 1; number <= 12; number++) for (const kind of ['intake', 'exhaust']) {
    for (let degrees = 0; degrees <= 720; degrees += 5) {
      const angle = degrees * Math.PI / 180;
      const lift = valveLift(cylinderAngle(angle, number), kind);
      const state = valveSpringState(angle, number, kind);
      near(VALVE_HOME_HEIGHT - lift + state.offset, SPRING_SEAT_HEIGHT);
      near(VALVE_HOME_HEIGHT - lift + state.offset + SPRING_REST_LENGTH * state.scale, SPRING_SEAT_HEIGHT + SPRING_REST_LENGTH - lift);
      assert.ok(state.scale > 0 && state.scale <= 1);
    }
  }
  assert.throws(() => valveSpringState(0, 0, 'intake'), RangeError);
  assert.throws(() => valveSpringState(0, 1, 'invalid'), RangeError);
});

test('as molas do modelo real mantêm ambas as extremidades nas suas peças', () => {
  for (let degrees = 0; degrees <= 720; degrees += 30) {
    const angle = degrees * Math.PI / 180;
    for (const { part, bank, number, kind } of model.valves) {
      const axis = new THREE.Vector3(0, Math.cos(BANK_TILTS[bank]), Math.sin(BANK_TILTS[bank]));
      const lift = valveLift(cylinderAngle(angle, number), kind);
      part.group.position.copy(part.home).addScaledVector(axis, -lift);
    }
    for (const { spring, number, kind } of model.springs) {
      const state = valveSpringState(angle, number, kind);
      spring.position.y = state.offset; spring.scale.y = state.scale;
    }
    model.scene.updateMatrixWorld(true);
    for (const { spring, number, kind } of model.springs) {
      const bank = number <= 6 ? 0 : 1;
      const axis = new THREE.Vector3(0, Math.cos(BANK_TILTS[bank]), Math.sin(BANK_TILTS[bank]));
      const valve = model.valves.find(({ part }) => part.group === spring.parent).part;
      const fixedSeat = valve.home.clone().addScaledVector(axis, SPRING_SEAT_HEIGHT - VALVE_HOME_HEIGHT);
      const retainer = valve.group.localToWorld(new THREE.Vector3(0, SPRING_SEAT_HEIGHT - VALVE_HOME_HEIGHT + SPRING_REST_LENGTH, 0));
      nearPoint(spring.localToWorld(new THREE.Vector3()).toArray(), fixedSeat.toArray());
      nearPoint(spring.localToWorld(new THREE.Vector3(0, SPRING_REST_LENGTH, 0)).toArray(), retainer.toArray());
    }
  }
  for (const part of model.parts) part.group.position.copy(part.home);
  for (const { spring } of model.springs) { spring.position.y = SPRING_SEAT_HEIGHT - VALVE_HOME_HEIGHT; spring.scale.y = 1; }
  model.scene.updateMatrixWorld(true);
});

test('o envelope das válvulas não invade a coroa dos pistões durante o ciclo', () => {
  for (let number = 1; number <= 12; number++) {
    const bank = number <= 6 ? 0 : 1;
    const axis = new THREE.Vector3(0, Math.cos(BANK_TILTS[bank]), Math.sin(BANK_TILTS[bank]));
    const origin = new THREE.Vector3(...bankPoint(bank, 0, 0));
    for (let degrees = 0; degrees <= 720; degrees += 2) {
      const angle = degrees * Math.PI / 180;
      const pistonCrownHeight = new THREE.Vector3(...pistonPin(angle, number)).sub(origin).dot(axis) + .237;
      for (const kind of ['intake', 'exhaust']) {
        const valveFaceHeight = VALVE_HOME_HEIGHT - .0815 - valveLift(cylinderAngle(angle, number), kind);
        assert.ok(valveFaceHeight - pistonCrownHeight > .1, `cilindro ${number}, ${degrees}°`);
      }
    }
  }
});


test('o perfil real dos quatro comandos apoia os tuchos sem invasão lateral', () => {
  for (const cam of model.cams) {
    const bank = cam.bank, number = bank * 6 + 1;
    const kind = cam.id.endsWith('intake') ? 'intake' : 'exhaust';
    const sign = bank === 0 ? 1 : -1;
    const lateral = (kind === 'intake' ? -sign : sign) * .23;
    const lobe = cam.group.children.find(child => child.geometry?.type === 'ExtrudeGeometry' && Math.abs(child.position.x - (cylinderX(number) - .12)) < 1e-8);
    assert.ok(lobe, cam.id);
    const axis = new THREE.Vector3(0, Math.cos(BANK_TILTS[bank]), Math.sin(BANK_TILTS[bank]));
    const tangent = new THREE.Vector3(0, -Math.sin(BANK_TILTS[bank]), Math.cos(BANK_TILTS[bank]));
    const position = lobe.geometry.attributes.position;
    for (let degrees = 0; degrees <= 720; degrees += 5) {
      const angle = degrees * Math.PI / 180;
      cam.group.rotation.x = angle / 2;
      cam.group.updateWorldMatrix(true, true);
      const top = new THREE.Vector3(...bankPoint(bank, cylinderX(number) - .12, FOLLOWER_TOP_HEIGHT - valveLift(cylinderAngle(angle, number), kind), lateral));
      let gap = Infinity, contactOffset = Infinity;
      for (let i = 0; i < position.count; i++) {
        const vertex = lobe.localToWorld(new THREE.Vector3().fromBufferAttribute(position, i)).sub(top);
        const clearance = vertex.dot(axis);
        assert.ok(clearance > -1e-6, `${cam.id} invade tucho em ${degrees}° por ${-clearance}`);
        if (clearance < gap) { gap = clearance; contactOffset = Math.abs(vertex.dot(tangent)); }
      }
      assert.ok(gap < .0002, `${cam.id} sem contato em ${degrees}°: ${gap}`);
      assert.ok(contactOffset < FOLLOWER_RADIUS, `${cam.id} fora do tucho em ${degrees}°`);
    }
    cam.group.rotation.x = 0;
  }
});
