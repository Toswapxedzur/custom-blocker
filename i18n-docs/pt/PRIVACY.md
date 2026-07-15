# Política de Privacidade – Bloqueador de Web Personalizado

_Última atualização: 13/07/2026_

Esta página explica exatamente quais dados o navegador **Custom Web Blocker**
a extensão coleta, para onde vai e por que cada permissão do navegador é
solicitada. Em resumo: não guardamos as suas regras nem os seus dados pessoais de
navegação. Regras por tag podem consultar IDs públicos de canais do YouTube, mas
essas consultas não são retidas nem associadas a você.

## Resumo

- **A configuração fica no navegador.** Grupos, horários, regras, registros,
  temporizadores e preferências são salvos apenas em `chrome.storage.local`.
- **A consulta contém somente um ID público de canal.** Não inclui URL, título,
  pesquisa, horário, conta nem configurações da extensão.
- **As consultas não são salvas.** O endpoint é somente leitura, não adiciona
  canais desconhecidos e não associa o pedido a uma pessoa.
- **Não há análise, telemetria, publicidade nem relatórios de falha.**
- **Sem rastreamento** da atividade de navegação além do estritamente necessário
  para aplicar as regras de bloqueio que você mesmo configurou.

## O que é armazenado localmente

A extensão armazena o seguinte na extensão local do seu navegador
armazenamento para que possa fazer seu trabalho entre sessões:

- Os grupos de blocos que você cria: seus nomes, tipos de regras, listas de
  sites bloqueados, programações, configurações de soneca, estado de congelamento e qualquer
  JavaScript de regra personalizada que você escreve.
- Estado de tempo de execução por grupo necessário para impor limites (por exemplo, quantos
  minutos de um orçamento com subsídio atrasado permanecem hoje, quando uma soneca
  termina, quando termina um período de congelamento estrito).
- Suas próprias preferências definidas em **Configurações** (taxa de ticks, salvamento automático
  debounce, duração padrão da soneca, URL substituto padrão, modo de depuração
  alternar, idioma da UI escolhido).
- Entradas de registro de atividades mostradas no painel **Log** do aplicativo, que você pode
  claro na interface do usuário.

Esses dados são lidos e gravados apenas pelos próprios scripts da extensão, apenas
no seu dispositivo e apenas dentro do seu próprio perfil de navegador.

## O que NÃO é coletado ou transmitido

- O histórico de navegação não é registrado, resumido ou transmitido.
- O conteúdo da página não é exfiltrado, capturado em captura de tela ou registrado.
- A entrada de formulários, senhas e informações pessoais nunca são lidas.
- Nenhuma informação sobre você, seu dispositivo ou seu uso é enviada ao
  autor da extensão ou qualquer terceiro.

## Por que cada permissão é solicitada

| Permissão | Para que é utilizado |
| --- | --- |
| `storage` | Salve e carregue seus grupos de blocos, configurações e estado de tempo de execução somente em seu navegador. |
| `favicon` | Mostra no Chromium, ao lado das regras, ícones de sites já armazenados no cache do navegador. Não envia o histórico nem faz solicitações ao nosso serviço. |
| `nativeMessaging` | Somente no Safari, encaminha solicitações da área isolada de regras personalizadas ao aplicativo local do dispositivo. Não é um transporte em nuvem. |
| `alarms` | Ative o trabalhador do serviço em segundo plano dentro do cronograma para atualizar os limites baseados em tempo e atualizar o estado da regra quando uma janela de suspensão, congelamento ou agendamento terminar. |
| `offscreen` | Execute JavaScript de regra personalizada em sandbox em um documento fora da tela para que ele não possa escapar da extensão ou tocar diretamente em suas páginas. |
| `tabs` | Abra o editor como uma guia completa ao clicar no ícone da barra de ferramentas, procure o URL da guia ativa para avaliar as regras do grupo e recarregue as guias após uma alteração de regra feita no editor. |
| `webNavigation` | Detecte alterações de URL do SPA (navegação push-state) para que ocultadores de feed por plataforma e regras orientadas a eventos possam reagir à navegação na página, e não apenas ao carregamento completo da página. |
| `<all_urls>` acesso ao host | Aplique suas regras de bloqueio e ocultadores de feed por plataforma nos sites que você decidir bloquear. A extensão lê/modifica páginas apenas em URLs para os quais você configurou ativamente uma regra e apenas para impor essa regra. |

## Regras personalizadas

Se você escrever regras JavaScript personalizadas, esse código:

- É executado em um documento fora da tela em área restrita; não pode atingir diretamente o
  rede, suas páginas ou outras extensões.
- Comunica-se com scripts de conteúdo somente através de uma ponte de mensagem fixa
  definido pela API auxiliar da extensão.
- É automaticamente colocado em quarentena (desativado com uma entrada de log) se
  excede os limites integrados de CPU, log, pós-mensagem ou mutação DOM.

Suas regras personalizadas são armazenadas localmente com o restante de suas configurações
e nunca são transmitidos pelo dispositivo.

## Estatísticas do site e do serviço de tags do criador

Esta seção é sobre o **site e o serviço de tags de criadores**. A extensão pode
consultar IDs públicos de canais em modo somente leitura; essas consultas não
são guardadas. O site publica um pequeno painel de **estatísticas**
painel e, para preenchê-lo, o servidor mantém algumas contagens agregadas:

- **Contagem de downloads** — quantas vezes o botão de download de cada produto foi acionado
  clicado (macOS, Windows, extensão do navegador, Safari).
- **Criadores classificados** — quantos criadores do YouTube foram marcados.
- **Contas** — quantas contas existem.
- **Atividade de perguntas e respostas** — o número total de postagens e comentários no fórum.

Uma vez por hora o servidor registra o valor atual de cada uma dessas contagens e
nada mais. Não há registros por evento, nem fluxos de cliques, nem sessão
história.

- **Totalmente anônimo/desidentificado.** Estes são totais simples. Eles
  **não** estão vinculados ao seu nome, conta, e-mail, endereço IP, dispositivo ou qualquer
  outro identificador – não há como atribuir uma contagem regressiva a uma pessoa.
- **Nunca comercial.** Estes dados existem apenas para mostrar as estatísticas públicas
  painel. **nunca é vendido, compartilhado com terceiros, usado para publicidade,
  ou usado para qualquer outro propósito comercial.**
- **Contribuições opcionais de ID de canal.** Se — e somente se — você aceitar, o
  extensão/website pode compartilhar **IDs de canais** do YouTube (nunca títulos de vídeos,
  assistir ao histórico ou qualquer coisa pessoal) para ajudar a classificar os criadores para todos.
- **Contribuições manuais.** Em envios voluntários de usuários autenticados, a
  associação entre e-mail e canal é mantida apenas pela janela móvel de 24 horas
  e removida pela limpeza horária.
- **Fila pública.** Pode mostrar o ID público e o estado, mas não o horário do
  envio nem quem forneceu o canal.

## Crianças

A extensão é uma ferramenta de produtividade de uso geral. Não é
direcionado a crianças, não coleta intencionalmente dados de ninguém e
não exibe publicidade.

## Mudanças nesta política

Se as práticas de dados mudarem em uma versão futura, este arquivo será
será atualizado e a mudança será resumida nas notas de versão para
esse lançamento.

## Contato

Perguntas, preocupações ou relatórios de bugs: abra um problema no
repositório de origem da extensão ou use o e-mail de suporte listado no
Listagem da Chrome Web Store.
