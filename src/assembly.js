import { CRANK_RADIUS, cylinderAngle, pistonPosition, valveLift, valveLiftSlope } from './mechanics.js';

// Todas as alturas são medidas no eixo local de cada bancada, a partir do
// centro do virabrequim. Compartilhar essas referências evita folgas de montagem.
export const CRANK_Y = -0.65;
export const BANK_TILTS = Object.freeze([Math.PI / 6, -Math.PI / 6]);
export const BORE_SPACING = 0.72;
export const BANK_AXIAL_OFFSETS = Object.freeze([-0.09, 0.09]);
export const BLOCK_DECK = 2.12;
export const HEAD_BOTTOM = BLOCK_DECK;
export const HEAD_TOP = 2.55;
export const HEAD_CENTER = (HEAD_BOTTOM + HEAD_TOP) / 2;
export const CAM_HEIGHT = 2.98;
export const CAM_BASE_RADIUS = 0.14;
export const CAM_LATERALS = Object.freeze([-0.23, 0.23]);
export const COVER_CENTER = 2.87;
export const COVER_BOTTOM = HEAD_TOP;
// COVER_CENTER é a referência de montagem da casca, não seu centro simétrico.
// O teto precisa liberar o envelope dos ressaltos e os tuchos de válvula.
export const COVER_TOP = 3.32;
export const VALVE_HOME_HEIGHT = 2.28;
export const SPRING_SEAT_HEIGHT = HEAD_TOP + 0.01;
export const SPRING_REST_LENGTH = 0.25;
export const FOLLOWER_TOP_HEIGHT = CAM_HEIGHT - CAM_BASE_RADIUS;
export const FOLLOWER_HEIGHT = 0.09;
export const FOLLOWER_RADIUS = 0.09;

function validateBank(bank) {
  if (bank !== 0 && bank !== 1) throw new RangeError('Bancada deve ser 0 ou 1.');
}
function validateCylinder(number) {
  if (!Number.isInteger(number) || number < 1 || number > 12) throw new RangeError('Cilindro deve estar entre 1 e 12.');
}

export function bankPoint(bank, x, height, lateral = 0) {
  validateBank(bank);
  const tilt = BANK_TILTS[bank], cosine = Math.cos(tilt), sine = Math.sin(tilt);
  return [x, CRANK_Y + height * cosine - lateral * sine, height * sine + lateral * cosine];
}

export function cylinderX(number) {
  validateCylinder(number);
  const bank = number <= 6 ? 0 : 1;
  return ((number - 1) % 6 - 2.5) * BORE_SPACING + BANK_AXIAL_OFFSETS[bank];
}

export function pistonPin(angle, number) {
  validateCylinder(number);
  return bankPoint(number <= 6 ? 0 : 1, cylinderX(number), pistonPosition(cylinderAngle(angle, number)));
}

export function crankPin(angle, number) {
  validateCylinder(number);
  const bank = number <= 6 ? 0 : 1;
  const phase = cylinderAngle(angle, number) + BANK_TILTS[bank];
  return [cylinderX(number), CRANK_Y + CRANK_RADIUS * Math.cos(phase), CRANK_RADIUS * Math.sin(phase)];
}

export function rodRotationX(angle, number) {
  const crank = crankPin(angle, number), wrist = pistonPin(angle, number);
  return Math.atan2(wrist[2] - crank[2], wrist[1] - crank[1]);
}

// A haste e o prato descem, mas o assento da mola continua no cabeçote.
// offset é local à válvula; compensar o seu curso mantém a base estacionária.
export function valveSpringState(angle, number, kind) {
  validateCylinder(number);
  if (kind !== 'intake' && kind !== 'exhaust') throw new RangeError('Válvula deve ser de intake ou exhaust.');
  const lift = valveLift(cylinderAngle(angle, number), kind);
  return {
    offset: SPRING_SEAT_HEIGHT - VALVE_HOME_HEIGHT + lift,
    scale: (SPRING_REST_LENGTH - lift) / SPRING_REST_LENGTH,
  };
}

// Distância de apoio do came contra o tucho plano. Não é um raio polar:
// construir r = base + lift fazia as laterais do ressalto invadirem o tucho.
// O comando gira à metade da rotação; a normal de contato no seu eixo local
// fica em BANK_TILT + PI - angle / 2.
export function camRadius(profileAngle, bank, number, kind) {
  validateBank(bank);
  validateCylinder(number);
  if (kind !== 'intake' && kind !== 'exhaust') throw new RangeError('Comando deve ser de intake ou exhaust.');
  const phase = 2 * (BANK_TILTS[bank] + Math.PI - profileAngle) + cylinderAngle(0, number);
  return CAM_BASE_RADIUS + valveLift(phase, kind);
}

// Envelope de um tucho plano: p = h*n + h'*t. Com base .14 e curso .04,
// h+h'' >= .02: o perfil permanece convexo e realiza o curso especificado.
// Nos extremos do curso, os limites de h' formam a face reta de transição.
export function camProfilePoints(bank, number, kind, samples = 192) {
  validateBank(bank); validateCylinder(number);
  if (kind !== 'intake' && kind !== 'exhaust') throw new RangeError('Comando deve ser de intake ou exhaust.');
  if (!Number.isInteger(samples) || samples < 24 || samples % 12 !== 0) throw new RangeError('Amostras devem ser múltiplas de 12 e pelo menos 24.');
  const points = [];
  for (let i = 0; i < samples; i++) {
    const alpha = i / samples * Math.PI * 2;
    const phase = 2 * (BANK_TILTS[bank] + Math.PI - alpha) + cylinderAngle(0, number);
    const h = camRadius(alpha, bank, number, kind);
    const before = -2 * valveLiftSlope(phase + 1e-9, kind);
    const after = -2 * valveLiftSlope(phase - 1e-9, kind);
    for (const derivative of Math.abs(before - after) > 1e-6 ? [before, after] : [before]) {
      points.push([h * Math.cos(alpha) - derivative * Math.sin(alpha), h * Math.sin(alpha) + derivative * Math.cos(alpha)]);
    }
  }
  return points;
}
