export type Vec3 = [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];

export const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));

export const normalize = (v: Vec3): Vec3 => {
  const len = length(v);
  return len === 0 ? [0, 0, 0] : [v[0] / len, v[1] / len, v[2] / len];
};

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

export const rotateEuler = (v: Vec3, [rx, ry, rz]: [number, number, number]): Vec3 => {
  let [x, y, z] = v;
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);

  let y1 = y * cx - z * sx;
  let z1 = y * sx + z * cx;
  y = y1;
  z = z1;

  let x1 = x * cy + z * sy;
  z1 = -x * sy + z * cy;
  x = x1;
  z = z1;

  x1 = x * cz - y * sz;
  y1 = x * sz + y * cz;
  return [x1, y1, z];
};

export const quantizedKey = (v: Vec3, precision = 1e9): string =>
  `${Math.round(v[0] * precision)},${Math.round(v[1] * precision)},${Math.round(v[2] * precision)}`;

export const sortedPairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
