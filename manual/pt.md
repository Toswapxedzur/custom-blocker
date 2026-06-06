# Bloqueador de Web Personalizado — Manual de Instruções

Este é o manual de referência completo para a extensão. Ele começa com os fluxos de trabalho mais fáceis e comuns e gradualmente avança para tópicos avançados, como regras de bloqueio personalizadas orientadas a eventos e a API auxiliar.

Se você for novo, basta ler **Início rápido** e **Visão geral dos grupos de bloqueio**. Tudo abaixo dessas seções é opcional, dependendo do que você deseja fazer.

---

## 1. O que esta extensão faz

O Custom Web Blocker permite bloquear sites e distrações online de acordo com regras que você mesmo define. Você pode:

- Bloqueie sites imediatamente com o bloqueio de rede nativo do navegador (o mesmo tipo de bloqueio que produz `ERR_BLOCKED_BY_CLIENT`).
- Permita-se um certo número de minutos por dia em um site e bloqueie-o quando ultrapassar esse limite.
- Bloqueie tipos específicos de conteúdo no Iutube, TiqueToque, Feicebuque, Instagrã, Tuíteche e Réditi (não no site inteiro).
- Oculte conteúdo bloqueado de feeds em plataformas suportadas, em vez de bloquear apenas páginas individuais.
- Programar quando uma regra está ativa por dia da semana e por janelas de horário `HHMM-HHMM`.
- Congelar uma regra para que você não possa alterá-la facilmente. O congelamento estrito o bloqueia por um determinado número de horas e requer um ritual de confirmação de 20 etapas para ser desfeito.
- Adie uma regra temporariamente, mas somente depois de escrever uma justificativa longa o suficiente.
- Escreva regras personalizadas **orientadas por eventos** em linguagem de scripts com auxiliares para temporizadores de avanço/retrocesso, armazenamento persistente por grupo, intenções DOM por plataforma (ocultar botões de navegação, ocultar cartões de feed por predicado, definir temporizadores por subseção), utilitários de URL e registro estruturado.
- Escolha em uma biblioteca integrada de mais de 50 modelos prontos (temporizadores, programações, ocultação de feed, sessões de foco, redirecionamentos, cutucadas, persistência, ajustes de DOM, auxiliares de depuração).
- Use a extensão em mais de 20 idiomas.

A extensão é uma extensão do navegador Cromo Manifest V3 com uma página de editor (o pop-up), um trabalhador de serviço em segundo plano, uma sandbox fora da tela que hospeda código de regra personalizado e um script de conteúdo que é executado em cada página. As regras personalizadas ficam na sandbox fora da tela; eles são carregados uma vez por clique em Executar e permanecem registrados até que a regra seja desativada ou excluída.

---

## 2. Tour pela IU

Quando você clica no ícone da extensão, o editor abre como uma página da web completa (não como um pequeno pop-up). A página possui estas áreas:

- **Barra superior**
  - Botão **Manual de Instruções** (este documento)
  - **Seletor de idioma**
  - **Configurações** engrenagem (alternações avançadas, incluindo **modo de depuração**)
- **Painel esquerdo — Grupos de blocos**
  - Lista dos seus grupos de blocos. Cada cartão mostra o nome do grupo, uma pequena linha de resumo e uma caixa de seleção para ativar/desativar.
  - O botão **Adicionar** cria um novo grupo. O menu suspenso próximo a ele escolhe o tipo.
  - **Excluir tudo** remove todos os grupos, com confirmações extras se algum grupo estiver congelado.
  - Você pode arrastar a alça `::` em um cartão para cima ou para baixo para reordenar grupos.
  - Você pode arrastar o divisor vertical para redimensionar este painel.
- **Painel direito — Editor**
  - Edita o grupo atualmente selecionado: nome, comportamento de bloqueio, listas de bloqueio, filtros específicos do tipo, agendamento, congelamento, soneca.
  - Todas as alterações são salvas automaticamente uma fração de segundo depois que você para de digitar ou interagir.
  - Para grupos **Personalizados**, o editor também mostra o navegador **Modelos**, o botão **Executar** e o painel **Log** (renomeado de *Log de atividades* na v1.1).
- **Toast** (pop-up centralizado que desaparece) — mostra mensagens de status como "Alterações salvas". ou erros de entrada.
- **Sobreposição na página** — embora uma guia tenha algum temporizador ou bloco ativo, uma sobreposição aparece no canto superior esquerdo mostrando todas as restrições que a afetam no formato `hh:mm:ss` (ou `mm:ss`). Múltiplas restrições são empilhadas em múltiplas linhas. Contagens regressivas de grupos de blocos padrão e temporizadores de regras personalizadas compartilham essa sobreposição.

---

## 3. Início rápido1. Clique no ícone da extensão. O editor abre como uma página inteira.
2. No painel **Bloquear grupos**, escolha um tipo de grupo no menu suspenso:
   - `Default`, `Iutube`, `TiqueToque`, `Feicebuque`, `Instagrã`, `Tuíteche`, `Réditi` ou `Custom`.
3. Clique em **Adicionar**. Um novo grupo aparece e o editor o abre.
4. Dê um nome a ele.
5. Preencha os campos específicos do tipo (para `Default`, isso significa a lista **Sites bloqueados**).
6. Certifique-se de que a caixa de seleção do grupo no painel esquerdo esteja ativada.
7. Visite um dos sites listados. O bloqueio deve entrar em vigor imediatamente.

Esse é todo o caminho feliz. O resto deste manual são apenas opções além disso.

> Quando você pressiona **Executar** em um grupo personalizado, a nova regra é anexada a eventos de página **futuros**. As guias já abertas continuam executando a regra anterior até que você as recarregue. O pop-up mostra um lembrete nesse sentido após cada execução bem-sucedida.

---

## 4. Visão geral dos grupos de blocos

Tudo nesta extensão é organizado como **grupos de blocos**. Um grupo de blocos é um conjunto de regras:

- Possui um nome, um tipo e um estado habilitado/desabilitado.
- Possui comportamento de bloqueio (imediato, após alguns minutos ou contagem regressiva fixa).
- Possui programação opcional (dias + janelas de tempo) e controles opcionais de congelamento/soneca.
- Dependendo do tipo, possui campos adicionais, como uma lista de sites, filtros de criadores do Iutube, nomes de subreddit ou uma regra linguagem de scripts orientada a eventos.

Você pode ter qualquer número de grupos. Vários grupos podem se inscrever na mesma página; nesse caso, a regra **mais rigorosa** vence:

- “Bloquear imediatamente” é melhor do que “bloquear depois de algum tempo”.
- Um grupo com menos tempo restante vence um grupo com mais tempo restante.

Portanto, adicionar mais grupos só pode bloquear a página mais cedo, nunca mais tarde.

**A ordem de avaliação é de baixo para cima.** Quando a extensão itera seus grupos de blocos, ela começa com o grupo na parte inferior da lista e segue subindo. O grupo no topo da lista é avaliado por último e obtém a "última palavra" — por exemplo, se um grupo inferior chamar `helpers.getPlatformHelper().youtube().hideShortButton()` e um grupo superior chamar `showShortButton()`, o botão permanecerá visível. Arraste a alça `::` em um cartão para alterar esta ordem.

---

## 5. Tipos de grupo

### 5.1 `Default` — bloquear sites comuns

Para bloquear domínios específicos (o caso de uso típico).

- **Sites bloqueados**: um site por linha. Tanto `facebook.com` quanto `https://www.facebook.com/somepage` funcionam; a extensão extrai e normaliza o nome do host.
- Uma regra de site se aplica a esse nome de host e a todos os seus subdomínios.
- Este tipo de grupo usa o bloqueio de rede nativo do navegador Cromo, semelhante ao `ERR_BLOCKED_BY_CLIENT`. Isso significa que a navegação para um URL bloqueado é interrompida antes mesmo de a página carregar.

### 5.2 `Iutube` – bloquear Iutube e sites de vídeo semelhantes

Adiciona uma seção **Filtros** ao editor:

- **Tipo de conteúdo**:
  - `Apply to all Iutube pages` — cada página do Iutube conta.
  - `Apply to Shorts` — apenas contam páginas de Shorts.
  - `Apply to long videos` — apenas `/watch`, `/live/`, `/embed/`, etc.
  - `Apply to Iutube posts` — postagens da comunidade (`/post/...`, guias comunidade/postagens do canal).
- **Filtro de autor**:
  - `Do not filter by author` — a identidade do autor não importa.
  - `Apply to certain authors` — apenas autores listados acionam este grupo.
  - `Apply to all except certain authors` — os autores listados estão isentos.
- **Autores**: um autor por linha. Aceita `@handle`, URLs completos, `/channel/UC...`, `/c/...`, `/user/...`.
- **Ocultar entradas bloqueadas no feed do Iutube**: enquanto este grupo estiver bloqueando ativamente, os cartões correspondentes nos feeds do Iutube ficarão ocultos. Quando o bloco fica inativo, eles voltam na próxima atualização.

Para tipos de conteúdo de Shorts e Postagens, quando nenhum filtro de autor está definido e o grupo está bloqueado no momento, a extensão também oculta entradas de navegação relevantes (entrada da barra lateral de Shorts, guias de canal Comunidade/Postagens) e as prateleiras correspondentes, como "Últimas postagens do Iutube".

A detecção de curto versus longo se estende a outros sites de vídeo, como TiqueToque, Vimeo, clipes/VODs Tuíteche e Dailymotion, quando seu formato de página pode ser detectado.

### 5.3 `TiqueToque` – bloquear conteúdo do TiqueToque

O mesmo cartão de editor do editor de vídeo da plataforma, mas com rótulos específicos do TiqueToque:- Tipos de conteúdo: vídeos curtos, vídeos, páginas de perfil.
- Autores: identificadores TiqueToque (`@handle`) ou URLs de perfil.
- A ocultação de feed oculta cartões correspondentes nas páginas do TiqueToque enquanto o grupo está ativo.

### 5.4 `Feicebuque` – bloquear conteúdo do Feicebuque

- Tipos de conteúdo: Reels, vídeos, posts.
- Autores: nome da página (`page.name`), URL do perfil ou formulário `profile.php?id=...` (o id numérico é preservado como `id:<number>`).
- A ocultação de feed oculta os cartões de feed correspondentes no Feicebuque.

### 5.5 `Instagrã` – bloquear conteúdo do Instagrã

- Tipos de conteúdo: Reels, vídeos, posts.
- Autores: identificadores do Instagrã ou URLs de perfil.
- Caminhos reservados como `/reel/`, `/p/`, `/tv/`, `/explore/` não são tratados como autores.
- A ocultação de feed oculta cartões correspondentes no Instagrã.

### 5.6 `Tuíteche` – bloquear conteúdo do Tuíteche

- Tipos de conteúdo: clipes, streams/VODs, páginas de canais.
- Autores: nomes de canais ou URLs de canais.
- Caminhos reservados como `/directory`, `/videos`, `/settings`, etc. não são tratados como nomes de canais.
- Ocultação de feeds esconde cartas correspondentes no Tuíteche.

### 5.7 `Réditi` – bloquear Réditi ou subreddits específicos

- **Subreddits**: um subreddit por linha. Lista vazia significa que o grupo se aplica a todo o Réditi. Tanto `productivity` quanto `r/productivity` são aceitos.

### 5.8 `Custom` — bloqueio por linguagem de scripts orientado a eventos

Você escreve uma função linguagem de scripts que **registra manipuladores** para eventos como abertura de página, alteração de URL, pulsação da página, término do cronômetro e seus próprios eventos personalizados. A função é executada uma vez por clique em Executar; os manipuladores registrados permanecem ativos nas navegações até você clicar em Executar novamente, desativar o grupo ou excluí-lo.

Os grupos `Custom` não mostram: comportamento de bloqueio, sites bloqueados, minutos permitidos, intervalo de redefinição, dias agendados ou janelas de tempo. Eles mantêm o editor de **Regras de bloqueio** além de controles padrão de congelamento/soneca. Há também um botão **Modelos** que abre um navegador predefinido com regras iniciais parametrizadas; aplicar uma predefinição substitui a regra atual após a confirmação.

Consulte a **Seção 11** para obter a referência completa de regras personalizadas e a API auxiliar.

---

## 6. Comportamento de bloqueio

Para a maioria dos tipos de grupo você escolhe um dos três modos.

### 6.1 Bloquear imediatamente

A regra fica ativa sempre que o grupo está ativado, a programação permite e (para grupos de plataforma) a página corresponde.

Para grupos `Default`, isso usa o bloqueio nativo do navegador Cromo. Para grupos de plataformas, ele usa a lógica de sobreposição/saída na página.

### 6.2 Bloqueio após alguns minutos

Este é um orçamento de uso.

- **Minutos permitidos antes do bloco** (decimal): quantos minutos você se permite por período. Exemplo: `15`, `0.5`, `90`.
- **Intervalo de reinicialização do cronômetro (horas)** (decimal): com que frequência o orçamento é redefinido. Exemplo: `24` para diário, `1` para horário, `0.25` para cada 15 minutos.

Enquanto sobrar tempo, a página funciona normalmente e mostra a sobreposição do cronômetro. Quando o orçamento chega a zero, a página fica bloqueada pelo resto do período e a sobreposição mostra `0:00`, então a guia tenta sair.

A extensão é por grupo, por período:

- Cada grupo tem seu próprio orçamento.
- O tempo gasto em qualquer página que corresponda ao grupo conta para o orçamento desse grupo.
- Várias guias no mesmo grupo compartilham o orçamento. Seus temporizadores permanecem sincronizados; mudar para outra guia também força uma atualização para mostrar imediatamente o tempo compartilhado atual.

Se vários grupos com limite de tempo se aplicarem à mesma página, o mais restrito vence.

### 6.3 Temporizador (contagem regressiva e depois bloqueio)

Este modo mostra um cronômetro de contagem regressiva e bloqueia quando atinge `0:00`.

- **Intervalo de reinicialização do temporizador (horas)** (decimal): a duração do temporizador e a frequência de reinicialização. Exemplo: `24` para diário, `1` para horário, `0.25` para cada 15 minutos.

Ao contrário de **Bloquear após alguns minutos**, este modo **não** tem um campo separado "Minutos permitidos antes do bloqueio". O cronômetro simplesmente inicia no intervalo de reinicialização, faz a contagem regressiva enquanto as páginas correspondentes estão abertas e bloqueia até a próxima reinicialização.As contagens regressivas do grupo padrão e os temporizadores do grupo personalizado (consulte a **Seção 11.3.1**) **só avançam enquanto a guia estiver visível**. Alternar guias, minimizar a janela ou bloquear a tela pausa a contagem regressiva automaticamente.

---

## 7. Cronograma

No cartão **Agendar** você pode restringir quando um grupo está ativo:

- **Dias para bloquear**: escolha os dias em que o grupo se aplica. Dias desmarcados significam que o grupo está inativo naquele dia.
- **Janelas de tempo**: lista de formato livre, uma janela por linha no formato `HHMM-HHMM`, por exemplo:

  ```
  0900-1000
  1200-1300
  ```

  O grupo está ativo apenas dentro dessas janelas. Lista vazia significa o dia todo.

Isto se aplica a todos os tipos de grupo, exceto `Custom`. (As regras personalizadas podem implementar sua própria programação usando `ev.time.dayName` / `ev.time.hour`; consulte **Seção 11.4**.)

---

## 8. Congelar (anti-adulteração)

O congelamento torna difícil desativar um grupo por impulso.

No cartão **Congelar** você escolhe:

- **Congelado** — você não pode editar ou excluir o grupo e não pode desmarcar seu botão de ativação. Para alterar qualquer coisa você deve executar o ritual de descongelamento (veja abaixo).
- **Congelado estrito** — igual ao Congelado, mas permanece bloqueado por um número de horas que você escolher (decimal, até 72). Até que esse cronômetro expire, até mesmo o ritual de descongelamento estará indisponível.

Quando um grupo congelado pode ser desbloqueado, o botão **Descongelar** aparece. Clicar nele inicia o **ritual de 20 etapas**:

- O modal mostra uma mensagem de autodisciplina.
- Você deve clicar em `Confirm` 20 vezes.
- Há uma espera forçada de 5 segundos entre os cliques.
- Se você cancelar a qualquer momento, deverá reiniciar a partir do passo 1.
- As 20 mensagens giram para que você realmente as leia.

Se o grupo também estiver marcado como "sem soneca" (veja a próxima seção), você também não poderá adiá-lo enquanto estiver congelado.

O status de congelamento é mostrado na linha meta do cartão de grupo, incluindo o tempo restante para o congelamento estrito.

---

## 9. Soneca (desativação temporária)

A suspensão desativa temporariamente um grupo sem descongelá-lo. Ele suporta ativação atrasada, resfriamento pós-soneca, etapas de confirmação e um total contínuo de tempo de suspensão.

No cartão **Suspender**:

- **Permitir adiamento para este grupo** — se estiver desativado, este grupo não poderá ser adiado (inclusive enquanto estiver congelado).
- **Suspender por (minutos)** — decimal, quanto tempo dura a soneca.
- **Atraso de ativação (minutos)** — decimal `>= 0`. Depois de confirmar a soneca, o grupo continua bloqueando até que esse atraso passe; só então a soneca se torna ativa.
- **Resfriamento após soneca (minutos)** — decimal de `0` a `5`. Depois que a soneca terminar, você não poderá iniciar outra soneca para este grupo até que o tempo de espera termine.
- **Tempos de confirmação** — inteiro `>= 0`. Se for `0`, a soneca será agendada imediatamente. Caso contrário, iniciar a soneca inicia um ritual de confirmação com exatamente esse número de etapas.

Cada etapa de confirmação da soneca tem uma espera forçada de **5 segundos** antes que o próximo clique seja permitido. O modal informa isso explicitamente e mostra a contagem regressiva ao vivo no botão.

Se o grupo estiver congelado, as configurações de soneca serão bloqueadas nos valores escolhidos antes do congelamento. Você ainda pode suspendê-lo, desde que a suspensão seja permitida, mas você deve usar as configurações de atraso/recarga/confirmação salvas.

O cartão Suspender também mostra o **Tempo total de adiamento** para esse grupo. Esse total conta a duração total da soneca ativa, mesmo que o site fique acessível por algum outro motivo durante essa janela.

Quando uma soneca termina, a regra volta imediatamente. Se o grupo ainda não estiver congelado, o ramal o congela automaticamente novamente no final da soneca.

Uma mensagem de status confirma a soneca. Quando a soneca termina, o grupo volta automaticamente ao normal.

Você também pode encerrar uma soneca mais cedo com o botão **Encerrar soneca**.

Para grupos personalizados, pressionar **Iniciar soneca** também despacha um evento `snoozePress` para a regra (consulte a tabela de eventos na **Seção 11**), para que uma regra personalizada possa registrar a imprensa, registrar uma justificativa ou disparar eventos de acompanhamento. A regra **não possui API de suspensão programática** — ela pode reagir à imprensa, mas não pode cancelá-la ou estendê-la.

---

## 10. Ações em massa- **Excluir tudo** remove todos os grupos.
  - Sempre pede confirmação.
  - Se pelo menos um grupo estiver congelado, será necessário o mesmo ritual de 20 passos do descongelamento.
  - Se algum grupo estiver totalmente congelado e ainda bloqueado, **Excluir tudo** será desativado.

---

## 11. Grupos personalizados — referência orientada a eventos (v1.1+)

A partir da v1.1, as regras personalizadas são **orientadas por eventos**. Sua regra não é mais uma função por pulsação cujo valor de retorno bloqueia a página. Em vez disso, o corpo da regra é um script que **registra manipuladores** para eventos específicos (página aberta, alteração de URL, pulsação da página, eventos personalizados,…). Os manipuladores permanecem registrados nas navegações de página e nas alternâncias de guias e ficam dentro de uma **sandbox fora da tela** de longa duração.

O corpo da regra é executado **uma vez por clique em Executar** (ou uma vez quando o grupo está habilitado e já existe uma origem ativa). Para recarregar manipuladores, clique em **Executar** no editor. O pop-up mostra um lembrete solicitando que você recarregue qualquer página já aberta para que a nova regra se aplique a ela também.

### 11.1 Assinatura da regra

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Dois argumentos:

- `event` — o **registro de eventos** deste grupo. Use-o para registrar, substituir, listar, contar ou cancelar o registro de manipuladores e para eventos personalizados `post(...)`.
- `helpers` — o pacote auxiliar (consulte **11.3**).

**não** se espera que a função retorne um valor. A decisão de bloquear ou permitir é tomada posteriormente, quando um evento é acionado e um de seus manipuladores registrados chama `ev.preventDefault()` e/ou `ev.setResult(...)`.

### 11.2 Ciclo de vida

- **Executar** (botão por grupo no editor): o mecanismo primeiro limpa todos os manipuladores que foram previamente marcados com esse grupo e, em seguida, executa novamente o corpo da regra na sandbox fora da tela. Esta é a única maneira de se registrar novamente após editar a fonte.
- **Desativar grupo**: todos os manipuladores marcados com este grupo são apagados. A origem do grupo é mantida no armazenamento, mas para de responder aos eventos.
- **Reativar grupo**: o mecanismo reexecuta automaticamente a fonte ativa para este grupo.
- **Excluir grupo**: o mesmo que desabilitar; todos os manipuladores marcados com o grupo são apagados.
- **Registrando novamente com o mesmo `(eventType, id)`**: substitui silenciosamente o registro anterior.

A sandbox fora da tela é compartilhada por **todos** grupos personalizados. Manipuladores de diferentes grupos coexistem lá, cada um marcado internamente com seu ID de grupo proprietário, para que "Executar", desabilitar ou excluir apenas toque no grupo certo.

Se uma regra personalizada se comportar mal (loop infinito síncrono, spam de log descontrolado etc.), o sandbox a colocará em quarentena: o grupo será desativado automaticamente e a falha será registrada para que você possa vê-la no painel Log. Para reativar uma regra em quarentena, corrija a origem e clique em **Executar** — o mecanismo limpa o motivo da interrupção e recarrega a regra.

### 11.2.1 O registro de eventos (`event`)

Métodos genéricos:

- `event.register(type, id, handler, options?)` — registra um manipulador para um tipo de evento arbitrário. `id` é sua escolha. `options.priority` (padrão `0`) — os valores mais altos são executados primeiro. `options.intervalMs` — apenas para `tickEvent`; limitar este manipulador específico em relação ao tick global. Registrando novamente com as mesmas substituições `(type, id)`.
-`event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — dispara um evento personalizado. `scope: "global"` atinge todos os grupos; o padrão `scope: "group"` alcança apenas manipuladores no **mesmo** grupo.

Açúcar por tipo de evento (um conjunto de métodos por tipo integrado):

-`event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
-`event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Mesma forma para `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Tipos de eventos integrados

| Tipo | Quando dispara | Carga útil `ev.data` |
|---|---|---|
| `tickEvent` | Tick ​​de 1 segundo compartilhado globalmente em todo o navegador. Dispara independentemente da visibilidade da guia. Use isso para lógica estilo relógio que deve continuar funcionando mesmo quando nenhuma guia está em foco. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | Pulsação de aproximadamente 250 ms na guia **ativa**, **visível**. Aciona toda a lógica com reconhecimento de visibilidade de guias, incluindo a marcação automática incorporada no `getOrCreateTimer({ scope })`. **não** dispara a partir de guias em segundo plano ou enquanto a tela está bloqueada. | `{ elapsedMs }` |
| `openWebEvent` | Uma nova guia é criada OU uma nova navegação chega a uma URL que o mecanismo ainda não viu para essa guia. **não** dispara novamente para guias já abertas após um clique em Executar. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Uma guia está fechada. | `{ reason, nextUrl }` |
| `switchWebEvent` | **Alterações** de URL dentro da mesma guia — voltar/avançar, alteração de rota do SPA ou uma navegação que leva a um URL diferente do anterior. **não** dispara em uma recarga simples (mesmo URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | A alteração de URL ultrapassa um limite de nome de host (por exemplo, `youtube.com` → `wikipedia.org`). Dispara ao lado de `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | A página (re)carrega de qualquer forma: abertura, troca, atualização do histórico do SPA, **ou uma recarga simples que mantém o mesmo URL**. Este é o gancho confiável "a página mudou, reavalie tudo". Dispara junto com `openWebEvent`/`switchWebEvent`/`switchDomainEvent` e é o único que dispara para recargas no mesmo URL. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` onde `transition` é `"tabCreated"`, `"commit"` ou `"history"` |
| `timerEnded` | Um temporizador gerenciado pelo grupo chega a `currentMs === 0`. Entregue apenas ao grupo proprietário. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | O usuário pressionou **Iniciar soneca** no pop-up deste grupo **personalizado**. Evento de notificação pura — o manipulador pode executar código arbitrário (registrar, redirecionar, disparar outros eventos), mas as regras personalizadas **não possuem API de suspensão programática**. Os registros produzidos aqui aparecem como brindes na guia ativa. Entregue apenas ao grupo pressionado. | `{ triggeredAt }` |

URLs em `ev.url` e em dados de eventos são **normalizados** para eventos: a página Nova guia do navegador Cromo (que renderiza a superfície "Pesquise no Google ou digite URL" do Google), `about:blank` e esquemas de nova guia equivalentes são expostos como a string vazia `""`. Portanto, um cronômetro com escopo definido para `ev.url === ""` apenas funciona enquanto você está na página da nova guia. URLs `google.com` normais permanecem inalterados.

### 11.2.3 O objeto de evento (`ev`)

Cada manipulador é invocado como `(ev, helpers) => void`. `ev` carrega:

- `ev.type` — o tipo de evento despachado.
- `ev.groupId` — o id do grupo receptor.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — contexto para o evento.
- `ev.time` — Instantâneo `{ now, month, dayOfMonth, dayName, hour, minute }` no envio. `dayName` é `"Sunday"`..`"Saturday"`.
- `ev.data` — carga útil específica do evento (veja tabela acima).

Métodos:

- `ev.preventDefault()` — marque o despacho como "bloqueado". O script de conteúdo do host sairá da página (ou seguirá `setRedirectLink`), a menos que um manipulador de prioridade mais alta defina `setResult(1)` posteriormente.
- `ev.stopPropagation()` — interrompa este envio imediatamente. **Nenhum outro manipulador em qualquer grupo** é invocado para este evento.
- `ev.setResult(value)` — define o resultado do despacho. `value` pode ser um **número** em `[-255, 255]` (bloco `-1`, `0` neutro, `1` permitido; outros números inteiros são preservados para sua própria lógica de depuração) ou uma **string** (interpretada como um URL de redirecionamento). A última chamada `setResult` em todos os manipuladores vence. Um `1` numérico substitui qualquer `preventDefault` anterior.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — a URL para a qual o host deve navegar quando o despacho terminar como bloqueado. Esta é a **única** maneira de redirecionar a partir de regras personalizadas; o editor não expõe mais o campo "Redirecionar URL quando bloqueado" para grupos personalizados.
- `ev.post(type, data, { scope })` — dispara um evento de acompanhamento de dentro de um manipulador.

Além disso, `ev` é um proxy: qualquer campo definido nele (por exemplo, `ev.foo = 42`) é armazenado em um mapa `custom` e pode ser lido do mesmo manipulador ou de manipuladores posteriores no mesmo despacho.### 11.3 O objeto `helpers`

Cada chamada de manipulador recebe um novo pacote `helpers` com escopo para o grupo de recebimento e o URL do evento. Campos constantes:

- `helpers.now` — milissegundos de época no despacho.
- `helpers.currentUrl` — a URL do evento, após a normalização newtab/blank.
- `helpers.groupId` — recebendo ID do grupo.

Atalhos de conveniência (direcione para as mesmas funções com reconhecimento de acumulador usadas pelos ajudantes abaixo, para que a saída ainda chegue ao painel Log):

-`helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Métodos de acesso:

- `helpers.getLogHelper()` — `log` / `warn` / `error`. A saída é limitada por taxa e limitada por despacho para evitar que regras descontroladas congelem o pop-up.
- `helpers.getDomainHelper()` (também conhecido como `helpers.getDomainUtility()`) — inspeção de URL (consulte **11.3.5**).
- `helpers.getTimerHelper()` — temporizadores com escopo de grupo (contagem regressiva/crescente); o estado persiste durante as reinicializações do navegador.
- `helpers.getPersistenceHelper()` — armazenamento de chave/valor JSON com escopo para o grupo.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (e aliases `set` / `get`) mais `createMessageUrl(message)` que retorna um URL `chrome-extension://...` que exibe a mensagem fornecida.
- `helpers.getPlatformHelper()` — intenções DOM por plataforma (consulte **11.3.6**).
- `helpers.getDOMHelper()` — intenções DOM genéricas: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. As operações são agrupadas e aplicadas após o retorno do manipulador.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Os efeitos são aplicados à guia de onde veio o evento.
- `helpers.getStorageHelper()` — superconjunto de `getPersistenceHelper` mais ganchos assíncronos `requestAsyncGet(key)` / `requestAsyncSet(key, value)` para armazenamento de extensão cruzada (os resultados chegam como um evento personalizado de acompanhamento).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` em um instantâneo incluído no evento.

Todos os métodos auxiliares são seguros: parâmetros incorretos retornam `null`, `false` ou um valor vazio em vez de serem lançados.

#### 11.3.1 `getTimerHelper()`

Temporizadores por grupo. Cada temporizador é identificado por uma string `id` que você escolher; a identidade tem como escopo o grupo, portanto, dois grupos podem usar o id `"yt-shorts"` sem colidir. O estado persiste durante as reinicializações do navegador.

O estado persistente de um temporizador é exatamente: `id`, `displayName`, `direction` (`"forward"` ou `"backward"`), `isPaused` e `currentMs`. Não há "duração inicial" armazenada - `isExpired` é apenas `currentMs === 0`. Os cronômetros de avanço funcionam para sempre e nunca expiram por conta própria. Os temporizadores retrógrados param de funcionar em `0` (sem valores negativos).

Existem dois métodos de construção. Escolha aquele cuja semântica corresponda ao que você deseja:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **sempre (re)cria** o temporizador com os valores init fornecidos, substituindo qualquer estado existente, incluindo `currentMs`. Use isto quando quiser dizer "começar do zero", por ex. dentro de um ramo de reinicialização única.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotente**. Se já existir um temporizador com esse `id`, seu `displayName` e `direction` poderão ser atualizados, mas `currentMs` será preservado. Caso contrário, será criado com os valores init fornecidos. Isso é o que você deseja para o padrão comum "garanta que meu cronômetro exista e deixe-o funcionar".

Ambos os métodos aceitam duas funções de predicado que o mecanismo lembra durante a vida útil da regra (elas sobrevivem entre pulsações e reavaliações `webChangedEvent`, mas **nunca persistem** no armazenamento):- `scope: (url) => boolean` — quando `true` para o URL visível atual em cada `pageHeartbeatEvent`, o cronômetro marca automaticamente pelo intervalo de pulsação (~250 ms). O próprio ajudante nunca bloqueia; ele atualiza apenas `currentMs`. No máximo um tique automático por batimento cardíaco por temporizador.
- `domain: (url) => boolean` — quando `true` para o URL visível atual, o cronômetro é renderizado na sobreposição na página (canto superior esquerdo). Quando `domain` é omitido, o mecanismo volta para `scope` para exibição, portanto, um temporizador de "tick on /shorts/pages" também aparece sem fiação extra. Forneça `domain` explicitamente se desejar uma porta de exibição diferente (por exemplo, marque apenas `/shorts/`, mas mostre o tempo restante em todos os `youtube.com`).

> **Importante — um cronômetro nunca bloqueia sozinho.** Quando um cronômetro regressivo chega a zero, ele apenas para em zero e dispara `timerEnded` uma vez. O bloqueio real da página depende de um manipulador `openWebEvent` / `switchWebEvent` separado que chama `ev.preventDefault()` após verificar `helpers.getTimerHelper().isExpired(id)`. Essa separação permite que você crie temporizadores "somente aviso", rastreadores de contagem progressiva, toques suaves ou blocos rígidos - o mesmo primitivo, sua escolha.

Outros métodos:

- `delete(id)`, `pause(id)`, `resume(id)` — ciclo de vida padrão. Pausa congela `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — mutadores diretos (a maioria das regras não precisa deles — deixe a pulsação marcar o cronômetro para você).
- `setDisplayName(id, name)` — reetiquetar.
-`getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` se `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` ou `null`.
- `list()` — cada temporizador que este grupo possui, como uma matriz de objetos de estado.

#### 11.3.2 `getPersistenceHelper()`

Armazenamento semelhante a um mapa com escopo para seu grupo. Os valores devem ser serializáveis ​​por JSON.

-`set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Limites flexíveis: cerca de 200 chaves por grupo, 16 KB por valor.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — escreva no painel **Log** no pop-up (o pacote auxiliar ainda os encaminha através do mesmo acumulador, independentemente do despacho que os produziu). Cada linha é prefixada com `[CustomBlocker:groupId]`.
- O auxiliar tem limites rígidos: aproximadamente **200 entradas de log por despacho** e um comprimento máximo de string por entrada. As entradas excedentes são descartadas e contadas em `accumulator.logsDropped`. Isso é o que protege o pop-up de um `for (let i = 0; i < 100000; i++) helpers.log(i)` em fuga.
- Quando o **modo de depuração** está desativado (padrão), as entradas em nível de rastreamento que o próprio mecanismo emite (início de despacho/tempo do manipulador) são suprimidas em todos os lugares — elas não aparecem no painel Log e não são impressas no console. Suas próprias chamadas `log` / `warn` / `error` sempre são realizadas.

#### 11.3.4 `getRedirectionHelper()`

Inspecione/substitua o URL de redirecionamento que o script de conteúdo usará se a página atual for bloqueada.

- `get()` — retorna o URL de redirecionamento efetivo atual para este despacho. Inicialmente, este é o URL substituto configurado do grupo integrado (se houver), caso contrário, `""`.
- `set(url)` — substituições que redirecionam URL para este despacho. Retorna `true` em caso de sucesso, `false` para entrada sem string. Passar `""` limpa a substituição de redirecionamento e retorna ao comportamento de saída padrão normal.
- `createMessageUrl(message)` — retorna uma URL `chrome-extension://<id>/message-page.html?msg=...` que, quando navegada, exibe a mensagem centralizada em uma página limpa. Útil para redirecionar usuários para uma tela "Vá trabalhar"/"Faça uma pausa" após o término do cronômetro. Exemplo: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Assim como os outros efeitos colaterais das regras personalizadas, esse estado é compartilhado por todas as regras do despacho atual. Como as regras são executadas de baixo para cima, a regra mais alta para chamar `set(...)` vence.

#### 11.3.5 `getDomainHelper()` (também conhecido como `getDomainUtility()`)

Auxiliares de inspeção de URL. Não há `normalize()` porque os URLs recebidos já são normalizados por newtab.

Essencial:-`hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
-`isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — cada um retorna `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

Filtragem de URL e ajudantes de seção:

- `isEmptyStartPage(url)` — `true` para a página de nova guia e equivalentes (os URLs que aparecem como `""` para manipuladores).
- `matchesAny(url, patterns)` — `patterns` pode ser um regex, um regex de string ou uma matriz de ambos.
- `pathStartsWith(url, path)` — com reconhecimento de limite (`pathStartsWith("/r/", "/r")` é verdadeiro; `"/results/"` não é).
- `queryHas(url, key, value?)`, `queryGet(url, key)` — inspeção de string de consulta.
- `isSearchPage(url)` — reconhece pesquisas do Google / Bing / DuckDuckGo / Iutube / Réditi / Tuíter / X.
- `isInfiniteFeedUrl(url)` — reconhece as superfícies de feed algorítmico do Iutube, TiqueToque, Instagrã, Feicebuque, Réditi, X.
- `sameSection(a, b)` — mesmo nome de host E mesmo primeiro segmento de caminho.

#### 11.3.6 `getPlatformHelper()`

Intenções DOM por plataforma e temporizadores de subseção, além de inspeção. Cada `helpers.getPlatformHelper().<platform>()` retorna um objeto cujo conjunto de métodos é **bloqueado pela plataforma** — métodos que não fazem sentido em uma determinada plataforma estão simplesmente ausentes, portanto, chamá-los lança `TypeError: ... is not a function` em vez de ficar silenciosamente sem operação. Por exemplo, `twitch().hidePosts` não existe (Tuíteche não tem postagens) e `tiktok().hideShortButton` não existe (toda a experiência do TiqueToque já _é_ um vídeo curto). Use `helpers.getPlatformHelper().hasMethod(platform, name)` ou `.listMethods(platform)` para introspecção em tempo de execução.

Matriz de método por plataforma:

| método | youtube | tiktok | Instagrã | facebook | contrair |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VODs) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (bate-papo) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

Os nomes nativos da plataforma (`hideReels`, `hideClips`, `hideStreams`) NÃO são buckets separados de `hideShorts`/`hideVideos` — o slot de armazenamento é o mesmo; apenas o nome visível ao usuário segue a terminologia de cada plataforma.

> **Vida útil predicada e regra de slot único.** Cada um dos `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` possui **um** predicado persistente por `(group, platform, slot)`. O predicado **não** tem como escopo o evento atual — depois de definido, ele permanece ativo em cada carregamento de página e em cada despacho até que o `show*()` correspondente seja chamado ou o grupo seja descarregado. Chamar o mesmo método novamente com uma nova função **substitui** a anterior — o mecanismo nunca mescla vários predicados em um único grupo. Para combinar condições, escreva um predicado que faça você mesmo a combinação, por exemplo. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. Em **diferentes** grupos, cada grupo contribui com seu próprio predicado e um item fica oculto se o predicado de algum grupo corresponder.

Os métodos de inspeção obtêm seu valor no momento da expedição a partir de um instantâneo incluído no evento; sua disponibilidade é controlada pela matriz acima.

Os classificadores de URL são sempre reexpostos, independentemente da plataforma: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Os cronômetros de subseção registram o cronômetro no bucket do grupo persistente e, quando com escopo definido, marcam apenas os URLs que correspondem a essa subseção. Os métodos de timer aceitam `{ id, direction, currentMs, displayName }` e seguem o mesmo gate por plataforma.

Para métodos de predicado, o predicado é chamado por cartão correspondente com um `item` normalizado: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Qualquer campo pode ser `null`; "inocente até que se prove a culpa" — retorne `false` quando o campo que você precisa estiver faltando.

### 11.4 Exemplos

**Fácil** — bloqueie as páginas de Shorts do Iutube nas manhãs dos dias de semana:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Médio** — orçamento diário de 30 minutos para Iutube Shorts. O cronômetro marca automaticamente em `pageHeartbeatEvent`s enquanto um URL de Shorts está visível; um manipulador separado impõe o bloco quando o cronômetro chega a zero.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Mais difícil** — oculte Shorts individuais do Iutube cujo identificador de autor seja muito longo e injete um CSS "este Short está oculto":

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**Mais difícil** — transmite um evento personalizado de um manipulador para outros:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Modelos

Cada grupo Personalizado tem um seletor de **Modelos** que abre um navegador predefinido pesquisável. A biblioteca agora fornece **mais de 50 modelos** organizados em nove categorias para que você possa navegar em vez de escrever regras do zero:

| Categoria | Exemplos |
|---|---|
| **Temporizadores** | Orçamento de tempo do site (contagem regressiva + bloqueio), rastreador de tempo do site (contagem crescente), limite de Shorts do Iutube, limite de feed do TiqueToque, limite de Instagrã Reels, limite de Feicebuque Reels, limite de Tuíteche Clips, orçamento de distração universal, rastreador de trabalho profundo diário |
| **Programação** | Bloqueio de horário de trabalho durante a semana, sites somente nos finais de semana, desligamento antes da hora de dormir, permissão apenas de uma hora, notícias somente para o almoço, recomeço na segunda-feira, permissão dos primeiros N minutos de cada hora, bloqueio estrito de trabalho profundo |
| **Alimentação/Shorts** | Bloquear URLs de Shorts do Iutube, ocultar cartões de Shorts, ocultar Shorts por palavra-chave, ocultar feed / comentários / tendências da página inicial do Iutube, bloquear TiqueToque FYP, ocultar shorts do TiqueToque, bloquear URLs de Instagrã Reels, ocultar feed de Instagrã Reels, ocultar feed / Reels do Feicebuque, ocultar Réditi / Tuíter / LinkedIn home |
| **Redirecionar** | Distrações → página de foco, Shorts → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, nova guia → lista de tarefas |
| **Foco** | Sessão de foco somente na lista de permissões, Pomodoro 25/5, bloqueio durante a reunião, bloqueio após N visitas hoje, bloqueio em caso de perda consecutiva |
| **Empurrão** | Registrar cada visita de distração, avisar sobre cada visita de Shorts, contar visitas diárias a um site |
| **Persistência** | Limite de visitas mensais, alternância de banimento semanal, rastreamento de canais Discórdia visitados |
| **Ajustes no DOM** | Ocultar alternância de reprodução automática do Iutube, ocultar Tuíter / X “O que está acontecendo”, genérico “ocultar seletores em um site” |
| **Depurar** | Contagem regressiva de demonstração (3 s), registre todos os eventos personalizados |

Os chips de filtro na parte superior do seletor restringem a lista por categoria (`Timer`, `Schedule`, `Feed`,…) e plataforma (`Iutube`, `TiqueToque`, `Instagrã`,…). Selecionando um modelo:

1. Carrega suas entradas de parâmetros (URL, minutos, intervalos de horas, etc.) em um formato pequeno.
2. **Aplicar predefinição** visualiza a fonte gerada.
3. Após confirmar **Substituir a regra personalizada atual por esta predefinição?**, a fonte é gravada no editor.
4. Em seguida, clique em **Executar** para registrar os manipuladores da regra na sandbox fora da tela.

Os modelos são definidos em `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`,…). Cada arquivo chama `CB_REGISTER_TEMPLATES([...])` no momento do carregamento e o pop-up consome a lista mesclada. Adicionar um novo modelo significa escrever uma entrada no arquivo apropriado – nenhum outro encanamento.

---

## 13. Comportamento de várias páginas- Todas as abas abertas no mesmo grupo compartilham o mesmo cronômetro.
- Quando você alterna para uma guia no mesmo grupo, sua sobreposição é atualizada imediatamente para mostrar o tempo compartilhado atual.
- Os temporizadores de regras personalizadas marcam apenas na guia **ativo visível** - controlado por `pageHeartbeatEvent`. As guias de fundo e as janelas minimizadas não as avançam. Isso corresponde à contagem regressiva padrão do grupo de blocos.
- Quando uma nova regra é adicionada, cada página aberta detecta a alteração e é reavaliada em uma fração de segundo; **mas** manipuladores recém-registrados não "abrem" retroativamente as guias já abertas. O pop-up mostra um lembrete de recarga após cada execução por esse motivo.
- Quando uma regra expira, os cartões de feed e botões de navegação ocultos são restaurados na próxima atualização.

---

## 14. Configurações

Abra a caixa de diálogo **Configurações** através do ícone de engrenagem na barra superior.

- **Intervalo de pulsação** — com que frequência o script de conteúdo informa o tempo da guia e aciona `pageHeartbeatEvent`. Padrão 250 ms. Valores mais baixos respondem melhor, mas usam mais CPU.
- **Intervalo de tick** — com que frequência o `tickEvent` global é acionado. Padrão 1000 ms.
- **Modo de depuração** — *desligado* por padrão. Quando *ativado*, o mecanismo emite entradas em nível de rastreio para o painel Log (`[trace] dispatchEvent`, `[trace] N handler(s)`) e linhas `[CustomBlocker:trace]` para o console do navegador. Deixe-o desligado no uso diário; ligue-o enquanto diagnostica uma regra com comportamento incorreto. `pageHeartbeatEvent` é excluído do log de rastreamento mesmo quando o modo de depuração está ativado, porque ele é acionado quatro vezes por segundo e abafaria o resto.

---

## 15. Internacionalização

Toda a IU é traduzida. Use o seletor **Idioma** no canto superior direito.

Os idiomas suportados incluem inglês, chinês (simplificado), espanhol, japonês, coreano, além de cobertura parcial para hindi, árabe, bengali, português, russo, punjabi, alemão, francês, turco, vietnamita, italiano, tailandês, holandês, polonês, indonésio, urdu e persa. Idiomas com cobertura parcial recorrem ao inglês para strings ausentes.

O próprio manual de instruções carrega o arquivo markdown correspondente ao idioma selecionado, com o inglês como alternativa.

---

## 16. Mensagens de status

As mensagens de status aparecem como um brinde centralizado que desaparece após cerca de dois segundos:

- "Alterações salvas."
- "Criado \"Nome do grupo\"."
- "Regra personalizada carregada — N manipuladores ativos. Para aplicar esta regra em guias que você já abriu, recarregue-as."
- Erros de validação como "Os minutos permitidos devem ser um número maior que 0".
- "Os minutos de soneca devem ser um número maior que 0."
- "Grupos congelados não podem ser alterados."

Para campos de entrada com requisitos de formato, a mensagem também aparece ao lado do botão relevante (para suspender).

---

## 17. Privacidade e armazenamento

- Tudo é armazenado localmente em `chrome.storage.local`. Nenhum dado é enviado para lugar nenhum.
- Os itens armazenados incluem: seus grupos, cronômetros de uso, horários da última redefinição, registros de suspensão, cronômetros personalizados e valores persistentes personalizados.
- A extensão não lê o conteúdo da página além do necessário para detectar o tipo de página (caminho/nome do host/marcadores DOM conhecidos para sites de vídeo) e para avaliar predicados escritos pelo usuário. Ele não lê suas mensagens, postagens, comentários ou conteúdo privado.

---

## 18. Permissões

- `storage` — para os dados acima.
- `declarativeNetRequest` — para bloqueio nativo de grupos `Default`.
- `alarms` — para agendar transições de regras com eficiência.
- `tabs`, `webNavigation` — para detectar a criação de guias, alterações de URL e pulsações de página para que os eventos possam ser despachados.
- `offscreen` — para hospedar o sandbox de regras personalizadas de longa duração.
- `host_permissions: <all_urls>` — para que o script de conteúdo possa mostrar a sobreposição do temporizador e detectar o contexto da plataforma em qualquer página.

---

## 19. Solução de problemas- **Um grupo que adicionei não faz nada.** Certifique-se de que o grupo esteja ativado, que a programação permita isso agora, que nenhuma suspensão esteja ativa e (para grupos de plataforma) que a página realmente corresponda ao tipo de conteúdo escolhido e ao filtro de autor.
- **Um cronômetro está travado ou errado em uma guia.** Afaste-se e volte ou foque a guia - isso aciona uma atualização forçada do cronômetro compartilhado.
- **Os cartões de feed reaparecem depois que eu acho que eles deveriam ser ocultados.** A ocultação de feed só é executada enquanto a regra está bloqueando ativamente. Se você tiver uma regra `after-minutes`, a ocultação de feed entrará em ação quando seu tempo chegar a zero.
- **Um botão de navegação do Iutube que eu esperava estar oculto ainda está lá.** A ocultação de navegação exige que a regra seja definida como "não filtrar por autor" e que o tipo de conteúdo seja Shorts ou postagens do Iutube. Com filtros de autor, a ocultação ocorre apenas por cartão.
- **A regra personalizada não fez nada ou foi lançada silenciosamente.** Abra Configurações → habilite **Modo de depuração**, clique em **Executar** novamente e observe o painel Log. As linhas prefixadas com `[trace]` mostram cada despacho e manipulador. Use `helpers.getLogHelper().log(...)` para adicionar seus próprios pontos de rastreamento. Se uma regra com comportamento incorreto continuou sendo colocada em quarentena automática, corrija a origem e clique em Executar – Executar limpa o motivo da interrupção.
- **Minha nova regra personalizada não afeta as guias já abertas.** Recarregue-as. Regras personalizadas são anexadas a eventos de página *futuros*; o pop-up mostra um lembrete para recarregar após cada corrida.
- **Meu cronômetro de contagem regressiva não está avançando.** Os cronômetros de regras personalizadas marcam apenas na guia **ativo visível** via `pageHeartbeatEvent`. Guias de fundo, janelas minimizadas e telas bloqueadas os pausam por design – mesmo comportamento da contagem regressiva padrão do grupo de blocos.
- **Não consigo excluir um grupo.** Provavelmente está congelado. Grupos estritamente congelados não podem ser excluídos até que seu bloqueio expire; grupos congelados não estritos podem ser excluídos por meio do ritual de descongelamento.
- **O pop-up mostra "Running…" para sempre.** Uma regra personalizada provavelmente entrou em um loop apertado. O mecanismo o desliga após um tempo limite difícil e coloca a regra em quarentena. Abra o painel Log pelo motivo do cancelamento; corrija a regra e clique em Executar.

---

## 20. Glossário

- **Grupo de blocos** — um conjunto de regras com seu próprio tipo, comportamento, programação e congelamento/soneca.
- **Bloqueio instantâneo** — a regra é bloqueada imediatamente sempre que estiver ativa.
- **Bloqueio após minutos** — a regra começa a bloquear somente depois que o orçamento de tempo do período se esgota.
- **Intervalo de redefinição** — com que frequência o orçamento após minutos é redefinido.
- **Programação** — dias + janelas de tempo durante as quais um grupo está ativo.
- **Congelar/Congelar estrito** — estados anti-adulteração.
- **Soneca** — desativação temporária com um ritual de confirmação configurável.
- **Filtro de autor** — para grupos de plataformas, restringe a regra a determinados criadores de conteúdo.
- **Tipo de conteúdo** — para grupos de plataformas, restringe a regra a determinadas formas de conteúdo (curto, longo, postagem).
- **Helpers** — utilitários passados ​​para o manipulador de uma regra personalizada.
- **Plataforma** — uma de `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Cada um tem seu próprio tipo de grupo e lógica de ocultação de feed.
- **Heartbeat** — o `pageHeartbeatEvent` de aproximadamente 250 ms despachado da guia visível ativa.
- **Tick** — o 1 s `tickEvent` compartilhado globalmente (independente de visibilidade).
- **Modo de depuração** — uma configuração que mostra o registro de rastreamento interno no painel Log e no console do navegador.
- **Quarentena** — desativação automática de uma regra personalizada que excedeu um limite de segurança de tempo de execução (prazo, spam de registro,…). Eliminado na próxima execução.

---

## 21. Limitações- A ocultação de feed depende do DOM atual de cada plataforma. Se a plataforma alterar seu layout, os seletores de ocultação poderão precisar ser atualizados.
- A detecção de contexto de plataforma para sites que não são do Iutube é baseada principalmente em URLs, por isso é mais confiável em URLs de conteúdo canônico.
- Temporizadores de regras personalizadas marcam na resolução de pulsação (~250 ms). Não confie neles para cronometragem abaixo de um segundo.
- Os predicados passados ​​para `hideShorts`/`hideVideos`/`hidePosts` são avaliados de forma síncrona por cartão de alimentação. Lógica pesada em um predicado pode retardar a rolagem do feed; mantenha-os baratos.
- Duas guias editando o mesmo cronômetro por grupo usam simultaneamente uma estratégia de "última gravação ganha". Para uso típico, isso é bom; se você depende de uma contabilidade exata, espere pequenos desvios ocasionais.
- O navegador pode suspender o trabalhador do serviço em segundo plano quando estiver ocioso. A extensão retoma assim que uma página ou alarme precisar; os orçamentos de uso do site/temporizado continuam contando por meio da repetição de pulsação.

## Nota da v1.2

O editor de regras personalizadas agora colore a sintaxe linguagem de scripts, e o navegador de modelos usa as mesmas cores nas prévias de código. A ação em massa dos grupos se chama **Limpar**.

