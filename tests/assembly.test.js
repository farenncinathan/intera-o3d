import test from 'node:test';
import assert from 'node:assert/strict';
import { ROD_LENGTH, CRANK_RADIUS, cylinderAngle, valveLift, VALVE_MAX_LIFT } from '../src/mechanics.js';
import {
  CRANK_Y, BANK_TILTS, BORE_SPACING, BANK_AXIAL_OFFSETS,
  BLOCK_DECK, HEAD_BOTTOM, HEAD_TOP, COVER_BOTTOM, COVER_TOP, CAM_HEIGHT, CAM_BASE_RADIUS,
  bankPoint, cylinderX, pistonPin, crankPin, rodRotationX, camRadius,
} from '../src/assembly.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
const nearPoint = (actual, expected) => actual.forEach((value, i) => near(value, expected[i]));

test('as faces do bloco, cabeçote e tampa compartilham as mesmas superfícies de montagem', () => {
  near(BLOCK_DECK, HEAD_BOTTOM);
  near(HEAD_TOP, COVER_BOTTOM);
  for (let bank = 0; bank < 2; bank++) for (const lateral of [-0.55, 0, 0.55]) {
    nearPoint(bankPoint(bank, 0, BLOCK_DECK, lateral), bankPoint(bank, 0, HEAD_BOTTOM, lateral));
    nearPoint(bankPoint(bank, 0, HEAD_TOP, lateral), bankPoint(bank, 0, COVER_BOTTOM, lateral));
  }
  assert.ok(CAM_HEIGHT - CAM_BASE_RADIUS - VALVE_MAX_LIFT > COVER_BOTTOM);
  assert.ok(CAM_HEIGHT + CAM_BASE_RADIUS + VALVE_MAX_LIFT < COVER_TOP - 0.12);
});

test('cilindros, pistões e pinos usam o mesmo eixo axial em ambas as bancadas', () => {
  for (let number = 1; number <= 12; number++) {
    const bank = number <= 6 ? 0 : 1, index = (number - 1) % 6;
    near(cylinderX(number), (index - 2.5) * BORE_SPACING + BANK_AXIAL_OFFSETS[bank]);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 3]) {
      near(pistonPin(angle, number)[0], cylinderX(number));
      near(crankPin(angle, number)[0], cylinderX(number));
    }
  }
});

test('as bielas conectam exatamente manivela e pino do pistão durante todo o ciclo', () => {
  for (let number = 1; number <= 12; number++) for (let degrees = 0; degrees < 720; degrees += 5) {
    const angle = degrees * Math.PI / 180;
    const crank = crankPin(angle, number), wrist = pistonPin(angle, number);
    const rotation = rodRotationX(angle, number);
    const endOfRod = [crank[0], crank[1] + ROD_LENGTH * Math.cos(rotation), crank[2] + ROD_LENGTH * Math.sin(rotation)];
    nearPoint(endOfRod, wrist);
    near(Math.hypot(wrist[1] - crank[1], wrist[2] - crank[2]), ROD_LENGTH);
    near(Math.hypot(crank[1] - CRANK_Y, crank[2]), CRANK_RADIUS);
  }
});

test('o deslocamento lateral de uma porta respeita a inclinação real da bancada', () => {
  for (let bank = 0; bank < 2; bank++) {
    const center = bankPoint(bank, 1.8, 2.34), side = bankPoint(bank, 1.8, 2.34, 0.55);
    near(Math.hypot(side[1] - center[1], side[2] - center[2]), 0.55);
    near(side[1] - center[1], -Math.sin(BANK_TILTS[bank]) * 0.55);
    near(side[2] - center[2], Math.cos(BANK_TILTS[bank]) * 0.55);
  }
});

test('âncoras rejeitam bancadas e cilindros inexistentes', () => {
  assert.throws(() => bankPoint(2, 0, 0), RangeError);
  assert.throws(() => cylinderX(0), RangeError);
  assert.throws(() => cylinderX(13), RangeError);
  assert.throws(() => pistonPin(0, 1.5), RangeError);
  assert.throws(() => crankPin(0, -1), RangeError);
  assert.throws(() => camRadius(0, 0, 1, 'invalid'), RangeError);
});

test('superfície dos comandos acompanha exatamente os tuchos nos quatro tempos', () => {
  const closedFollowerHeight = CAM_HEIGHT - CAM_BASE_RADIUS;
  for (let number = 1; number <= 12; number++) {
    const bank = number <= 6 ? 0 : 1;
    for (const kind of ['intake', 'exhaust']) for (let degrees = 0; degrees <= 720; degrees += 5) {
      const angle = degrees * Math.PI / 180;
      const profileAngle = BANK_TILTS[bank] + Math.PI - angle / 2;
      const radius = camRadius(profileAngle, bank, number, kind);
      const camContactHeight = CAM_HEIGHT - radius;
      const followerHeight = closedFollowerHeight - valveLift(cylinderAngle(angle, number), kind);
      near(camContactHeight, followerHeight);
      assert.ok(radius >= CAM_BASE_RADIUS - 1e-12 && radius <= CAM_BASE_RADIUS + VALVE_MAX_LIFT + 1e-12);
      assert.ok(CAM_HEIGHT + radius < COVER_TOP - 0.12);
    }
  }
});
