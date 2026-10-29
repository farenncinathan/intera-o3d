import { CRANK_RADIUS, cylinderAngle, pistonPosition, valveLift } from './mechanics.js';

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
export const CAM_BASE_RADIUS = 0.065;
export const CAM_LATERALS = Object.freeze([-0.23, 0.23]);
export const COVER_CENTER = 2.87;
export const COVER_BOTTOM = HEAD_TOP;
// COVER_CENTER é a referência de montagem da casca, não seu centro simétrico.
// O teto precisa liberar o envelope dos ressaltos e os tuchos de válvula.
export const COVER_TOP = 3.32;

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

// O mesmo deslocamento que move a válvula define a superfície do ressalto.
// O comando gira à metade da rotação do virabrequim; o ponto do perfil voltado
// para o tucho fica no ângulo local BANK_TILT + PI - angle / 2.
export function camRadius(profileAngle, bank, number, kind) {
  validateBank(bank);
  validateCylinder(number);
  if (kind !== 'intake' && kind !== 'exhaust') throw new RangeError('Comando deve ser de intake ou exhaust.');
  const phase = 2 * (BANK_TILTS[bank] + Math.PI - profileAngle) + cylinderAngle(0, number);
  return CAM_BASE_RADIUS + valveLift(phase, kind);
}
