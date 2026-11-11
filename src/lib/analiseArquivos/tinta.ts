/** Mesma regra do executável: página desenhada a 72 DPI, tom abaixo de 230 conta como tinta. */
export const LIMIAR_TINTA = 230;

/** Conta a fração de pixels escuros (luminância < 230) numa imagem RGBA. */
export function fracaoTinta(rgba: Uint8ClampedArray): number {
  const total = rgba.length / 4;
  if (!total) return 0;
  // Luminância com pesos inteiros (299/587/114 por mil) para não errar no limite por arredondamento.
  const limite = LIMIAR_TINTA * 1000;
  let tinta = 0;
  for (let k = 0; k < rgba.length; k += 4) {
    if (299 * rgba[k] + 587 * rgba[k + 1] + 114 * rgba[k + 2] < limite) tinta++;
  }
  return tinta / total;
}
