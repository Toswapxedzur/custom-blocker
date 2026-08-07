# Política de Privacidade – Bloqueador de Web Personalizado

_Última atualização: 04/08/2026_

Esta página explica exatamente quais dados a extensão de navegador **Bloqueador de Web Personalizado** coleta, para onde eles vão e por que cada permissão do navegador é solicitada. Em resumo: não guardamos suas regras nem seus dados de navegação pessoais. A coleta e a classificação opcionais do Vault Classifier permanecem sob seu controle e usam a ponte local autenticada. Uma integração opcional e separada de IA local (MCP) também fica desativada por padrão e só expõe dados a um assistente que você mesmo conecte e aprove.

## Resumo

- **Sua configuração permanece no seu navegador.** Grupos de bloqueio, agendamentos, regras personalizadas, registros, temporizadores e preferências são salvos apenas no armazenamento local da extensão do Chrome (`chrome.storage.local`).
- **O Vault Classifier é apenas local.** Se você ativar explicitamente a integração opcional com o Vault Classifier, os elementos visíveis de cards/páginas do YouTube (como um título, a descrição visível, as tags exibidas e os IDs públicos de criador/vídeo) são encaminhados apenas pela ponte local autenticada do Vault para o Vault Classifier no seu Mac. Eles não são enviados ao nosso site, a um provedor de modelos, à API de Dados do YouTube nem a qualquer outro servidor.
- **A coleta é um consentimento separado (opt-in).** O Vault Classifier só pede à extensão metadados do YouTube renderizados e sem anúncios depois que você ativa a coleta do YouTube no espaço de trabalho de dados de classificação dele. Quando está desativada, a extensão não envia nenhum título ou metadado de criador para coleta. Quando está ativada, os campos locais retidos podem incluir um título visível, o nome/identificador do criador, o tipo de vídeo, a duração, o texto visível de inscritos/visualizações/data de publicação e a URL canônica.
- **Integração opcional de IA local (MCP).** Se você ativá-la e conectar seu próprio assistente de IA, esse assistente pode — sob sua orientação explícita — ler dados selecionados (sua configuração, atividade, tempo de uso, as URLs das guias ativas/abertas, o conteúdo visível das páginas nos sites que você configurou e quaisquer evidências do Classifier) por meio de um servidor local do Vault no seu dispositivo. Ela fica desativada por padrão, cada conexão é aprovada por você, e senhas e chaves de API nunca são legíveis por meio dela. Consulte "Integração opcional de IA local (MCP)" mais abaixo.
- **Não há análise, perfil de publicidade, telemetria nem relatório de falhas.**
- **Sem rastreamento** da atividade de navegação além do estritamente necessário para aplicar as regras de bloqueio que você mesmo configurou.

## O que é armazenado localmente

A extensão armazena o seguinte no armazenamento local da extensão do seu navegador para poder funcionar entre sessões:

- Os grupos de bloqueio que você cria: seus nomes, tipos de regra, listas de sites bloqueados, agendamentos, configurações de soneca (snooze), estado de congelamento e qualquer JavaScript de regra personalizada que você escrever.
- O estado de execução por grupo necessário para aplicar limites (por exemplo, quantos minutos de um orçamento de permissão adiada restam hoje, quando uma soneca termina, quando um período de congelamento estrito termina).
- Suas próprias preferências definidas em **Configurações** (frequência de atualização, atraso do salvamento automático, duração padrão da soneca, URL de fallback padrão, alternância do modo de depuração, idioma de interface escolhido).
- As entradas do registro de atividade exibidas no painel **Registro** do aplicativo, que você pode limpar pela interface.
- Quando você ativa explicitamente o Vault Classifier, o aplicativo local dele mantém um cache local, limitado pelo usuário, das evidências visíveis, pontuações locais, decisões e correções necessárias para classificar e explicar entradas. Esse cache permanece no seu Mac e não faz parte do tráfego normal entre a extensão e o servidor.

Sua configuração, o estado de execução e o registro de atividade permanecem no seu dispositivo e não são salvos pelo nosso serviço. Dependendo da versão do navegador e dos recursos que você ativar, eles podem ser processados pela extensão, pelo aplicativo complementar local do Safari ou por uma ponte local do Vault explicitamente vinculada.

## O que NÃO é coletado nem transmitido

Isto descreve como a extensão se comporta por conta própria. A única exceção é a integração opcional de IA local (MCP) que você pode ativar e conectar, descrita na seção seguinte.

- O histórico de navegação não é registrado, resumido nem transmitido pela própria extensão; ele é usado apenas para aplicar as regras que você configurou.
- O conteúdo das páginas não é exfiltrado, nem capturado em tela, nem registrado pela própria extensão.
- As evidências do Vault Classifier não são transmitidas para fora do dispositivo pela extensão. Elas são processadas pela ponte local pareada e pelo aplicativo apenas quando você ativa explicitamente essa integração.
- As entradas de formulários e as senhas nunca são lidas pela extensão; as senhas e as chaves de API também não são legíveis pela integração de IA local (MCP).
- Nenhum identificador de extensão, de conta ou de dispositivo, nem a sua configuração de regras, é transmitido para a aplicação normal das regras.

## Integração opcional de IA local (MCP)

A extensão pode, opcionalmente, responder a solicitações de um **servidor MCP do Vault** local em execução dentro dos aplicativos de desktop do Vault no seu próprio dispositivo, para que você possa conectar seu próprio assistente de IA (um "cliente MCP") e fazer com que ele leia ou atue sobre a sua configuração do Vault por você. Essa integração fica **desativada por padrão** e não muda nada, a menos que você a ative deliberadamente.

- **Você a inicia.** Nada é exposto até você ativar a integração e conectar um cliente MCP, e cada conexão de cliente é aprovada por você. Desativá-la revoga o acesso imediatamente.
- **O servidor é local.** Os dados fornecidos pela extensão são entregues, pela mesma ponte autenticada do dispositivo, a um servidor MCP do Vault no seu Mac — não ao nosso site nem a qualquer servidor do Vault. A própria extensão não envia seus dados a terceiros.
- **Depois quem decide é o seu assistente.** Assim que um cliente MCP conectado recebe dados a seu pedido, o que acontece com eles é regido por **esse cliente** e pelos termos de privacidade dele. Se o assistente que você escolheu se apoiar em um serviço remoto, esse assistente pode transmitir seus dados sob sua orientação — assim como quando você cola informações em qualquer ferramenta de IA. Escolha um cliente em que você confie.
- **O que pode ser exposto.** Sob sua orientação, um assistente conectado pode ler seus grupos de bloqueio, agendamentos, regras personalizadas, o registro de atividade, os contadores de tempo de uso, a URL da guia ativa ou das guias abertas, o conteúdo visível das páginas nos sites que você configurou e quaisquer evidências e decisões do Vault Classifier. As ações que alteram o estado (editar grupos, iniciar uma soneca, executar uma regra salva, disparar uma classificação) são confirmadas individualmente.
- **Os segredos continuam secretos.** As senhas (como uma senha de controle parental) e as chaves de API de provedores são de **somente gravação** por meio dessa integração: elas podem ser definidas, mas nunca podem ser lidas de volta por nenhum assistente.
- **Somente Chromium.** Assim como a ponte do Classifier, essa integração existe apenas em navegadores Chromium com o host local do dispositivo; o Firefox e o Safari não a expõem.

## Por que cada permissão é solicitada

| Permissão | Para que é usada |
| --- | --- |
| `storage` | Salvar e carregar seus grupos de bloqueio, configurações e estado de execução apenas no seu navegador. |
| `favicon` | Mostrar, ao lado das regras, os ícones de sites em cache do navegador no Chromium. Isso não envia o histórico de navegação nem faz solicitações ao nosso serviço. |
| `nativeMessaging` | No Chromium, solicitar ao dispositivo uma prova de Native Messaging local para a ponte autenticada do Vault Classifier; no Safari, encaminhar as solicitações do ambiente isolado de regras personalizadas para o aplicativo contêiner local do dispositivo. Não é um transporte na nuvem. |
| `alarms` | Acordar o service worker em segundo plano conforme o agendamento para atualizar os limites baseados em tempo e o estado das regras quando uma janela de soneca, congelamento ou agendamento termina. |
| `offscreen` | Executar o JavaScript de regras personalizadas em um ambiente isolado, em um documento fora da tela, para que ele não possa escapar da extensão nem tocar diretamente nas suas páginas. |
| `tabs` | Abrir o editor como uma guia completa quando você clica no ícone da barra de ferramentas, consultar a URL da guia ativa para avaliar as regras de grupo e recarregar as guias após uma alteração de regra feita por você no editor. |
| `webNavigation` | Detectar mudanças de URL de SPA (navegação por push-state) para que os ocultadores de feeds por plataforma e as regras baseadas em eventos possam reagir à navegação dentro da página, e não apenas aos carregamentos de página completos. |
| Acesso de host `<all_urls>` | Aplicar suas regras de bloqueio e os ocultadores de feeds por plataforma nos sites que você escolher bloquear. A extensão lê/modifica páginas apenas nas URLs para as quais você configurou ativamente uma regra e apenas para aplicar essa regra; o adaptador opcional do Vault Classifier é restrito ao YouTube. |

## Regras personalizadas

Se você escrever regras JavaScript personalizadas, esse código:

- É executado em um documento fora da tela em ambiente isolado; ele não pode alcançar diretamente a rede, suas páginas ou outras extensões.
- Comunica-se com os scripts de conteúdo apenas por uma ponte de mensagens fixa definida pela API auxiliar da extensão.
- É automaticamente colocado em quarentena (desativado com uma entrada de registro) se exceder os limites integrados de CPU, de registro, de mensagens (post-message) ou de mutações do DOM.

Suas regras personalizadas são armazenadas localmente junto com o restante das suas configurações e nunca são transmitidas para fora do dispositivo.

## Estatísticas do site

Esta seção é sobre o **site**. O site publica um pequeno painel de **Estatísticas** e, para preenchê-lo, o servidor mantém alguns totais agregados:

- **Contagens de downloads** — quantas vezes o botão de download de cada produto foi clicado (macOS, Windows, extensão de navegador, Safari).
- **Contas** — quantas contas existem.
- **Atividade de perguntas e respostas** — o número total de publicações e comentários do fórum.

Uma vez por hora, o servidor registra o valor atual de cada total agregado. Esses instantâneos não contêm nenhum evento por visitante, sequência de cliques nem histórico de sessão.

- **Totalmente anônimo / desidentificado.** São simples totais acumulados. Eles **não** estão vinculados ao seu nome, conta, e-mail, endereço IP, dispositivo ou qualquer outro identificador — não há como atribuir uma contagem a uma pessoa.
- **Nunca comercial.** Esses dados existem apenas para mostrar o painel público de Estatísticas. Eles **nunca são vendidos, compartilhados com terceiros, usados para publicidade ou para qualquer outra finalidade comercial.**

## Crianças

A extensão é uma ferramenta de produtividade de uso geral. Ela não é direcionada a crianças, não coleta conscientemente dados de ninguém e não exibe publicidade.

## Alterações a esta política

Se as práticas de dados mudarem em uma versão futura, este arquivo será atualizado e a mudança será resumida nas notas de versão daquela publicação.

## Contato

Perguntas, dúvidas ou relatórios de bugs: abra uma issue no repositório de origem da extensão ou use o e-mail de suporte indicado na página da Chrome Web Store.
