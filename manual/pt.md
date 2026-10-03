# Manual do usuário da extensão de navegador Vault

O Vault controla sites e conteúdo compatível de plataformas no perfil do navegador em que está instalado. Abra o editor pelo botão da extensão na barra de ferramentas. Quando conectado, o Mac Vault ou o Windows Vault oferece marcação local e Activity; a extensão aplica o bloqueio aos alvos do navegador.

## Grupos de bloqueio

Um **grupo de bloqueio** aplica uma política de bloqueio. Um **grupo Classifier** atribui tags ao conteúdo; ele não bloqueia nada por conta própria.

1. Adicione um grupo de bloqueio e dê um nome a ele.
2. Escolha alvos em **Aplicar a**.
3. Escolha quando o bloqueio se aplica e defina um cronograma ou tempo permitido, se quiser.
4. Ative o grupo. Os alvos compartilham a política do grupo.

As edições comuns são salvas automaticamente. Um erro significa que a edição não foi aceita; corrija o campo e tente novamente. Desative um grupo para suspender sua política sem perder a configuração. **Excluir grupo** o remove. Arraste os grupos para reordená-los. Mais de um grupo pode se aplicar ao mesmo alvo; adiar um não remove o bloqueio de outro.

**Exportar** copia a configuração de um grupo. **Importar** substitui a configuração do grupo selecionado após a confirmação.

### Tempo permitido e cronograma

**Bloquear imediatamente** aplica-se sempre que o grupo ativo corresponder e seu cronograma estiver em vigor. **Bloquear quando o tempo permitido for usado** permite o uso correspondente até o tempo acabar.

Defina o tempo permitido em minutos e o intervalo de redefinição em horas. Um limite móvel conta o uso na janela anterior. A redefinição à meia-noite inicia um novo período à meia-noite local, inclusive para um limite móvel.

Escolha os dias da semana ativos e intervalos opcionais do horário local, um por linha, como **09:00-12:00**. Sem intervalos, aplica-se durante todos os dias selecionados. Um intervalo deve terminar depois de começar no mesmo dia; divida um cronograma noturno em dias separados.

### Adiar

Configure o adiamento em cada grupo de bloqueio. **Pausar bloqueio** suspende a política do grupo durante o período definido. **Adicionar ao tempo permitido** acrescenta minutos utilizáveis a um grupo limitado por tempo. Só o tempo adicional consumido conta como tempo adiado. O tempo adicional não usado expira na próxima redefinição; em um limite móvel, expira após uma janela ou antes, à meia-noite, se a opção estiver ativada.

**Atraso de ativação** adia o pedido de adiamento enquanto o bloqueio continua. **Intervalo de espera** é o tempo após o fim do adiamento até que outro pedido possa ser feito. **Confirmações necessárias** define o número de etapas de confirmação. O adiamento fica disponível para um grupo congelado somente se permitido antes do congelamento.

### Congelar e PIN

**Congelar** impede edições comuns. Para descongelar, são necessárias dez confirmações com cinco segundos de intervalo, além da espera configurada e de um PIN de seis dígitos. **Aguardar antes de descongelar** aceita 0–72 horas; 0 não acrescenta espera.

Enquanto estiver congelado, é possível prolongar a espera e adicionar um PIN se ainda não houver um. Essas condições não podem ser flexibilizadas até o grupo ser descongelado. A exclusão também respeita a espera restante e o PIN.

### Grupos vinculados

Use **Vincular** para conectar grupos explicitamente selecionados em outros programas Vault. Grupos vinculados compartilham o nome, as configurações de política compatíveis, os alvos, o uso e as condições de congelamento. Cada programa edita e aplica os tipos de alvo compatíveis; outras entradas de alvo continuam disponíveis aos programas vinculados. Desvincular mantém cada grupo e suas configurações.

Se um membro vinculado estiver offline, talvez não seja possível editá-lo. Abra o Vault para desktop e o navegador vinculado para reconectar. Uma política salva localmente pode continuar em vigor enquanto um membro estiver offline.

## Ajuda

Clique no pequeno **i** ao lado de um campo para ver a explicação. Clique fora dele ou pressione Escape para fechar. As listas ficam em caixas roláveis; role a caixa para ver mais itens. A pesquisa filtra a lista visível sem excluir itens.

As regras personalizadas têm um [Manual de código](../code-manual/pt.md) próprio. Ele explica o editor, a ativação, os registros, o acesso a arquivos e a API compatível.

## Sites e conteúdo de plataformas

Adicione domínios ou URLs completas, um por entrada. Um domínio inclui seus subdomínios. Um caminho limita a correspondência a esse caminho e seus descendentes. **Bloquear tudo, exceto estes sites** transforma a lista em uma lista de permissões.

Você pode adicionar o mesmo site mais de uma vez. Cada entrada tem seus próprios filtros e controles de página; por exemplo, uma entrada do YouTube pode bloquear Shorts e outra pode bloquear um criador. Entradas correspondentes se combinam no grupo e compartilham o cronograma, o tempo permitido e o adiamento.

Um alvo pode cobrir uma página correspondente ou pausar primeiro e oferecer Continuar após uma contagem regressiva. No mesmo grupo, um alvo de bloqueio tem prioridade sobre um alvo de pausa. **Quando bloqueado: redirecionar ou exibir mensagem** aceita um endereço web ou uma mensagem de cobertura; deixe em branco para cobrir a página no local. Uma pausa nunca redireciona.

Os alvos de plataforma usam **Criadores** para plataformas de vídeo, **Contas** para Twitter / X, **Comunidades** para Reddit e IDs de servidores/canais para Discord. Os controles se aplicam quando o Vault identifica a origem e o tipo de conteúdo. Os controles de conteúdo ocultam elementos compatíveis da página, como anúncios ou cartões de vídeo. Permissões do navegador e mudanças nos sites podem afetar esses controles.

### Filtros de tags de conteúdo

A conexão com Classifier e a correção de tags estão disponíveis em navegadores Chromium compatíveis, como Chrome e Edge, e no Safari Vault para macOS.

Conecte o Mac Vault ou o Windows Vault e configure o Classifier para obter tags. O filtro de tags de um grupo de bloqueio escolhe o que cobrir ou ocultar. Ele não inicia nem pausa a marcação; use as configurações do Classifier no aplicativo para desktop ou o controle de pausa do grupo Classifier específico.

Cada entrada de site tem um filtro **Aplicar a**: todo conteúdo, criadores selecionados, todos exceto os criadores selecionados, tags selecionadas ou tudo exceto as tags selecionadas. Adicione outra entrada para o mesmo site se precisar de um filtro diferente.

Escolha determinadas tags ou tudo, exceto algumas tags. Uma regra pode combinar tags (**Gaming + Drama**), exigir confiança (**Gaming @3**) ou criar uma exceção (**!Tutorial**). **Cobrir conteúdo** mantém a correção de tags disponível. **Ocultar conteúdo** remove o item correspondente.

**Bloquear também conteúdo sem tag confiável** inclui resultados concluídos sem tag no limite de confiança padrão, inclusive resultados de baixa confiança. Regras listadas explicitamente são verificadas primeiro. **Sem tag** significa que a marcação terminou sem tags; **Marcando** significa que há um resultado pendente. A opção separada de conteúdo pendente controla a cobertura dos itens até o fim da marcação.

### Corrigir tags

Clique em **+ tag** ao lado das tags de um item para abrir o seletor de correção. Pesquise as tags existentes no Classifier e escolha uma para adicionar. Clique no controle de remoção de uma tag selecionada ou selecione-a e pressione Delete uma vez para removê-la. As correções são enviadas ao aplicativo conectado para desktop e usadas em futuras marcações. Uma pesquisa indisponível exibe **Sem tag** e pode ser repetida automaticamente; essa exibição não cria uma tag no Classifier.

## Configurações e conexão

**Mostrar o botão de adição rápida +** adiciona um pequeno botão às páginas compatíveis. Selecione um grupo de destino na lista; a escolha será lembrada quando o Vault for reaberto. Use o botão da página para adicioná-la à lista de sites. Em uma lista de permissões, isso permite a página. Grupos congelados não aceitam adições rápidas.

Os dicionários oficiais e a importação/exportação do dicionário pessoal são configurados no aplicativo desktop em **Configurações → Classificador → Dicionários oficiais**. O serviço pode ser contatado quando um criador não está no cache ou contribuições opcionais estão ativadas; a pesquisa na Web tem consentimento e configurações de provedor separados. Consulte o manual desktop e as divulgações.

A conexão com Classifier mostra o serviço local do Vault para desktop. Configure grupos Classifier, downloads de modelos, Knowledge, consentimento para pesquisa e provedores de API no aplicativo conectado para desktop.

Se faltarem tags, verifique se o aplicativo Vault para desktop está aberto, a conexão foi estabelecida, a marcação está ativada, o grupo Classifier pertinente foi retomado e o feed da plataforma está sendo registrado. Confira o estado do download do modelo no aplicativo para desktop. Se o bloqueio não funcionar, confira se o grupo está ativo e verifique os alvos, o cronograma, o tempo permitido e o estado do adiamento.
