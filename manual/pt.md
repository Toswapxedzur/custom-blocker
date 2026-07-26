# Referência funcional da extensão do Vault

## Objetivo e status

Esta é a especificação funcional oficial para a extensão do navegador Vault. Ele documenta o contrato do produto: os dados que um usuário pode configurar, os comportamentos exatos que a configuração produz, a linguagem pública da regra personalizada e os limites que se aplicam a ela.

Deliberadamente, não é um guia de início rápido. O tutorial do site é o caminho de aprendizagem. Este documento é destinado a pessoas que precisam configurar, testar, manter, auditar ou reproduzir o comportamento visível ao usuário do Vault.

O código é a verdade canônica quando este documento e o produto discordam. Os nomes neste documento usam o vocabulário armazenado/público do produto quando for prático. Uma palavra como "retornos" significa o valor de retorno disponibilizado para uma regra personalizada; ele não promete um resultado no nível do navegador se o navegador ou a página recusar a ação solicitada.

## 1. Limite do produto

Vault é uma WebExtension de controle de foco. Sua unidade de configuração é um **grupo de blocos**. Um grupo pode:

- decidir que um site de nível superior, página de plataforma, criador, comunidade, servidor, canal ou conta deve ser bloqueado;
- ocultar superfícies de plataforma configuradas ou cartões de alimentação correspondentes;
- medir o tempo gasto em um escopo correspondente;
- aplicar uma programação, proteção contra congelamento ou suspensão temporária onde esse tipo de grupo suportar;
- execute uma regra JavaScript personalizada com uma API de eventos;
- mostrar um cronômetro, painel, mensagem ou registro de página na página;
- redirecionar, navegar, fechar uma guia do navegador ou manter uma lista de bloqueio de sites criada por regras somente de sessão;
- opcionalmente participar de um cluster de ponte do Vault conectado localmente.

O Vault atua apenas dentro do perfil do navegador onde está instalado e somente onde o navegador permite a execução do script de conteúdo. Não:

- instalar um aplicativo nativo ou extensão de navegador;
- bloquear aplicativos do sistema operacional;
- ignorar solicitações de permissão do navegador, restrições de navegação privada ou o próprio modelo de segurança de um site;
- garantir ocultação baseada em seletor quando uma plataforma de terceiros altera seu DOM;
- tornar o estado da regra personalizada portátil entre perfis, a menos que o usuário o exporte/configure separadamente;
- fornecer um firewall de rede, um proxy, controle de conta ou um serviço de monitoramento parental.

A seguinte terminologia é usada em todo o texto:

| Prazo | Significado |
| --- | --- |
| Grupo | Um objeto de configuração nomeado independentemente. Os nomes devem ser exclusivos na extensão, ignorando maiúsculas e minúsculas. |
| Grupo de sites | Um grupo normal cuja lista de domínios é sua principal condição de correspondência. |
| Grupo de plataforma | Um grupo normal especializado em YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord ou Twitter/X. |
| Grupo personalizado | Um grupo que possui uma regra JavaScript e seus registros de eventos. Sua regra decide seu comportamento. |
| Partida | A página, o item de feed ou a superfície da plataforma satisfazem as condições configuradas de um grupo. |
| Ativo | O grupo está ativado, qualificado para sua programação e não adiado no momento. Os grupos personalizados não são controlados pela IU de agendamento normal. |
| Bloco | Impedir que a página de nível superior atual permaneça utilizável, normalmente redirecionando para seu destino substituto. |
| Ocultar | Remova ou oculte um elemento/cartão na página atualmente renderizada. Esconder-se não é um bloqueio de rede. |
| URL substituto | Um alvo de redirecionamento específico do grupo. Se estiver em branco, o substituto global será usado. |
| Efeito de permissão/exceção | Um veredicto de cartão de plataforma que resgata conteúdo correspondente de regras de ocultação de prioridade mais baixa. Não é uma lista geral de permissões de sites. |

## 2. Modelo de grupo e ciclo de vida comum

Cada grupo armazenado possui um ID estável, um nome, um tipo, um sinalizador habilitado e campos de política comuns. Um novo grupo normal é habilitado por padrão. Um grupo pode ser selecionado, salvo pelo comportamento de salvamento automático do editor, reordenado, exportado, importado, congelado, descongelado, adiado, desativado ou excluído.

### 2.1 Ordenação e sobreposição

Mais de um grupo pode corresponder à mesma página. O Vault avalia os grupos armazenados do final da lista exibida até o início. Trate os itens inferiores na lista como correspondências de precedência posterior/maior ao projetar regras sobrepostas.

Para o bloqueio comum de sites de nível superior, qualquer grupo de bloqueio aplicável pode tornar a página indisponível. Para filtragem de cartão de alimentação, a cascata da plataforma usa a ordem e o efeito de cada grupo correspondente: uma permissão/exceção de correspondência posterior pode resgatar um item de predicados de bloqueio de prioridade mais baixa. Esse comportamento de exceção é limitado à superfície de filtragem da placa de plataforma; isso não desfaz um bloqueio normal de site de página inteira.

### 2.2 Estado ativado

Os grupos desativados são retidos, mas não participam da correspondência normal, dos cronômetros, das programações ou das operações normais de soneca. Desabilitar um grupo Personalizado também descarrega seus registros ativos. A reativação não transforma o texto não salvo em uma regra personalizada ativa; execute a regra para carregar a fonte salva.

### 2.3 Campos comuns

| Campo | Significado e restrições |
| --- | --- |
| Nome | Não vazio, cortado e exclusivo, sem distinção entre maiúsculas e minúsculas neste endpoint. A ponte também identifica grupos vinculáveis ​​por nome e tipo, portanto, nomes estáveis ​​são importantes. |
| Habilitado | Ativa ou desativa a correspondência normal. |
| Comportamento | Bloqueio instantâneo, bloqueio após uma permissão ou cronômetro/contagem progressiva. Os grupos personalizados usam suas próprias regras em vez desse seletor de comportamento normal. |
| Minutos permitidos | Número positivo usado pelo comportamento de bloqueio após permissão. O padrão dos novos grupos é de 15 minutos. |
| Redefinir horas de intervalo | Número positivo usado por grupos normais cronometrados. O padrão dos novos grupos é 24 horas. |
| Dias ativos | De segunda a domingo. Um grupo normal fica inativo quando o dia da semana local atual não está selecionado. |
| Janelas de tempo | Zero ou mais janelas de horário local, uma por linha, escritas como HHMM-HHMM. |
| Modo congelar | Nenhum, Congelado, Congelado estrito ou Congelado parental. |
| Política de soneca | Se o grupo permite soneca, com controles de duração/atraso/recarga/confirmação para grupos normais. |
| URL substituto | Destino usado se o grupo bloquear uma página. |
| Pular para o próximo | Quando fornecido no editor, solicita que o fluxo de bloqueio normal passe pelo alvo bloqueado em vez de permanecer nele. |

### 2.4 Comportamentos normais de grupo

O editor normal oferece três comportamentos:

| Comportamento | Resultado funcional |
| --- | --- |
| Bloquear imediatamente | Assim que o grupo estiver ativo e corresponder, a decisão normal de bloqueio de página é imediata. |
| Bloquear após alguns minutos | O tempo de página visível correspondente é acumulado para o limite configurado. Quando o limite se esgota, o grupo normal é bloqueado até que seu período de uso seja redefinido ou o grupo fique inativo/adiado. |
| Temporizador (contagem progressiva, sem bloqueio) | O tempo de página visível correspondente é registrado e pode ser exibido. Este modo nunca bloqueia simplesmente porque seu temporizador atinge um valor. |

O uso cronometrado é baseado no tempo da página visível. Não se destina a cobrar tempo enquanto uma página está oculta em uma guia em segundo plano. O intervalo de redefinição é um intervalo de política contínuo para o grupo cronometrado normal. Os temporizadores normais são independentes por grupo.

### 2.5 Programações

Os horários aplicam-se a grupos normais. Um grupo personalizado não tem UI de agendamento normal e é considerado ativo para fins de seu JavaScript; a regra deve impor ela mesma qualquer condição de tempo desejada.

A política de dia ativo é avaliada usando a hora local:

1. Se o dia da semana atual não for selecionado, o grupo normal fica inativo.
2. Se nenhuma janela de horário válida for fornecida, um dia ativo significa o dia inteiro.
3. Se forem fornecidas janelas válidas, a hora local atual deverá estar em pelo menos uma janela.

Cada janela tem o formato exato HHMM-HHMM, por exemplo 0900-1200. O horário deve ser de 00 a 23, o minuto de 00 a 59, e o início deve ser antes do término no mesmo dia. Uma janela inclui o seu início e exclui o seu fim. Janelas que passam da meia-noite, como 2300-0100, não são válidas. As linhas vazias são ignoradas e as janelas duplicadas são recolhidas.

### 2.6 Soneca

Para um grupo normal, a soneca é um estado inativo temporário com até três fases:

| Fase | Resultado |
| --- | --- |
| Pendente | A soneca solicitada existe, mas não foi iniciada devido ao atraso de ativação. O grupo ainda está ativo. |
| Ativo | O grupo fica temporariamente inativo durante a soneca. |
| Recarga | A soneca terminou, o grupo está ativo novamente e outra soneca não pode ser iniciada até que o tempo de espera expire. |

Os campos de configuração de grupo normal são:

| Campo | Regra |
| --- | --- |
| Permitir soneca | Se estiver desativado, a soneca normal não poderá ser iniciada. |
| Duração da soneca | Minutos positivos. Um novo grupo normal assume o padrão global, inicialmente 30. |
| Atraso de ativação | Zero ou mais minutos. Em branco significa zero. |
| Recarga | Zero a cinco minutos. Em branco significa zero. |
| Confirmações | Um número inteiro não negativo. O produto requer muitas interações de confirmação antes de atender à solicitação. |

Um grupo Personalizado trata o botão Suspender apenas como um evento de entrada. O Vault emite o evento personalizado denominado snoozePress para esse grupo; ele não aplica o fallback normal de duração/atraso/recarga em nome da regra. Uma regra personalizada pode usar o evento, sua própria persistência, um painel, um cronômetro ou nenhuma ação.

### 2.7 Congelar

O congelamento protege um grupo contra alterações normais de configuração e alterações normais de suspensão. Escolher um modo de congelamento no seletor não congela o grupo por si só; a ação de congelamento aplica o modo escolhido.

| Modo | Contrato funcional |
| --- | --- |
| Congelado | O grupo fica bloqueado até que o fluxo normal de confirmação de descongelamento do produto seja concluído. |
| Estrito congelado | O grupo não pode ser descongelado até que a duração do congelamento total tenha decorrido. A duração deve ser superior a zero e não superior a 72 horas; um novo grupo tem como padrão 24 horas. |
| Parental congelado | É necessária uma senha de responsável para o gerenciamento de congelamento/descongelamento. A caixa de diálogo de configuração usa uma senha de seis dígitos. |

Grupos congelados não podem ser editados através de campos comuns. Um cluster vinculado a uma ponte com um membro offline também pode bloquear controles de congelamento porque o Vault não pode coordenar com segurança o estado congelado no cluster. Freeze é uma proteção contra operações normais da UI; não transforma um perfil de navegador em um limite de segurança imutável.

### 2.8 Importar, exportar, limpar e redefinir

A exportação produz uma representação compatível do grupo selecionado. A importação valida e normaliza os dados do grupo compatível antes de adicioná-los. Os nomes dos grupos importados ainda devem ser exclusivos. Excluir grupo remove esse grupo e seu estado normal de uso/soneca. Limpar remove todos os grupos após a confirmação.

A redefinição para os padrões é uma operação de **configurações globais**. Descarta as preferências de toda a extensão; não é um substituto de importação/exportação e deve ser tratado como destrutivo.

## 3. Tipos de grupo e contrato correspondente

### 3.1 Grupo de sites padrão

Um grupo de sites possui uma lista de sites separados por linhas. As entradas são normalizadas no formato host/domínio. Uma entrada de host corresponde a esse host e a todos os seus subdomínios.

| Configuração | Resultado |
| --- | --- |
| Bloqueie tudo, exceto esses sites | A lista é uma lista de bloqueio. Um host correspondente está bloqueado. |
| Bloqueie tudo, exceto esses sites em | A lista é uma lista de permissões. Todo host que não estiver na lista será bloqueado. Uma lista de permissões vazia é, portanto, um bloqueio intencional de toda a web. |
| Bloquear página inicial | Aplica a política do grupo à superfície inicial/inicial do navegador configurada onde esse controle está disponível. |
| URL substituto | Redirecionar destino para um bloco. Um valor de grupo em branco retorna ao padrão global. |

A lista normal de domínios do grupo de sites é a única lista declarativa de todo o site exposta pelo editor. Os grupos de plataformas correspondem à sua própria plataforma e às condições de plataforma configuradas.

### 3.2 Grupos de plataforma de vídeo

YouTube, TikTok, Facebook, Instagram e Twitch são grupos de plataformas de vídeo. Cada um está limitado ao seu próprio host de plataforma. Um grupo pode ter como alvo o formulário de conteúdo, o escopo do autor/conta, o feed inicial da plataforma e controles opcionais de ocultar elementos.

Os modos de autor geral são:

| Modo | Resultado |
| --- | --- |
| Todos | Não restrinja por autor; outros eixos configurados decidem a partida. |
| Incluir | Corresponda apenas aos criadores/contas normalizados listados. |
| Excluir | Combine todos os criadores/contas detectados, exceto as entradas listadas. |
| Ninguém | Não corresponda a nenhum autor. Este é um eixo de autor deliberado e sem correspondência. |
| A etiqueta inclui | Combine os criadores com qualquer tag listada quando o Vault puder classificá-los. Criadores desconhecidos/não classificados falham ao abrir. |
| Excluir etiqueta | Combine criadores sem as tags configuradas quando o Vault puder classificá-los. Criadores desconhecidos/não classificados falham ao abrir. |

As opções de formato de conteúdo são específicas da plataforma:

| Plataforma | Formulários de conteúdo |
| --- | --- |
| YouTube | Todas as páginas, Shorts, vídeos longos, postagens. |
| TikTok | Todas as páginas, vídeos curtos. |
| Facebook | Todas as páginas, Momentos, vídeos, postagens. |
| Instagram | Todas as páginas, Momentos, vídeos, postagens. |
| Contração muscular | Todas as páginas, clipes, streams/VODs, páginas de canais. |

O Vault normaliza a entrada do autor. O editor aceita o formato normal de identificador/canal/página da plataforma e URLs de perfil suportados. Ele pode rejeitar entradas malformadas ou mostrá-las como inválidas, em vez de transformá-las silenciosamente em um alvo diferente.

As opções de ocultação da superfície são independentes do bloqueio de nível superior. Eles afetam apenas a IU da plataforma atual e podem parar de funcionar quando a plataforma altera sua marcação.

| Plataforma | Opções de elementos de ocultação enviadas |
| --- | --- |
| YouTube | Navegação/estantes/cartões de shorts, superfícies promovidas/de anúncios no feed inicial e comentários. A opção relacionada a anúncios apresenta um aviso porque ocultar anúncios pode entrar em conflito com os termos da plataforma. |
| TikTok | Explorar a navegação. |
| Facebook | Navegação dos carretéis e superfícies dos carretéis. |
| Instagram | Momentos e exploração de navegação/superfícies. |
| Contração muscular | Navegar na navegação. |

A correspondência da tag do criador do YouTube usa classificações de canais locais/disponíveis. Uma classificação ausente não se torna um bloco apenas porque um modo de tag foi selecionado.

###3.3 Reddit

Um grupo do Reddit se aplica apenas ao Reddit. Sua entidade é um subreddit. A entrada do subreddit aceita o formato comum da comunidade e o normaliza antes da correspondência.

Os modos do subreddit são:

| Modo | Resultado |
| --- | --- |
| Todos | Inscreva-se no Reddit sem restrição de lista de subreddit. |
| Incluir | Inscreva-se nos subreddits listados. |
| Excluir | Aplica-se a todos, exceto aos subreddits listados. |
| Ninguém | Não se inscreva em nenhum subreddit. |

A opção de ocultar superfície fornecida oculta a navegação Popular/Todas. O comportamento do cartão de alimentação depende da estrutura de cartão atualmente detectável do Reddit.

### 3.4 Discordância

Um grupo Discord se aplica apenas às páginas Discord/Discordapp. Seu alvo é um ID de servidor ou um par servidor/canal. O editor de destino aceita valores de caminho de canal Discord normalizados.

| Modo | Resultado |
| --- | --- |
| Todos | Inscreva-se no Discord sem restrição de lista de alvos. |
| Incluir | Aplica-se apenas a servidores listados ou destinos de servidor/canal. |
| Excluir | Aplicar a todos, exceto aos alvos listados. |
| Ninguém | Aplicar a nenhum alvo. |

Atualmente, o Discord não tem opção de ocultar elemento no perfil normal da plataforma.

###3.5Twitter/X

Um grupo Twitter/X se aplica ao X/Twitter. Ele pode ser aplicado a todas as contas ou usar os modos de conta gerais descritos para plataformas de vídeo, com entrada normalizada de identificador/link de perfil.

As opções de elementos ocultos fornecidas são Explorar, Mensagens, Grok, Tendências e itens de feed promovidos. Tal como acontece com todos os controles de superfície baseados em seletores, uma alteração na marcação X pode afetar sua operação.

### 3.6 Campos declarativos de grupo personalizado

Um grupo personalizado executa principalmente sua fonte JavaScript. Ele não usa o seletor de comportamento normal ou a UI de agendamento normal. No entanto, pode conter uma lista de domínios quando importado ou configurado através de dados compatíveis:

- uma lista de bloqueio personalizada não vazia pode participar da decisão normal do site de página inteira;
- uma lista de permissões personalizada pode participar mesmo quando vazia, produzindo um bloqueio declarativo de toda a web;
- um grupo personalizado não configurado não bloqueia páginas acidentalmente apenas porque possui uma regra;
- Temporizadores personalizados nunca bloqueiam sozinhos; uma regra decide explicitamente se deve bloquear quando um cronômetro expira.

## 4. Configurações globais

As configurações globais aplicam-se à extensão e não a um grupo.

| Configuração | Padrão | Comportamento |
| --- | --- | --- |
| Taxa de tick | 1000ms | Frequência do tickEvent personalizado compartilhado. O intervalo válido é de 250 a 60.000 ms. Valores mais baixos podem tornar as regras orientadas a eventos mais responsivas, mas usar mais CPU. |
| Debounce de salvamento automático | 400ms | Atraso após a última alteração do editor antes que as configurações normais persistam. O máximo é 5.000 ms. |
| Modo de depuração | Desativado | Ativa a saída detalhada de rastreamento de regras personalizadas e a sobreposição de log de depuração na página. Ele não controla se as chamadas de log comuns de uma regra alcançam o log pop-up. |
| Mostrar logs de regras personalizadas em páginas da web | Ligado | Controla brindes comuns de log de página. Os autores de regras ainda podem solicitar explicitamente a saída somente de tela ou somente pop-up. |
| Duração padrão da soneca | 30 minutos | Semente usada ao criar novos grupos normais. Os grupos existentes mantêm a sua própria duração. |
| URL substituto padrão | sobre:em branco | Usado quando um grupo de bloqueio não tem URL substituto específico do grupo. |
| Ajude a classificar os criadores | Desativado | Aceitação explícita. Ele envia IDs de canais do YouTube encontrados apenas para o serviço de classificação configurado; não envia títulos nem histórico de exibição. |
| Pasta de arquivos locais | Nenhum | Capacidade de pasta opcional para regras personalizadas. Consulte a seção 9. |

### 4.1 Interface do editor e superfícies de feedback

O editor de extensão possui uma lista de grupos persistentes e um editor de grupos selecionados. A lista de grupos fornece o seletor de tipo de grupo, Adicionar, Limpar, selecionar, ativar alternar e arrastar a ordem. Seu divisor é redimensionável. O editor do grupo selecionado fornece campos específicos do grupo e as ações de exportação/importação do grupo.

O editor salva automaticamente as alterações comuns dos campos após o período de rejeição global. Erros de validação são relatados como feedback de status/toast; valores normais inválidos não são convertidos silenciosamente em configurações não relacionadas. Um grupo congelado desativa seus controles normais de edição.

A extensão também possui estas superfícies de feedback visíveis ao usuário:

| Superfície | Finalidade funcional |
| --- | --- |
| Manual de Instruções | Abre esta referência na extensão. |
| Seletor de idioma | Escolhe o idioma da interface de extensão. |
| Configurações | Abre as configurações globais descritas acima. |
| Feedback de status/brinde | Os relatórios salvam, importam, validam e resultados de ações. |
| Sobreposição de cronômetro na página | Mostra itens de cronômetro/contagem regressiva normais ativos e cronômetros personalizados que estão em seu escopo de exibição. Vários itens podem coexistir. |
| Superfície de log na página | Recebe chamadas personalizadas de log, aviso e erro quando permitido pelas configurações globais. |
| Registro personalizado | Um log de atividades ao vivo para entradas visíveis em pop-up criadas por regras. Ele pode ser limpo e baixado. |

Para grupos personalizados, o campo Regras armazena o texto de origem. Run primeiro executa a simulação da sintaxe da regra e só carrega a origem quando isso é bem-sucedido. O editor também executa linting de origem local à medida que o texto muda. O controle visível **Let AI Code** abre um campo de prompt e copia um pacote de geração de código contendo a solicitação do usuário, a regra atual e uma referência gerada para a API de regra personalizada atual. Ele não entra em contato com um serviço de IA nem altera automaticamente a regra.

O controle Modelos abre o navegador de modelos. Um modelo, quando enviado, possui título, descrição, tags, parâmetros e visualização gerada. Aplicá-lo substitui o texto atual das Regras após a confirmação. O catálogo de modelos enviado atualmente está vazio; o navegador permanece disponível para futuros modelos selecionados e não deve ser tratado como uma fonte de regras ativas.

## 5. Linguagem de regras personalizadas

### 5.1 Formulários de origem de regras

A origem de um grupo personalizado é JavaScript. Em **Executar**, o Vault remove os registros anteriores do grupo e o estado criado pela fonte ativa anterior e, em seguida, carrega a nova fonte.

A fonte pode ser:

1. a function expression accepting events and helpers; or
2. instruções básicas que usam os eventos fornecidos (ou evento legado) e variáveis auxiliares.

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

Run executa a verificação de sintaxe/preflight do JavaScript e, somente quando for bem-sucedido, torna a fonte atual ativa. Salvar texto e texto corrido são intencionalmente diferentes: uma regra pode ser salva sem se tornar a fonte ativa do evento.

A origem ativa é descarregada quando o grupo Customizado é executado novamente, desabilitado, excluído ou explicitamente interrompido. A nova execução limpa os manipuladores, temporizadores, painéis, bucket de persistência e predicados de plataforma criados pela regra antes do início do registro. Uma recuperação sandbox pode recarregar a fonte ativa; os autores das regras devem, portanto, tornar o registro idempotente.

### 5.2 Modelo de execução e premissas seguras

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Cada manipulador recebe:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Manipuladores para um evento executado por prioridade numérica decrescente; prioridade igual usa ordem de registro. Um manipulador pode ser substituído registrando novamente o mesmo tipo de evento e ID. Há um máximo de 1.000 manipuladores registrados para um grupo personalizado.

O Vault limita o trabalho ativo de um manipulador a cerca de um segundo. Três prazos ultrapassados ​​para o mesmo grupo em um minuto colocam a regra em quarentena: o Vault a desativa em vez de executar repetidamente um gerenciador problemático. Não use esperas ocupadas, loops ilimitados, pesquisas síncronas ou um grande número de mutações/logs por evento.

Por envio, o Vault aceita no máximo:

| Artigo | Máximo |
| --- | --- |
| Entradas de log de regras | 200 |
| Eventos publicados | 64 |
| Operações DOM | 256 |
| Ação/intenções | 256 |
| Painéis por grupo | 24 |
| Controles em um painel | 32 |
| Opções em select/radio control | 64 |

O excesso de log, evento postado, operação DOM e entradas de intenção podem ser eliminados. Uma regra personalizada não deve depender da entrega de entradas em excesso.

### 5.3 Tipos de eventos integrados

As seguintes strings de tipo de evento são incorporadas. Uma regra também pode usar sua própria string de tipo não vazia, desde que não comece com um sublinhado.

| Tipo de evento | Quando é enviado | Dados importantes |
| --- | --- | --- |
| tickEvento | Tick ​​periódico compartilhado na configuração de taxa de tick global. | Contexto atual da página/guia, quando disponível. Use a opção de registro intervalMs para limitar a taxa de um manipulador individual. |
| openWebEvent | Uma página de nível superior fica disponível para a regra. | URL, nome do host, IDs de guias/páginas, hora. |
| fecharWebEvent | Uma página/guia de nível superior é fechada. | Contexto de URL/nome do host, quando disponível. |
| webChangedEvent | Uma navegação de nível superior comprometida, incluindo recargas no mesmo URL. | os dados carregam URL/nome do host anteriores e sinalizadores de navegação, como isFirstLoad, isReload e sameDomain. |
| temporizador finalizado | Um temporizador personalizado muda para o estado expirado. | dados: timerId, displayName, direção, currentMs. Ele é entregue apenas ao grupo proprietário do cronômetro. |
| sonecaPressione | O usuário pressiona Iniciar suspensão para este grupo personalizado. | A regra possui a resposta; nenhum substituto de soneca normal é executado. |
| painelEvento | Um painel personalizado renderizado possui uma interação. | os campos de dados e conveniência incluem informações de painel/controle/evento/valor. |
| localFileEvent | Uma ação de arquivo local solicitada é concluída. | os campos de dados e conveniência incluem requestId, caminho, resultado, bytes, entradas e erro. |
| páginaHeartbeatEvent | Uma pulsação de página visível, aproximadamente a cada 250 ms enquanto a guia estiver visível. | elapsedMs é o tempo decorrido da página visível. Os temporizadores personalizados com escopo usam-no automaticamente, mesmo sem um manipulador registrado. |

### 5.4 API de registro de eventos

O primeiro argumento para uma fonte de estilo de função é o registro de eventos. Na fonte de instrução simples, eventos e eventos referem-se a esse registro.

| Método | Contrato |
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

O objeto opcional de opções do manipulador suporta:

| Opção | Significado |
| --- | --- |
| prioridade | Ordem numérica. Valores mais altos são executados antes de valores mais baixos. Padrão 0. |
| intervaloMs | Número positivo. Somente para tickEvent, suprime as chamadas até que esse tempo tenha decorrido desde a chamada anterior do manipulador. |

Os eventos sintéticos têm como padrão o escopo do grupo: apenas os manipuladores pertencentes ao grupo emissor os recebem. Use { scope: "global" } para enviar o evento para todas as regras que registraram o mesmo tipo. Não use um sublinhado inicial no nome de um evento; está reservado.

### 5.5 Objeto de evento

Cada manipulador recebe um objeto de evento mutável com campos comuns:

| Campo/método | Contrato |
| --- | --- |
| tipo | Sequência de tipo de evento. |
| ID do grupo | ID do grupo personalizado do destinatário. |
| tabId, pageId | Identificadores do navegador quando disponíveis; caso contrário, nulo. |
| url, nome do host | URL e nome de host de nível superior atuais ou strings vazias. |
| tempo | Cópia do objeto de horário de expedição ou nulo. |
| dados | Carga útil específica do evento ou nula. |
| preventDefault() | Marca o envio como uma ação de bloqueio de página. A página é redirecionada para o link/resultado de redirecionamento atual, se existir; caso contrário, o Vault usará o caminho normal de saída/substituição. |
| pararPropagação() | Interrompe os manipuladores posteriores para o envio do evento atual. |
| setResult(valor) | Armazena um resultado numérico ou de string. Uma string não vazia é tratada como um destino de redirecionamento; o resultado 1 suprime um resultado preventDefault acumulado. |
| getResult() | Retorna o resultado definido por este objeto de evento ou nulo. |
| post(tipo, dados, opções) | Enfileirar um evento sintético, com as mesmas regras de escopo de Events.post. |
| setRedirectLink(url) | Defina o URL de redirecionamento para este despacho. Retorna falso apenas para uma entrada que não seja de string. |
| getRedirectLink() | Leia o URL de redirecionamento deste despacho ou uma string vazia. |
| fechar(id) | Solicitar o fechamento de uma guia. Um número é um ID de guia, uma string identifica um URL e um valor omitido tem como alvo a guia ativa. |
| bloco(id) | Adicione um padrão de bloqueio de site dinâmico somente para sessão. Sem ID de string, use o nome do host do evento. |
| desbloquear(id) | Remova um padrão de bloqueio de site dinâmico somente de sessão. Sem ID de string, use o nome do host do evento. |
| abrir() | No-op na extensão do navegador. Ele não pode iniciar aplicativos. |

Um manipulador pode anexar propriedades extras arbitrárias ao evento. Leia-os através de event.custom ou diretamente pelo nome atribuído enquanto o objeto de evento estiver ativo. Eles não são de estado persistente e não são armazenamento entre eventos.

Para panelEvent, estes campos de conveniência são adicionados: panelId, controlId, eventName, valor, valores, chave, código e keyInfo.

Para localFileEvent, estes campos de conveniência são adicionados: eventName, ação, caminho, directoryPath, requestId, ok, texto, valor, entradas, existe, bytes e erro.

### 5.6 Pontos de entrada do auxiliar

O objeto auxiliar tem estas propriedades diretas:

| Ponto de entrada | Significado |
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. Referência auxiliar personalizada

### 6.1 Auxiliar de domínio

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Método | Retorno e comportamento |
| --- | --- |
| hostnameOf(url) | Host normalizado em letras minúsculas sem www. à esquerda ou nulo para um URL inválido. |
| nomedocaminhoOf(url) | Nome do caminho do URL ou / quando o URL não pode ser analisado. |
| correspondências(nome do host, site) | Verdadeiro quando o nome do host é igual ao site ou é o seu subdomínio. |
| getPlataforma(url) | youtube, tiktok, instagram, facebook, twitch ou null. |
| isYouTubeHost(host), isTikTokHost(host), isInstagramHost(host), isFacebookHost(host), isTwitchHost(host), isRedditHost(host), isDiscordHost(host) | Classificadores de host. |
| youtube(), tiktok(), instagram(), facebook(), twitch() | Retorne o objeto classificador de URL dessa plataforma. |
| isEmptyStartPage(url) | Verdadeiro para URLs em branco/nova guia/página inicial compatíveis com o navegador. |
| matchesAny(url, padrões) | Combine um URL com um RegExp, uma matriz RegExp ou strings compiladas como expressões regulares. Padrões de string inválidos são ignorados. |
| pathStartsWith(url, caminho) | Verdadeiro para um caminho exato ou descendente de caminho. Uma barra inicial ausente é fornecida. |
| queryHas(url, chave, valor) | True se existir uma chave de consulta; quando o valor é fornecido, ele também deve ser igual ao valor da string. |
| queryGet(url, chave) | Valor de consulta ou nulo. |
| isSearchPage(url) | Detecta URLs de pesquisa compatíveis com Google, Bing, DuckDuckGo, YouTube, Reddit e X/Twitter. |
| isInfiniteFeedUrl(url) | Detecta superfícies de alimentação infinita suportadas. |
| mesmaSeção(a, b) | Verdadeiro somente quando ambos os URLs compartilham um host e o primeiro segmento de nome de caminho. |

Cada objeto classificador de URL da plataforma expõe isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url) e extractVideoId(url). Um método pode retornar falso/nulo quando a URL é válida, mas não identifica esse tipo de conteúdo.

### 6.2 Auxiliar de temporizador

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Opções de criação/obtenção:

| Opção | Significado |
| --- | --- |
| identificação | ID de temporizador não vazio obrigatório. |
| exibir | Etiqueta de sobreposição legível por humanos. |
| direção | encaminhar para contagem; qualquer outro valor torna-se regressivo/contagem regressiva. |
| atualMs | Milissegundos iniciais, com piso em zero e limitados se existirem limites. |
| mínMs, máxMs | Limites mínimo/máximo positivos opcionais. |
| passos | Etapa de quantização positiva opcional para ticks decorridos. |
| estilo de sobreposição | Strings opcionais para cor, plano de fundo, fontSize, fontWeight, borda, borderRadius, preenchimento, opacidade e ícone. Peças não suportadas/inválidas são descartadas. |
| escopo(url) | Predicado que decide onde o tempo da página visível é acumulado. |
| domínio(url) | Predicado que decide onde o cronômetro aparece na sobreposição; o padrão é escopo. |
| acumularQuando(url) | Predicado extra opcional. O tempo é acumulado somente quando scope e accrueWhen são verdadeiros. |

| Método | Comportamento |
| --- | --- |
| criar(opções) | Cria/substitui um temporizador e redefine seu estado. Retorna id ou nulo. |
| getOrCreateTimer(opções) | Crie apenas se estiver ausente. O estado existente permanece inalterado. Retorna id ou nulo. |
| excluir(id) | Remova o temporizador e seus predicados de escopo/exibição. |
| pausa(id), currículo(id) | Alterar o estado de pausa. Retorne verdadeiro somente quando uma mudança de estado for possível. |
| setDirection(id, direção) | Defina para frente ou para trás. |
| setCurrentMs(id,ms) | Defina a contagem absoluta, impondo limites. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Ajuste a contagem, impondo limites. |
| setBounds(id, minMs, maxMs) | Defina limites positivos; passe null para um limite para removê-lo. |
| setStep(id, stepMs) | Defina uma quantização de tick positiva. Passe nulo ou zero para limpá-lo. |
| setOverlayStyle(id, estilo) | Substitua/limpe os estilos de sobreposição permitidos. |
| setDisplayName(id, nome) | Defina o rótulo de sobreposição. |
| getCurrentMs(id) | Número, zero para um temporizador ausente. |
| estáExpirado(id) | Verdadeiro somente quando existe um temporizador e currentMs é zero. |
| estáPausado(id) | Booleano. |
| getDireção(id), getDisplayName(id) | Direção/nome ou nulo. |
| existe(id) | Booleano. |
| getEstado(id) | Instantâneo do temporizador serializável ou nulo. |
| lista() | Matriz serializável de instantâneos de timer. |

Os predicados de escopo são lembrados enquanto a origem personalizada permanece carregada. O Vault avança os temporizadores correspondentes durante os ciclos visíveis de pageHeartbeatEvent, um tique por temporizador por despacho. Um temporizador regressivo para em zero e emite timerEnded na transição para zero. Permanece zero até que a regra o altere/redefina. Use um manipulador com término de timer para decidir se um timer expirado deve chamar preventDefault, definir um redirecionamento ou executar outra ação.

### 6.3 Armazenamento persistente e assíncrono

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Método | Comportamento |
| --- | --- |
| get(chave, valorpadrão) | Leia um valor clonado ou defaultValue. |
| definir(chave, valor) | Armazene um clone seguro para JSON. Retorna falso para chave/valor inválido ou esgotamento de limite de chave. |
| excluir(chave) | Exclua a chave existente; retorna se existiu. |
| tem(chave) | Booleano. |
| chaves() | Matriz de chaves. |
| entradas() | Matriz de pares [chave, valor] clonados. |
| limpar() | Exclua todas as persistências de regras deste grupo. |
| tamanho() | Número de chaves. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Método | Comportamento |
| --- | --- |
| requestAsyncGet(chave) | Solicite uma leitura de armazenamento assíncrona. Retorna verdadeiro quando na fila. Use um evento posterior/seu próprio fluxo de estado para responder; não é um getter síncrono. |
| requestAsyncSet(chave, valor) | Solicite um armazenamento assíncrono seguro para JSON. Retorna verdadeiro quando na fila. |

A persistência da regra é limpa em Executar porque uma nova origem ativa inicia com um estado limpo de regra personalizada.

### 6.4 Auxiliar de registro

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Método | Destino |
| --- | --- |
| registrar, avisar, erro | Registro de atividades pop-up; brinde de página quando os brindes de log de página global estão habilitados. |
| logScreen, tela de aviso, tela de erro | Somente superfície de notificação/depuração da página; excluído do log pop-up. |
| logPopup, warningPopup, errorPopup | Apenas registro de atividades pop-up; excluído do brinde da página. |

Os logs também tentam acessar o console do navegador com um prefixo de grupo CustomBlocker. Esta é uma saída de diagnóstico, não uma API de persistência. Use o auxiliar de persistência para o estado.

### 6.5 Auxiliar de redirecionamento

Get it with helpers.getRedirectionHelper().

| Método | Comportamento |
| --- | --- |
| get(), getRedirectLink() | Retorne o URL de redirecionamento de despacho atual ou uma string vazia. |
| definir(url), setRedirectLink(url) | Defina o URL de redirecionamento para o envio atual. |
| createMessageUrl(mensagem) | Crie um URL de página de mensagem de extensão local que exiba a mensagem fornecida. |

Definir um redirecionamento por si só não força a navegação. Combine-o com event.preventDefault() ou defina uma string não vazia por meio de event.setResult(), de acordo com o fluxo de regra desejado.

### 6.6 Auxiliar DOM

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Método | Ação solicitada |
| --- | --- |
| ocultar(seletor), mostrar(seletor) | Ocultar/mostrar elementos correspondentes. |
| addClass(seletor, className), removeClass(seletor, className) | Mute a classe CSS. |
| setText(seletor, texto) | Substitua o conteúdo do texto. |
| clique(seletor) | Clique no elemento correspondente. |
| injetarCss(css, id) | Adicione um bloco CSS identificado. |
| removeInjectedCss(id) | Remova um bloco CSS injetado identificado anteriormente. |
| scrollTo(seletor) | Role um elemento correspondente até a visualização. |

As ações DOM não fornecem scripts de página irrestritos. Eles são uma superfície de ação limitada e devem ser idempotentes quando usados ​​em manipuladores de batimentos cardíacos/tiques.

### 6.7 Navegação, guias e auxiliar de janela do navegador

Get navigation with helpers.getNavigationHelper().

| Método | Ação solicitada |
| --- | --- |
| voltar() | Navegue para trás na guia atual. |
| avançar() | Navegue pela guia atual para frente. |
| recarregar() | Recarregue a guia atual. |
| ir para(url) | Navegue na guia atual até URL. |
| fecharTab() | Fecha a guia atual. |

Get a snapshot helper with helpers.getTabHelper().

| Método | Retorno/ação |
| --- | --- |
| lista() | Cópia do instantâneo da guia atual. |
| getActiveTab() | Instantâneo da guia ativa ou nulo. |
| getById(id) | Instantâneo da guia correspondente ou nulo. |
| contagemOpen() | Número de guias no instantâneo. |
| requestRefresh() | Solicite um novo instantâneo de guia para trabalho de regras posterior. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Método | Comportamento |
| --- | --- |
| atual() | Objeto de guia ativo atual: id, url, nome do host, título, isBrowser. |
| tudo() | Matriz de objetos de guia com id, url, nome do host, título, ativo. |
| fechar(idOrUrl) | Fechar por ID numérico da guia, string de URL exata ou guia ativa quando omitido. |
| fecharTab() | Feche a guia ativa. |
| bloco(padrão) | Adicione um bloco de domínio somente de sessão normalizado e aplique-o. |
| desbloquear(padrão) | Remova um bloco de domínio somente de sessão normalizado. |
| isBlocked(urlOrHostname) | Consulte a lista de bloqueios da sessão criada pela regra. |
| getBlocked() | Liste os padrões atuais criados pela sessão. |

Os padrões de bloco criados por regras normalizam http/https, levando www. e caminhos a um padrão de host. Eles correspondem exatamente ao host e aos subdomínios. Esta lista de bloqueio dinâmica é uma memória de sessão, não um grupo de sites normal salvo.

### 6.8 Auxiliar de pasta de arquivo local

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Método | Comportamento |
| --- | --- |
| estáDisponível() | Informa que a superfície da API existe; isso não prova que uma pasta esteja autorizada no momento. |
| requestRead(caminho) | Solicite a leitura do texto. |
| requestWrite(caminho, texto) | Solicitar escrita de texto. |
| requestAppend(caminho, texto) | Solicite acréscimo de texto. |
| requestList(caminho = "") | Solicite uma listagem de diretório. |
| requestExists(caminho) | Solicite teste de existência. |
| requestReadJson(caminho) | Solicitar leitura JSON; o caminho deve terminar em .json. |
| requestWriteJson(caminho, valor) | Solicitar gravação JSON; o caminho deve terminar em .json e o valor deve ser seguro para JSON. |

Os caminhos são sempre relativos à raiz selecionada. Eles não podem ser absolutos, qualificados para unidade, com prefixo de ponto ou conter arquivos . ou .. segmentos. Somente arquivos .txt, .csv e .json são aceitos para operações de arquivo. A seleção de pastas pode ser revogada a qualquer momento; uma solicitação com falha relata ok false e uma string de erro em localFileEvent.

### 6.9 Auxiliar de plataforma

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Todas as APIs de plataforma brutas expõem:

| Método | Comportamento |
| --- | --- |
| ocultar(predicado, opções) | Defina o mesmo predicado por item para cada slot de cartão de alimentação nessa plataforma. |
| ocultar(slot, predicado, opções) | Defina um predicado por item. O predicado recebe o item/instantâneo da plataforma fornecido por essa plataforma. |
| permitir(predicado, opções), permitir(slot, predicado, opções) | O mesmo que ocultar, mas cria um veredicto de permissão/exceção. |
| mostrar(), mostrar(slot) | Limpe todos ou um slot predicado instalado. |
| superfície(nome, "ocultar" ou "mostrar") | Ocultar/mostrar toda uma região da plataforma. home é o nome público da homePage. |
| temporizador(slot, opções) | Configure um temporizador de subseção de plataforma. Retorna options.id quando fornecido, caso contrário, nulo. |
| rescan() | Reavalie os cartões de feed já digitalizados após alterações no estado das regras externas. |
| instantâneo() | Retorne o instantâneo da plataforma atual ou nulo. |
| slots(), superfícies(), timerSlots() | Retorne os nomes suportados para esta plataforma. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | Ajudantes de URL para essa plataforma. |

Um slot possui um predicado para um grupo/plataforma. Uma chamada ocultar/permitir posterior para o mesmo slot substitui o predicado anterior; não é um OU implícito. O objeto de opções opcionais reconhece:

| Opção | Efeito |
| --- | --- |
| bloquearPageOnVisit | Quando um cartão/página correspondente for visitado, solicite um bloqueio de página em vez de apenas ocultar o cartão. |
| efeito | bloquear (padrão) ou permitir. Os conjuntos auxiliares de permissão permitem automaticamente. |

Chame a nova verificação sempre que um predicado depender do estado que mudou após a primeira avaliação dos cartões, como uma caixa de seleção do painel, uma cota ou um limite de tempo.

Matriz bruta de suporte à plataforma:

| Plataforma | Slots predicados | Nomes de superfície | Slots de temporizador |
| --- | --- | --- | --- |
| YouTube | curtas, vídeos, postagens, comentários, ao vivo | home, shortButton, comentários, ao vivo | curtas, vídeos, postagens |
| TikTok | vídeos, comentários, ao vivo | home, comentários, ao vivo | vídeos |
| Instagram | shorts, postagens, comentários | página inicial, comentários | shorts, postagens |
| Facebook | curtas, vídeos, postagens, comentários, ao vivo | home, comentários, ao vivo | curtas, vídeos, postagens |
| Contração muscular | curtas, streams, vídeos, ao vivo | home, comentários, ao vivo | curtas, streams, vídeos |

O auxiliar bruto da plataforma personalizada não expõe Reddit, Discord ou Twitter/X. Use recursos gerais de URL, DOM, cronômetro, painel e navegação para trabalho personalizado nesses sites.

## 7. Painéis personalizados

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 API do painel

| Método | Comportamento |
| --- | --- |
| criar(configuração) | Crie ou substitua um painel. Retorna o ID do painel normalizado ou nulo. |
| getOrCreatePanel(config) | Criar somente quando ausente; retorna id ou nulo. |
| atualizar(id, patch) | Substitua os campos do painel especificados após a validação. |
| excluir(id) | Remova um painel e seus manipuladores embutidos registrados. |
| mostrar(id), ocultar(id) | Altere a visibilidade. |
| setValue(panelId, controlId, valor) | Defina um valor de controle gravável após a validação. |
| updateControl(panelId, controlId, patch) | Substitua os campos permitidos de um controle. |
| desativar(panelId, controlId), ativar(panelId, controlId) | Alternar disponibilidade de controle. |
| setOptions(panelId, controlId, opções) | Substitua as opções de seleção/rádio. |
| setText(panelId, controlId, texto) | Atualize um rótulo de botão, texto/texto de seção ou outro rótulo de controle. |
| setTheme(painelId, tema) | Substitua o tema do painel. |
| setTitle(panelId, título), setDescription(panelId, descrição) | Atualizar texto. |
| getValue(panelId, controlId) | Retorna um valor clonado ou indefinido. |
| getValues(panelId) | Retorna todos os valores graváveis ​​codificados pelo ID de controle. |
| getEstado(id) | Retornar um instantâneo do painel serializável ou nulo. |
| lista() | Retorne instantâneos serializáveis ​​de todos os painéis. |
| aviso(configuração) | Crie um painel de status compacto no canto inferior direito com mensagem/texto opcional. |
| confirmar(configuração) | Crie uma caixa de diálogo centralizada com botões de confirmação e cancelamento gerados. |
| lista de verificação(configuração) | Crie um painel de itens de caixa de seleção. |
| formulário(configuração) | Crie um painel de layout de formulário a partir de campos. |

### 7.2 Configuração do painel

| Campo | Valores/comportamentos aceitos |
| --- | --- |
| identificação | Obrigatório. Normalizado para letras, dígitos, sublinhado, hífen; máximo de 80 caracteres. |
| título | Título do painel, máximo de 240 caracteres. |
| descrição ou corpo | Descrição, máximo de 1.000 caracteres. |
| posição | canto superior esquerdo, canto superior direito, canto inferior esquerdo, canto inferior direito ou centro. Padrão no canto inferior direito. |
| alinhar | esquerda, centro ou direita. Padrão esquerdo. |
| disposição | vertical, compacto, confortável, espaçoso, embutido, linha, quebra, duas colunas, grade, divisão, formulário, barra de ferramentas ou pilha. Vertical padrão. |
| prioridade | Ordem de exibição numérica, fixada em -1000 a 1000. Os painéis mais altos são exibidos primeiro. |
| largura | pequeno, médio, grande ou 180 a 520 px. |
| tamanho do texto/tamanho da fonte | 10 a 32 px ou 0,65 a 2 rem/em. |
| ariaLabel/a11yLabel | Etiqueta acessível. |
| papel | região, caixa de diálogo, alerta, status, formulário ou grupo. |
| foco automático | Booleano. |
| tema/cores | plano de fundo, primeiro plano, acento, borda, silenciado, fontSize/textSize, titleSize. |
| controles | Conjunto de até 32 controles, com aninhamento de seções em até três níveis. |
| visível | False oculta o painel. |
| escopo(url), domínio(url) | Funções que controlam a disponibilidade/exibição. o domínio tem precedência; sem domínio, os controles de escopo são exibidos. |

Os campos do manipulador embutido no painel podem aparecer no painel ou no controle individual: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey e onKeyDown. Cada um recebe os parâmetros normais (evento, auxiliares). Um manipulador embutido é substituído quando esse painel é recriado/atualizado com definições de controle.

### 7.3 Controles

Os tipos de controle disponíveis são texto, caixa de seleção, seleção, textInput, textarea, botão, seção, temporizador, numberInput, intervalo, alternância, rádio, data, hora, cor, pin e html. Aliases de entrada, menu suspenso, grupo, número, controle deslizante, switch, bruto e marcação são normalizados para seu tipo correspondente.

Todos os controles aceitam id, tipo, rótulo, valor, desabilitado, prioridade e, quando relevante, layout, alinhamento, ariaLabel/a11yLabel, autoFocus, largura, altura e linhas.

| Tipo | Campos importantes e contrato de valor |
| --- | --- |
| texto | texto (ou rótulo) renderizado como texto sem entrada. |
| caixa de seleção, alternar | Valor booleano. |
| selecione, rádio | opções como strings ou objetos {value, label}; máximo 64. O valor é uma sequência curta. |
| textInput, área de texto | Valor da string, máximo de 2.000 caracteres; espaço reservado opcional. |
| botão | rótulo/texto; ação opcional enviar, cancelar ou fechar. |
| seção | texto/descrição, função e controles aninhados. |
| temporizador | timerId ou instantâneo do temporizador; formate ms, ss, mm:ss ou hh:mm:ss; showExpired padrão é verdadeiro. |
| númeroEntrada, intervalo | Valor numérico fixado em mín/máx fornecido; passo positivo opcional. |
| data | Somente valor AAAA-MM-DD. |
| tempo | Somente valor HH:MM ou HH:MM:SS. |
| cor | Valor de entrada #RRGGBB de seis dígitos. |
| alfinete | Somente dígitos, comprimento de 3 a 12, mascarados por padrão, envio automático opcional. |
| HTML | Marcação higienizada. Blocos de script, atributos de eventos in-line e javascript: URLs são removidos. |

Cada interação renderizada gera panelEvent. O objeto de valores do evento contém os controles graváveis ​​do painel, excluindo botões, texto e controles de temporizador. Uma ação de fechamento oculta o painel antes que os manipuladores observem o evento.

## 8. Receitas de ação com regras personalizadas

Os exemplos a seguir são especificações de composição pública, não um tutorial.

### 8.1 Redirecionar uma página de abertura

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 Contagem regressiva de tempo visível com bloqueio explícito

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 Alterar um predicado de feed de um painel

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

Os predicados devem ser gravados para os valores de instantâneo/item da plataforma fornecidos pela superfície da plataforma ativa. Se uma plataforma não puder identificar um campo de forma confiável, o predicado deverá falhar ao abrir, em vez de assumir que um valor é verdadeiro.

## 9. Protocolo de solicitação de pasta local

As operações de pasta local não são E/S imediatas de arquivos. A sequência funcional completa é:

1. O usuário seleciona uma pasta em Configurações Globais.
2. A regra coloca uma solicitação na fila e recebe um ID de solicitação.
3. O Vault solicita ao recurso de pasta autorizado para realizar a operação.
4. O Vault envia localFileEvent para o mesmo grupo personalizado.
5. O manipulador correlaciona event.requestId com o ID da solicitação original.

A leitura bem-sucedida é concluída com texto para arquivos de texto ou valor para JSON. Lista retorna entradas. Existe retorno existe. Write/append fornece bytes quando aplicável. A falha fornece ok, falso e erro. As regras nunca devem presumir que uma pasta selecionada permanece autorizada após uma recarga, reinicialização do navegador ou revogação de permissão.

## 10. Segurança de regras personalizadas e semântica de falha

### 10.1 Erros de compilação e execução

Verifique a falha na compilação dos relatórios de sintaxe. Run também pode relatar um erro de tempo de execução durante o registro. Se uma fonte semelhante a uma função tiver um erro de sintaxe, o Vault não voltará silenciosamente a tratá-la como instruções simples e inofensivas.

Uma fonte vazia não possui nenhum manipulador. É válida como uma regra personalizada inativa, mas não executa nenhuma ação personalizada configurada.

### 10.2 Erros do manipulador

Uma exceção de um manipulador é isolada do envio geral do evento. É uma saída de diagnóstico; isso não faz com que os manipuladores posteriores tenham sucesso magicamente. Use manipuladores restritos e registre erros acionáveis.

### 10.3 Quarentena

O Vault pode colocar um grupo personalizado em quarentena após repetidas ultrapassagens de prazo ou ultrapassagens durante o registro. A quarentena desativa o grupo e registra o motivo do cancelamento. Corrija a origem, salve-a e execute-a explicitamente novamente para restaurar os registros ativos.

### 10.4 Limites de navegador/página

Nenhuma regra personalizada recebe APIs de extensão irrestritas. Em particular:

- um seletor DOM não consegue encontrar nada em uma plataforma que mudou;
- navegação, fechamento de guias e ações na tela permanecem sujeitas aos recursos do navegador;
- uma extensão não pode abrir aplicativos nativos;
- as operações de pasta local requerem uma pasta concedida pelo usuário e os tipos de arquivo suportados;
- um manipulador de eventos não pode confiar em uma página invisível que continua a produzir pulsações em tempo visível;
- uma página pode recarregar, navegar, ser descartada ou invalidar um script de conteúdo independentemente da regra;
- os blocos de sites dinâmicos criados por regras são ações de estado de sessão, e não edições permanentes de grupos de sites.

## 11. Ponte de aplicativo da Web

A extensão do navegador inicia automaticamente a conexão com o hub Vault local compatível em ws://127.0.0.1:8787. Não há um controle de conexão para o usuário e a compatibilidade do protocolo é obrigatória.

O Vault primeiro verifica rapidamente e depois continua tentativas de reconexão mais lentas enquanto a extensão estiver em execução. O transporte automático não mescla grupos sozinho; vincular e desvincular grupos continua explícito.

### 11.1 Vinculando grupos

Os grupos só podem ser vinculados quando seu nome e tipo correspondem e eles são elegíveis para vinculação. O usuário seleciona/vincula explicitamente os programas participantes. Um grupo vinculado forma um cluster. A desconexão deixa os dados do grupo local intactos; ele interrompe a sincronização ao vivo.

A ponte sincroniza a política escalar compartilhada para grupos vinculados suportados, incluindo modo de bloqueio normal, valores de permissão/redefinição, configurações de soneca, dias/janelas ativos, estado de congelamento/escolha/duração, política de página inicial, configuração de lista de permissões, URL substituto e política de pular para a próxima. Ele também coordena o uso e o estado de suspensão para membros do cluster.

A ponte não promete que cada campo específico do produto, seletor de plataforma, texto de origem personalizado ou capacidade específica do navegador seja transferível para um programa diferente. Um grupo pode permanecer local e desvinculado mesmo enquanto a ponte estiver conectada.

Os clusters de pontes congeladas exigem que todos os membros relevantes estejam online para ações de estado congelado que precisam de mutação coordenada. Uma conexão é um transporte local, não um backup na nuvem ou um canal de controle remoto.

## 12. Lista de verificação de verificação para mantenedores

Use esta lista de verificação ao auditar uma versão ou reproduzir comportamento:

1. Confirme se o grupo tem um nome exclusivo não vazio, tipo correto, estado ativado e lista/ordem pretendida.
2. Para grupos normais, confirme o dia da semana ativo, a janela de horário local válida, sem soneca ativa e o estado de edição não congelado.
3. Para um grupo de sites, teste o host exato, o subdomínio e (para lista de permissões) um host fora da lista.
4. Para um grupo de plataformas, teste separadamente a correspondência no nível da página, a correspondência de item/cartão direcionado, o modo de autor, o modo de formulário de conteúdo e cada ocultação de superfície habilitada.
5. Para grupos normais cronometrados, verifique o acúmulo de páginas visíveis, a expiração da permissão ou o comportamento sem bloqueio da contagem e o intervalo de reinicialização.
6. Para regras personalizadas, execute a verificação de sintaxe, execute, inspecione a contagem/logs do manipulador, teste cada evento integrado registrado e, em seguida, teste uma recarga/navegação.
7. Teste cada temporizador personalizado nos limites do escopo e em zero; verifique se algum bloco está explícito na regra.
8. Teste os painéis com cada valor de controle, estado desativado, ação de envio/cancelamento/fechamento e manipulador panelEvent.
9. Teste a falha da pasta local antes do sucesso: nenhuma pasta selecionada, permissão revogada, caminho inválido, extensão não suportada e leitura/gravação autorizada.
10. Teste a inicialização automática do transporte, grupos vinculados/desvinculados e um membro de cluster offline antes de confiar na sincronização ou na coordenação de congelamento.

## 13. Regra de versionamento

Este arquivo em inglês é o manual fonte mantido. Os manuais localizados são traduções deles e podem exigir regeneração após uma atualização da documentação funcional. A origem do produto continua sendo a verdade canônica para a ambiguidade no nível de implementação.
