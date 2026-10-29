import test from 'node:test';
import assert from 'node:assert/strict';
import { TAU, CRANK_RADIUS, ROD_LENGTH, pistonPosition, cylinderAngle, cycleAt, valveLift, FIRING_ORDER } from '../src/mechanics.js';

const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);

test('o curso do pistão é duas vezes o raio da manivela', () => {
  near(pistonPosition(0), ROD_LENGTH + CRANK_RADIUS);
  near(pistonPosition(Math.PI), ROD_LENGTH - CRANK_RADIUS);
  near(pistonPosition(0) - pistonPosition(Math.PI), 2 * CRANK_RADIUS);
  near(pistonPosition(TAU), pistonPosition(0));
});
test('o mecanismo conserva o comprimento da biela durante uma volta completa', () => {
  for (let degrees = 0; degrees < 360; degrees++) {
    const angle = degrees * Math.PI / 180;
    const pinY = CRANK_RADIUS * Math.cos(angle), pinZ = CRANK_RADIUS * Math.sin(angle);
    near(Math.hypot(pistonPosition(angle) - pinY, pinZ), ROD_LENGTH);
  }
});
test('os quatro tempos ocupam um ciclo de 720°, inclusive com ângulos negativos', () => {
  for (let phase = 0; phase < 4; phase++) assert.equal(cycleAt((phase + 0.5) * Math.PI), phase);
  assert.equal(cycleAt(TAU * 2), 0);
  assert.equal(cycleAt(-0.1), 3);
  assert.equal(cycleAt(Math.PI), 1);
  assert.equal(cycleAt(TAU), 2);
});
test('as válvulas abrem apenas no tempo correspondente e fecham nos extremos', () => {
  for (let phase = 0; phase < 4; phase++) {
    const angle = (phase + 0.5) * Math.PI;
    near(valveLift(angle, 'intake'), phase === 0 ? 0.14 : 0);
    near(valveLift(angle, 'exhaust'), phase === 3 ? 0.14 : 0);
  }
  for (let phase = 0; phase <= 4; phase++) {
    near(valveLift(phase * Math.PI, 'intake'), 0);
    near(valveLift(phase * Math.PI, 'exhaust'), 0);
  }
});
test('os 12 cilindros têm eventos distribuídos a cada 60° e repetem após 720°', () => {
  assert.equal(new Set(FIRING_ORDER).size, 12);
  for (let i = 0; i < 12; i++) {
    const global = i * Math.PI / 3 + 0.1;
    near(cylinderAngle(global, FIRING_ORDER[i]), 0.1);
    near(cylinderAngle(global + TAU * 2, FIRING_ORDER[i]), 0.1);
  }
});
test('geometrias inválidas e cilindros inexistentes são rejeitados', () => {
  assert.throws(() => pistonPosition(0, 2, 1), RangeError);
  assert.throws(() => cylinderAngle(0, 0), RangeError);
  assert.throws(() => cylinderAngle(0, 13), RangeError);
});
