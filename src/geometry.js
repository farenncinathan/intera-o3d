import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Share the same geometry in rendering and assembly tests. Dimensions always
// describe the outer envelope, including bevels, rather than an inner profile.
const geometryCache = new Map();
function cached(key, create) {
  if (!geometryCache.has(key)) geometryCache.set(key, create());
  return geometryCache.get(key);
}
export function box(w, h, d) {
  return cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
}
export function cylinder(r, h, r2 = r, segments = 32) {
  return cached(`c${r},${h},${r2},${segments}`, () => new THREE.CylinderGeometry(r, r2, h, segments));
}
export function torus(r, t) {
  return cached(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 12, 48));
}
export function roundedBox(w, h, d, radius = .1) {
  radius = Math.min(radius, w * .45, h * .45, d * .45);
  return cached(`r${w},${h},${d},${radius}`, () => new RoundedBoxGeometry(w, h, d, 2, radius));
}
export function mesh(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const object = new THREE.Mesh(geo, material);
  object.position.set(...pos); object.rotation.set(...rot);
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}
export function pipe(parent, points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(parent, new THREE.TubeGeometry(curve, Math.max(32, points.length * 10), radius, 12, false), material);
}
export function bolt(parent, material, pos, rot = [0, 0, 0]) {
  return mesh(parent, cylinder(.047, .035, .047, 6), material, pos, rot);
}
export function ring(parent, outer, inner, height, material, pos, rot = [0, 0, 0]) {
  const geometry = cached(`ring${outer},${inner},${height}`, () => new THREE.LatheGeometry([
    new THREE.Vector2(inner, -height / 2), new THREE.Vector2(outer, -height / 2),
    new THREE.Vector2(outer, height / 2), new THREE.Vector2(inner, height / 2),
    new THREE.Vector2(inner, -height / 2),
  ], 48));
  return mesh(parent, geometry, material, pos, rot);
}
