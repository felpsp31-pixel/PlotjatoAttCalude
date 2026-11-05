/**
 * Monta o aviso de "ficou pronto" e o link que abre o WhatsApp já no
 * contato certo, com o texto escrito.
 *
 * Usa wa.me, que é só um link: não envia nada sozinho, não precisa da API
 * do WhatsApp e não tem custo. Abre a conversa com a mensagem pronta no
 * campo de digitação, e quem envia é a pessoa, depois de ler.
 */

export interface DadosAviso {
  clienteNome: string;
  servico?: string | null;
  obra?: string | null;
  /** Nome de quem pediu, quando a demanda registra um solicitante. */
  solicitante?: string | null;
  /** Como a empresa assina a mensagem. */
  empresa?: string | null;
}

/**
 * Normaliza o telefone para o formato que o wa.me espera: só dígitos,
 * com código do país.
 *
 * Devolve null quando o número não dá para usar — melhor não abrir uma
 * conversa com o contato errado do que abrir com qualquer coisa.
 */
export function telefoneWhatsapp(bruto: string | null | undefined): string | null {
  const d = (bruto ?? '').replace(/\D/g, '');
  if (!d) return null;

  // Já veio com o 55 na frente: 55 + DDD (2) + número (8 ou 9).
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;

  // DDD + número, sem país: o caso comum do cadastro brasileiro.
  if (d.length === 10 || d.length === 11) return `55${d}`;

  // Oito ou nove dígitos é número sem DDD: não dá para adivinhar a região,
  // e chutar o DDD da gráfica mandaria mensagem para um desconhecido.
  return null;
}

/** O texto do aviso, em uma mensagem curta que cabe no WhatsApp. */
export function textoAviso(d: DadosAviso): string {
  const saudacao = d.solicitante?.trim()
    ? `Olá, ${d.solicitante.trim()}!`
    : 'Olá!';

  const oque = [d.servico?.trim(), d.obra?.trim() ? `(${d.obra.trim()})` : null]
    .filter(Boolean).join(' ');

  const corpo = oque
    ? `Seu pedido de ${oque} está pronto e já pode ser retirado.`
    : 'Seu pedido está pronto e já pode ser retirado.';

  const assinatura = d.empresa?.trim() ? `\n\n${d.empresa.trim()}` : '';

  return `${saudacao} ${corpo}${assinatura}`;
}

/**
 * Link que abre a conversa com o texto pronto, ou null quando o telefone
 * não serve. Quem chama usa o null para desabilitar o botão e explicar
 * por quê, em vez de abrir uma aba que não leva a lugar nenhum.
 */
export function linkAviso(
  telefone: string | null | undefined,
  dados: DadosAviso,
): string | null {
  const fone = telefoneWhatsapp(telefone);
  if (!fone) return null;
  return `https://wa.me/${fone}?text=${encodeURIComponent(textoAviso(dados))}`;
}
