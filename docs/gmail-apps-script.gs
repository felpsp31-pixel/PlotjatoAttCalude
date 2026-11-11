/**
 * Plotjato Controle — leitura da caixa de entrada
 *
 * Roda dentro da conta do Gmail da empresa e envia os e-mails recentes para o
 * sistema, que classifica cada um (cobrança, pedido de serviço ou propaganda).
 * Nada é lançado automaticamente: cobranças e pedidos ficam na fila "a revisar"
 * dentro do sistema, e propaganda é descartada na classificação.
 *
 * Como instalar:
 *  1. Abra script.google.com com a conta da empresa e crie um novo projeto.
 *  2. Apague o conteúdo do editor e cole este arquivo inteiro.
 *  3. Em SEGREDO, cole o segredo que o Claude te enviou.
 *  4. Salve, escolha a função "enviarEmails" e clique em Executar.
 *     O Google vai pedir autorização: aceite (é a sua própria conta).
 *  5. Rode "instalarGatilho" uma vez: a partir daí roda sozinho a cada 5 min.
 *
 * Só envia e-mails recebidos a partir da primeira execução: o que chegou antes
 * fica de fora. Para recomeçar a contar de agora (por exemplo, depois de limpar
 * a fila), rode "recomecarDeAgora".
 *
 * Para parar: rode "removerGatilho", ou apague o projeto.
 */

var URL_SISTEMA = 'https://nxtfhrsrjqpejdmtjirt.supabase.co/functions/v1/receber-email';
var SEGREDO = 'COLE_AQUI_O_SEGREDO';

// O que ler. Exclui as abas Promoções e Social do Gmail, que é onde cai a
// maior parte da propaganda — o resto a IA separa. Para ler só o que tiver
// uma etiqueta, troque por: 'label:sistema newer_than:2d'
var BUSCA = 'in:inbox -category:promotions -category:social newer_than:2d';

// Teto por execução, para não estourar o tempo do Apps Script.
var MAX_MENSAGENS = 40;

// PDFs anexados vão junto, para o sistema ler o boleto ou a nota fiscal.
// No máximo 2 por e-mail e 4 MB no total, para o envio não ficar pesado.
var MAX_PDFS = 2;
var MAX_PDF_TOTAL = 4 * 1024 * 1024;

/**
 * Momento a partir do qual os e-mails contam. Gravado na primeira execução,
 * para que o histórico da caixa não entre no sistema de uma vez.
 */
function marcoInicial() {
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty('INICIO');
  if (!v) {
    v = String(Date.now());
    props.setProperty('INICIO', v);
    Logger.log('Marco inicial gravado: ' + new Date(Number(v)));
  }
  return Number(v);
}

function recomecarDeAgora() {
  PropertiesService.getScriptProperties().setProperty('INICIO', String(Date.now()));
  Logger.log('A partir de agora, só e-mails novos.');
}

function enviarEmails() {
  if (SEGREDO === 'COLE_AQUI_O_SEGREDO') {
    throw new Error('Preencha a variável SEGREDO antes de rodar.');
  }

  var inicio = marcoInicial();
  var conversas = GmailApp.search(BUSCA, 0, 50);
  var enviados = 0, repetidos = 0, erros = 0;

  for (var i = 0; i < conversas.length && enviados + repetidos < MAX_MENSAGENS; i++) {
    var mensagens = conversas[i].getMessages();
    for (var j = 0; j < mensagens.length && enviados + repetidos < MAX_MENSAGENS; j++) {
      var m = mensagens[j];
      if (m.getDate().getTime() < inicio) continue;  // anterior à implantação
      // O sistema recusa repetidos pelo id, então não precisamos guardar estado
      // aqui: um e-mail já enviado volta como "duplicado" sem custo de IA.
      var resposta = enviarUma(m);
      if (resposta === 'duplicado') repetidos++;
      else if (resposta === 'erro') erros++;
      else enviados++;
    }
  }

  Logger.log('Novos: ' + enviados + ' | já conhecidos: ' + repetidos + ' | erros: ' + erros);
}

function enviarUma(m) {
  var de = m.getFrom();                       // "Nome <email@dominio>"
  var email = (de.match(/<(.+?)>/) || [null, de])[1].trim().toLowerCase();
  var nome = de.replace(/<.*>/, '').replace(/"/g, '').trim() || email;

  var anexos = [];
  var arquivos = [];
  var somaPdf = 0;
  var lista = m.getAttachments({ includeInlineImages: false });
  for (var k = 0; k < lista.length && k < 20; k++) {
    var at = lista[k];
    anexos.push({ nome: at.getName(), tamanho: at.getSize() });
    var ehPdf = at.getContentType() === 'application/pdf' ||
      at.getName().toLowerCase().indexOf('.pdf') === at.getName().length - 4;
    if (ehPdf && arquivos.length < MAX_PDFS && somaPdf + at.getSize() <= MAX_PDF_TOTAL) {
      arquivos.push({ nome: at.getName(), dados: Utilities.base64Encode(at.getBytes()) });
      somaPdf += at.getSize();
    }
  }

  var corpo = m.getPlainBody() || '';
  if (corpo.length > 6000) corpo = corpo.substring(0, 6000);

  var dados = {
    gmail_id: m.getId(),
    de: email,
    nome: nome,
    assunto: m.getSubject() || '',
    corpo: corpo,
    recebido_em: m.getDate().toISOString(),
    anexos: anexos,
    arquivos: arquivos,
    link: 'https://mail.google.com/mail/u/0/#all/' + m.getId()
  };

  try {
    var r = UrlFetchApp.fetch(URL_SISTEMA, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-email-secret': SEGREDO },
      payload: JSON.stringify(dados),
      muteHttpExceptions: true
    });
    var texto = r.getContentText();
    if (r.getResponseCode() !== 200) {
      Logger.log('Erro ' + r.getResponseCode() + ' em "' + dados.assunto + '": ' + texto);
      return 'erro';
    }
    return texto.indexOf('"duplicado":true') >= 0 ? 'duplicado' : 'ok';
  } catch (e) {
    Logger.log('Falha de rede em "' + dados.assunto + '": ' + e);
    return 'erro';
  }
}

function instalarGatilho() {
  removerGatilho();
  ScriptApp.newTrigger('enviarEmails').timeBased().everyMinutes(5).create();
  Logger.log('Pronto: roda a cada 5 minutos.');
}

function removerGatilho() {
  var gatilhos = ScriptApp.getProjectTriggers();
  for (var i = 0; i < gatilhos.length; i++) {
    if (gatilhos[i].getHandlerFunction() === 'enviarEmails') ScriptApp.deleteTrigger(gatilhos[i]);
  }
}
