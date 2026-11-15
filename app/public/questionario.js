/*
 * Questionário do Novo Atendimento (passos 3 a 10).
 * Para mudar uma pergunta, altere somente este arquivo: o formulário e a ficha impressa
 * são montados a partir desta lista.
 *
 * tipos: 'radio' (uma opção), 'checks' (várias opções), 'texto' (linha), 'area' (várias linhas)
 * se: [idPergunta, valor] -> a pergunta só aparece quando a condição é verdadeira
 * alerta: true -> resposta "sim" gera aviso de atenção na tela e na ficha
 */
const SN = [['sim', 'Sim'], ['nao', 'Não']];

const QUESTIONARIO = [
  {
    n: 3, titulo: 'Casa espírita', perguntas: [
      { id: 'frequenta_casa', rotulo: 'Já frequentou ou frequenta alguma casa espírita?', tipo: 'radio', opcoes: SN },
      { id: 'frequenta_casa_qual', rotulo: 'Qual?', tipo: 'texto', se: ['frequenta_casa', 'sim'] },
    ],
  },
  {
    n: 4, titulo: 'Indicação do atendimento', perguntas: [
      {
        id: 'como_soube', rotulo: 'Como soube do tratamento espiritual?', tipo: 'radio',
        opcoes: [['indicacao', 'Indicação de alguém'], ['medico', 'Médico/terapeuta'], ['outro', 'Outro']],
      },
      { id: 'como_soube_outro', rotulo: 'Outro:', tipo: 'texto', se: ['como_soube', 'outro'] },
    ],
  },
  {
    n: 5, titulo: 'Encaminhamento', perguntas: [
      { id: 'encaminhado', rotulo: 'Foi encaminhado por alguém da Casa Espírita?', tipo: 'radio', opcoes: SN },
      { id: 'encaminhado_quem', rotulo: 'Quem?', tipo: 'texto', se: ['encaminhado', 'sim'] },
    ],
  },
  {
    n: 6, titulo: 'Culto do Evangelho no Lar', perguntas: [
      { id: 'evangelho_lar', rotulo: 'Realiza o Evangelho no Lar?', tipo: 'radio', opcoes: SN },
      {
        id: 'aceita_caravana', rotulo: 'Se não, aceita a visita da Caravana de Culto para implantação do Evangelho no Lar?',
        tipo: 'radio', opcoes: SN, se: ['evangelho_lar', 'nao'],
      },
    ],
  },
  {
    n: 7, titulo: 'Situação emocional e espiritual', perguntas: [
      {
        id: 'sentimentos', rotulo: 'Como você tem se sentido emocionalmente?', tipo: 'checks',
        opcoes: [['tranquilo', 'Tranquilo(a)'], ['ansioso', 'Ansioso(a)'], ['triste', 'Triste'], ['irritado', 'Irritado(a)'], ['desanimado', 'Desanimado(a)'], ['outro', 'Outro']],
      },
      { id: 'sentimentos_outro', rotulo: 'Outro:', tipo: 'texto', se: ['sentimentos', 'outro'] },
      {
        id: 'dificuldades', rotulo: 'Tem dificuldades com:', tipo: 'checks',
        opcoes: [['sono', 'Sono'], ['alimentacao', 'Alimentação'], ['relacionamentos', 'Relacionamentos'], ['trabalho', 'Trabalho'], ['saude', 'Saúde']],
      },
      { id: 'pensamentos_morte', rotulo: 'Já teve ou tem pensamentos de morte/suicídio?', tipo: 'radio', opcoes: SN, alerta: true },
      {
        id: 'pensamentos_compartilhar', rotulo: 'Se sim, deseja compartilhar essa experiência no Atendimento Fraterno?',
        tipo: 'area', se: ['pensamentos_morte', 'sim'],
      },
    ],
  },
  {
    n: 8, titulo: 'Saúde física e uso de medicamentos', perguntas: [
      { id: 'condicao_saude', rotulo: 'Tem alguma condição de saúde diagnosticada?', tipo: 'radio', opcoes: SN },
      { id: 'condicao_saude_qual', rotulo: 'Qual?', tipo: 'texto', se: ['condicao_saude', 'sim'] },
      { id: 'medicamentos', rotulo: 'Faz uso de medicamentos?', tipo: 'radio', opcoes: SN },
      { id: 'medicamentos_qual', rotulo: 'Qual?', tipo: 'texto', se: ['medicamentos', 'sim'] },
      { id: 'tratamento', rotulo: 'Está fazendo tratamento médico/psicológico?', tipo: 'radio', opcoes: SN },
      { id: 'tratamento_qual', rotulo: 'Qual?', tipo: 'texto', se: ['tratamento', 'sim'] },
      { id: 'vicios', rotulo: 'Vícios:', tipo: 'radio', opcoes: SN },
      { id: 'vicios_qual', rotulo: 'Qual?', tipo: 'texto', se: ['vicios', 'sim'] },
    ],
  },
  {
    n: 9, titulo: 'Percepções espirituais e obsessão', perguntas: [
      {
        id: 'influencia', rotulo: 'Sente que pode estar sofrendo influência espiritual negativa?', tipo: 'radio',
        opcoes: [['sim', 'Sim'], ['nao', 'Não'], ['nao_sabe', 'Não sabe dizer']],
      },
      {
        id: 'sensacoes', rotulo: 'Já teve sensações como:', tipo: 'checks', colunas: 2,
        opcoes: [
          ['presenca', 'Presença de espíritos'],
          ['vozes', 'Vozes ou pensamentos estranhos à sua vontade'],
          ['medo', 'Sensações de medo sem causa aparente'],
          ['humor', 'Alterações bruscas de humor ou comportamento'],
          ['fisicas', 'Sensações físicas sem causa médica identificada'],
          ['pesadelos', 'Pesadelos recorrentes ou sonhos perturbadores'],
          ['outro', 'Outro'],
        ],
      },
      { id: 'sensacoes_outro', rotulo: 'Outro:', tipo: 'texto', se: ['sensacoes', 'outro'] },
      { id: 'desobsessao', rotulo: 'Já participou ou está participando de atendimento de desobsessão?', tipo: 'radio', opcoes: SN },
    ],
  },
  {
    n: 10, titulo: 'Histórico espiritual', perguntas: [
      { id: 'reunioes_mediunicas', rotulo: 'Já participou de reuniões mediúnicas?', tipo: 'radio', opcoes: SN },
      {
        id: 'reunioes_como', rotulo: 'Como?', tipo: 'checks', se: ['reunioes_mediunicas', 'sim'],
        opcoes: [['participante', 'Participante'], ['assistido', 'Assistido']],
      },
      { id: 'experiencias_mediunicas', rotulo: 'Tem ou já teve experiências mediúnicas (sensações, visões, sonhos, etc)?', tipo: 'radio', opcoes: SN },
      { id: 'experiencias_mediunicas_qual', rotulo: 'Quais?', tipo: 'texto', se: ['experiencias_mediunicas', 'sim'] },
    ],
  },
];

/** Verifica se a pergunta deve aparecer, considerando as respostas atuais. */
function perguntaVisivel(p, respostas) {
  if (!p.se) return true;
  const [id, valor] = p.se;
  const r = respostas[id];
  return Array.isArray(r) ? r.includes(valor) : r === valor;
}
