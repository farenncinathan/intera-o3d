export const TAU = Math.PI * 2;
export const CRANK_RADIUS = 0.32;
export const ROD_LENGTH = 1.48;
// Sequência ilustrativa: uma combustão a cada 60° de um ciclo de 720°.
export const FIRING_ORDER = [1, 12, 5, 8, 3, 10, 6, 7, 2, 11, 4, 9];
export const CYCLES = [
  { name: 'Admissão', color: '#5ea7f2', short: 'Ar + combustível', description: 'O pistão desce. As válvulas de admissão se abrem e deixam entrar a mistura de ar e combustível.', valves: 'Admissão aberta · escape fechado' },
  { name: 'Compressão', color: '#e6b85f', short: 'Mistura comprimida', description: 'O pistão sobe com todas as válvulas fechadas. A mistura ocupa um volume cada vez menor e fica pronta para a ignição.', valves: 'Todas as válvulas fechadas' },
  { name: 'Combustão', color: '#ed5847', short: 'Energia em movimento', description: 'Perto do ponto mais alto, a vela inicia a combustão. A expansão dos gases empurra o pistão para baixo e a biela transmite força ao virabrequim.', valves: 'Todas as válvulas fechadas' },
  { name: 'Escape', color: '#a497d9', short: 'Saída dos gases', description: 'O pistão sobe e as válvulas de escape se abrem. Os gases saem pelo coletor, movimentam a turbina e o ciclo recomeça.', valves: 'Escape aberto · admissão fechada' },
];
export function positiveModulo(value, max) { return ((value % max) + max) % max; }
export function cylinderAngle(angle, cylinder) {
  if (!Number.isInteger(cylinder) || cylinder < 1 || cylinder > 12) throw new RangeError('Cilindro deve estar entre 1 e 12.');
  return positiveModulo(angle - FIRING_ORDER.indexOf(cylinder) * Math.PI / 3, TAU * 2);
}
export function pistonPosition(angle, radius = CRANK_RADIUS, rod = ROD_LENGTH) {
  if (rod <= radius || radius < 0) throw new RangeError('A biela deve ser maior que o raio da manivela.');
  return radius * Math.cos(angle) + Math.sqrt(rod * rod - (radius * Math.sin(angle)) ** 2);
}
export function cycleAt(angle) { return Math.floor(positiveModulo(angle, TAU * 2) / Math.PI); }
export function valveLift(angle, kind) {
  const phase = positiveModulo(angle, TAU * 2);
  const start = kind === 'intake' ? 0 : Math.PI * 3;
  const t = (phase - start) / Math.PI;
  return t > 0 && t < 1 ? Math.sin(t * Math.PI) * 0.14 : 0;
}
