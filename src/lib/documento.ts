// CPF (11 dígitos) e CNPJ (14) na mesma caixa: a máscara segue o que foi
// digitado, sem travar o recibo avulso por um documento incompleto.
export function formatarDocumento(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

export function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^\((\d{2})\) (\d{4})(\d)/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^\((\d{2})\) (\d{5})(\d)/, '($1) $2-$3');
}
