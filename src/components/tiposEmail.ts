export interface EmailRecebido {
  id: string;
  recebido_em: string;
  remetente: string;
  remetente_email: string;
  assunto: string;
  resumo: string;
  anexos: { nome?: string }[];
  link: string | null;
  motivo: string | null;
  dados: Record<string, unknown>;
}
