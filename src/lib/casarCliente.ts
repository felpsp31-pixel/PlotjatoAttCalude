/**
 * Casa o tomador de uma NFS-e com um cliente cadastrado.
 *
 * Nota fiscal traz razao social completa ("CONSTRUTORA ALFA LTDA"), e o
 * cadastro costuma ter o nome curto ("Construtora Alfa"). Comparando os dois
 * crus, nunca casam: a nota virava um cliente avulso novo e o lancamento
 * aparecia num item da barra lateral que ninguem clicou -- parecia que nao
 * tinha sido salvo. Por isso o CNPJ vem primeiro, e o nome so entra depois,
 * ja sem os sufixos de pessoa juridica.
 */

export type Candidato = { id: string; name: string; cnpj?: string | null };

export type Casamento = {
  id: string;
  name: string;
  /** Como casou, para a mensagem dizer ao usuario onde a nota foi parar. */
  via: "cnpj" | "nome" | "nome-parcial";
};

/** LTDA, ME, EPP, EIRELI, S/A e afins nao distinguem uma empresa da outra. */
const SUFIXOS =
  /\b(ltda|me|epp|eireli|sa|mei|cia|companhia|participacoes)\b/g;

export function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Sem acento, sem pontuacao, caixa baixa, sem sufixo societario. */
export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(SUFIXOS, " ")
    .replace(/\s+/g, "")
    .trim();
}

export function casarCliente(
  tomador: string | null | undefined,
  cnpjTomador: string | null | undefined,
  candidatos: Candidato[],
): Casamento | null {
  // 1. CNPJ: so casa com 14 digitos de cada lado, para 'vazio == vazio' nao
  //    grudar a nota no primeiro cliente sem CNPJ cadastrado.
  const cnpj = soDigitos(cnpjTomador);
  if (cnpj.length === 14) {
    const porCnpj = candidatos.find((c) => soDigitos(c.cnpj) === cnpj);
    if (porCnpj) return { id: porCnpj.id, name: porCnpj.name, via: "cnpj" };
  }

  const alvo = normalizar(tomador);
  if (!alvo) return null;

  // 2. Nome normalizado, ja sem sufixo societario.
  const porNome = candidatos.find((c) => normalizar(c.name) === alvo);
  if (porNome) return { id: porNome.id, name: porNome.name, via: "nome" };

  // 3. Um contem o outro: cobre "Construtora Alfa" x "Construtora Alfa Obras".
  //    Exige 5 caracteres para "ab" nao casar com meio mundo, e so aceita
  //    quando um unico candidato bate -- com dois, adivinhar e pior que errar
  //    de forma visivel.
  if (alvo.length >= 5) {
    const parciais = candidatos.filter((c) => {
      const n = normalizar(c.name);
      return n.length >= 5 && (n.includes(alvo) || alvo.includes(n));
    });
    if (parciais.length === 1) {
      return { id: parciais[0].id, name: parciais[0].name, via: "nome-parcial" };
    }
  }

  return null;
}
