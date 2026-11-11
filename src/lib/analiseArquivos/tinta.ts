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

/**
 * Limite de pixels por página desenhada. A 72 DPI um A0 tem 8 milhões; uma faixa
 * de vários metros pode passar do que o navegador aceita num canvas. Acima disso a
 * página é desenhada menor: o preenchimento é uma proporção e quase não muda.
 */
export const MAX_PIXELS = 40_000_000;

/** Escala para desenhar a página: 1 (72 DPI) ou menos, se passar do limite de pixels. */
export function escalaDesenho(larguraPx: number, alturaPx: number, maxPixels = MAX_PIXELS): number {
  const area = larguraPx * alturaPx;
  return area > maxPixels ? Math.sqrt(maxPixels / area) : 1;
}
