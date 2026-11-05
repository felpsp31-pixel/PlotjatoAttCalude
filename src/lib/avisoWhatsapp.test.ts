import { describe, it, expect } from 'vitest';
import { telefoneWhatsapp, textoAviso, linkAviso } from './avisoWhatsapp';

describe('telefoneWhatsapp', () => {
  it('poe o 55 num celular com DDD', () => {
    expect(telefoneWhatsapp('31 98888-7777')).toBe('5531988887777');
  });

  it('aceita fixo com DDD', () => {
    expect(telefoneWhatsapp('(31) 3333-4444')).toBe('553133334444');
  });

  it('nao duplica o 55 de quem ja tem', () => {
    expect(telefoneWhatsapp('+55 31 98888-7777')).toBe('5531988887777');
    expect(telefoneWhatsapp('55 31 3333-4444')).toBe('553133334444');
  });

  it('recusa numero sem DDD, em vez de chutar a regiao', () => {
    // 988887777 sem DDD poderia ser de qualquer estado: completar com o
    // DDD da gráfica mandaria o aviso para um estranho.
    expect(telefoneWhatsapp('98888-7777')).toBeNull();
    expect(telefoneWhatsapp('3333-4444')).toBeNull();
  });

  it('recusa vazio, nulo e lixo', () => {
    expect(telefoneWhatsapp('')).toBeNull();
    expect(telefoneWhatsapp(null)).toBeNull();
    expect(telefoneWhatsapp('sem telefone')).toBeNull();
  });

  it('recusa numero comprido demais', () => {
    expect(telefoneWhatsapp('5531988887777999')).toBeNull();
  });
});

describe('textoAviso', () => {
  it('usa o nome de quem pediu quando existe', () => {
    const t = textoAviso({ clienteNome: 'Corbis', solicitante: 'Rafael', servico: 'Plotagem A1' });
    expect(t).toContain('Olá, Rafael!');
    expect(t).toContain('Plotagem A1');
    expect(t).toContain('pode ser retirado');
  });

  it('sem solicitante, cumprimenta sem nome', () => {
    expect(textoAviso({ clienteNome: 'Corbis' })).toMatch(/^Olá! /);
  });

  it('inclui a obra entre parenteses', () => {
    expect(textoAviso({ clienteNome: 'C', servico: 'Plotagem A1', obra: 'Buritis' }))
      .toContain('Plotagem A1 (Buritis)');
  });

  it('funciona sem servico nem obra', () => {
    const t = textoAviso({ clienteNome: 'C' });
    expect(t).toContain('Seu pedido está pronto');
    expect(t).not.toContain('undefined');
    expect(t).not.toContain('()');
  });

  it('assina com a empresa quando informada', () => {
    expect(textoAviso({ clienteNome: 'C', empresa: 'Plotjato' })).toContain('Plotjato');
  });

  it('ignora campos que vieram em branco', () => {
    const t = textoAviso({ clienteNome: 'C', servico: '   ', obra: '', solicitante: '  ' });
    expect(t).toBe('Olá! Seu pedido está pronto e já pode ser retirado.');
  });
});

describe('linkAviso', () => {
  it('monta o link com o texto codificado', () => {
    const url = linkAviso('31 98888-7777', { clienteNome: 'C', solicitante: 'Rafael' });
    expect(url).toContain('https://wa.me/5531988887777?text=');
    // o texto tem que sobreviver à ida e volta, acento incluído
    const texto = decodeURIComponent(url!.split('text=')[1]);
    expect(texto).toContain('Olá, Rafael!');
  });

  it('devolve null quando o telefone nao serve', () => {
    expect(linkAviso('98888-7777', { clienteNome: 'C' })).toBeNull();
    expect(linkAviso(null, { clienteNome: 'C' })).toBeNull();
  });
});
