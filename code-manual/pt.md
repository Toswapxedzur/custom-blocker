# Manual de código da extensão de navegador Vault

[Manual do usuário](../manual/pt.md)

## Contrato da regra

Source: uma expressão de função `(on, v) => { ... }`. Apenas JavaScript síncrono e a API abaixo são compatíveis; não há callbacks de agendamento JavaScript, acesso à rede, APIs de extensão nem acesso direto ao DOM. Regras baseadas em tempo usam os temporizadores/rastreadores gerenciados abaixo, ou `ev.now` e eventos.

- A edição salva um rascunho; **Run** ativa a regra e habilita o grupo. Grupos congelados não podem executar Run. Source vazio descarrega a regra.
- Um Run bem-sucedido substitui handlers e panels, preservando `v.state`. Se a compilação/inscrição falhar, a regra anterior é mantida; um timeout pode interrompê-la. Ao recarregar o engine, a última source ativada é registrada novamente; closure variables são redefinidas.
- A inscrição pode inicializar state, registrar handlers, exibir panels e gravar logs. Ações de página/arquivo e emits pertencem aos handlers; a fila criada durante a inscrição é descartada.
- Disable suspende handlers e remove panels, sheets, covers e decisões de itens gerenciados. Enable restaura panels/sheets preservados e solicita os itens novamente. Run não limpa sheets, covers nem decisões de itens existentes. Delete remove a regra e seus state/effects. Navegação, alterações do DOM e gravações de arquivos não são desfeitas.
- Events não se limitam aos alvos comuns do grupo; filtre URLs/items na regra. Actions entram em uma fila e são aplicadas após o dispatch. Exceptions interrompem o handler sem reverter seu state/actions; handlers seguintes podem continuar. Só há confirmação de action nos events file/query.

## API compartilhada

- `on(type, handler)` → boolean. Registra `handler(ev)`; vários handlers executam na ordem de inscrição. False significa argumentos inválidos ou limite de handlers atingido. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` é Unix em milissegundos. Eventos reais de controles exibidos têm `origin: "user"`; eventos de `v.emit` têm `origin: "rule"`.
- `v.state`: objeto JSON mutável, salvo depois do event dispatch. Inicialize fields ausentes em vez de sobrescrever o state atual. Atribuir non-object ou array redefine para `{}`; atualizações não serializáveis/grandes demais não são salvas.
- `v.log(...values)`: escreve no Log deste grupo. Erros de handlers e erros relatados de ações de página também aparecem aqui; o relato não repete as ações. Logs/Clear são independentes por grupo. Erros de carregamento aparecem no status Run.
- `v.emit(type, data)`: coloca uma cópia JSON de `data` na fila dos handlers deste grupo após o event atual, com um novo `now`; não é uma chamada síncrona.
- `v.panel(id, spec, tabId?)`: substitui o panel nomeado do grupo; omita `tabId` para todas as páginas acessíveis ou use um tab ID inteiro. `spec` null remove o panel. Consulte Panels.
- `v.file(op, path, payload?)` → string request ID. Consulte Files.
- `v.store(request)` retorna um ID de solicitação; consulte os registros do grupo.

Outras chamadas compartilhadas retornam `undefined`, exceto as funções de criação de objetos de tempo gerenciados com nome descritas abaixo. IDs/state pertencem a um grupo, não ao nome exibido.

## Temporizadores gerenciados e uso em janela móvel

`v.timer(id, {direction:"down", durationMs:300000})` cria ou retorna uma contagem regressiva com nome, inicialmente pausada. Use `{direction:"up"}` para um temporizador de contagem crescente. O objeto oferece `start()`, `pause()`, `resume()`, `reset()` e `snapshot()`. Iniciar/retomar são idempotentes; redefinir deixa o temporizador pausado com zero tempo decorrido. Os campos do snapshot incluem `ready`, `error`, `elapsedMs`, `remainingMs` (null para contagem crescente), `running` e `completed`.

Os temporizadores em execução avançam de acordo com o tempo real decorrido enquanto o app/navegador está fechado ou a regra está desabilitada. Uma contagem regressiva concluída entrega `timerEnded` com `{id, direction, durationMs, generation, incarnation}` uma vez por encarnação e geração do temporizador para cada membro quando sua regra volta a executar; Run não repete o evento. A entrega depende dos eventos do host; não é um alarme em tempo real. Coloque `{type:"timer", timerId:"focus", label:"Focus"}` em um painel para exibi-lo pelo controle de texto existente.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` cria ou retorna um rastreador com nome de uso ativo. `assign({websites:["youtube.com","reddit.com"], apps:[]})` substitui as atribuições de alvos deste membro. Regras nativas podem atribuir identificadores de apps da plataforma em vez disso. Os domínios incluem subdomínios. Um rastreador reúne seus alvos; outros identificadores têm cotas independentes. `snapshot()` retorna `ready`, `error`, `usedMs`, `remainingMs`, `available` e `nextReturnAtMs` (o próximo milissegundo em que algum uso registrado expira). `available(target?)` também verifica a atribuição quando um alvo é fornecido. `reset()` limpa o histórico deste objeto.

Todo uso elegível observado conta, inclusive o que ultrapassa a cota; o rastreador em si não bloqueia páginas/apps. Intervalos sobrepostos de páginas visíveis contam uma vez, e apps nativos contam o uso observado em primeiro plano. Regras desabilitadas não adicionam uso; o histórico continua expirando nos limites exatos dos intervalos. A disponibilidade só retorna quando o histórico restante fica abaixo do limite. As amostras periódicas são limitadas a cinco segundos; lacunas por encerramento ou desabilitação não geram atividade. Eventos emitidos pelo usuário não adicionam uso.

Os mesmos identificadores de objeto em grupos personalizados vinculados compartilham uma única autoridade local no hub nativo. A vinculação combina o histórico e as atribuições dos rastreadores e mantém o estado do temporizador que iniciou a vinculação; configurações incompatíveis impedem a vinculação. Cada membro recebe seu próprio evento de conclusão. A desconexão deixa os rastreadores compartilhados indisponíveis e rejeita os comandos dos temporizadores até que uma autoridade atualizada volte a estar disponível. Ao desvincular, cada membro mantém o uso compartilhado final e o estado do temporizador, restaura seus próprios alvos e descarta os comandos do vínculo antigo. O hub mantém o snapshot final até que o membro que retorna o salve e confirme o recebimento; as transferências pendentes terminam antes que um novo vínculo fique disponível.

Os objetos com nome sobrevivem a Run e à reinicialização no campo reservado `v.state.$vaultTime`; não edite esse campo diretamente. Remova-os explicitamente com `v.removeTime(id)`. Os identificadores contêm de 1 a 80 letras ASCII, dígitos, `_` ou `-`; nomes de propriedades reservados são rejeitados. Até 32 objetos compartilham o limite de estado da regra de 64 KiB em UTF-8. As durações são milissegundos inteiros de até 365 dias. O histórico móvel é limitado a 1024 blocos de um minuto e 2048 intervalos mesclados. Erros de capacidade do histórico deixam o rastreador indisponível até uma redefinição explícita; configurações inválidas e salvamentos grandes demais relatam erros sem apagar os dados salvos.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Browser events

A notação de payload abaixo descreve os tipos; não é código executável. `?` indica fields opcionais.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` é aproximado; use timestamps, não a contagem de ticks. `active` significa selecionada em uma janela do navegador, não prova que o usuário está olhando para ela. URLs podem estar vazias/restritas.
- `visible` vem de páginas acessíveis e não ocultas; `elapsedMs` é o tempo desde o último heartbeat, zero quando a página está coberta. Não é uso acumulado nem tempo de reprodução.
- `items` (`platform: "web"` fora dos sites reconhecidos) informa itens de feed compatíveis novos/alterados e os reenvia após Run/reativação. `ref` identifica um cartão nessa página, não um content ID duradouro; `ref === "page"` identifica a própria página. Títulos/URLs/autores podem estar vazios. `authors` contém source identifiers específicos da plataforma.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. A disponibilidade depende do markup compatível da página.
- Tags exigem Classifier desktop conectado e build/plataforma com marcação habilitada (Chromium e Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence é de 1–5. `tagsSettled === false` significa pendente/indisponível, não sem tags; `tags: []` quando settled significa sem tags.
- `snooze` significa que o botão Snooze do grupo foi pressionado. Ele não aplica uma pausa sozinho.
- Respostas query/file vão para o grupo solicitante. Associe `requestId`, verifique `error`/`ok` e defina um deadline usando ticks: respostas podem se perder quando a página fecha, o engine recarrega ou o grupo é desativado. Request IDs podem se repetir após Run; requests pendentes não são tarefas duradouras.

## Browser actions

`tabId` inteiro deve vir de um event. Page actions exigem uma página acessível ao Vault; páginas internas do navegador não estão disponíveis. Em geral, entradas inválidas/alvos indisponíveis não produzem efeito.

- `v.item(tabId, ref, verdict)`: `"hide"` remove um cartão do feed, `"dim"` cobre sua mídia, `"allow"` o isenta dos grupos inferiores, `null` limpa o verdict deste grupo. Refs desconhecidos não fazem nada; use `v.cover` para `isPage`. Verdicts seguem a ordem das listas de grupos: hide superior vence; dim superior persiste apesar de allow inferior; allow impede verdicts inferiores. Um cartão reutilizado/removido precisa de uma nova decisão.
- `v.cover(tabId, on, message?)`: true cobre a página, false remove a cobertura personalizada; message começa vazio (máx. 500 caracteres). Cada página tem um custom-cover slot; a última chamada cover aplicada vence, independentemente da ordem dos grupos. Mudanças de endereço removem a cobertura; o bloqueio comum ainda pode cobrir a página.
- `v.go(tabId, target)`: URL HTTP(S) ou `"back"`, `"forward"`, `"reload"` (target máx. 4096 caracteres).
- `v.close(tabId)`: fecha o tab.
- `v.css(tabIdOrStar, id, css)`: tab ID inteiro ou `"*"`; substitui a folha de estilo do grupo com esse ID ou remove com null. Tab sheets terminam quando o endereço muda; sheets `"*"` também alcançam páginas futuras. ID máx. 80, CSS máx. 100000 caracteres.
- `v.dom(tabId, selector, op, arg?)`: CSS selector (máx. 1000); todos os matches, exceto `scrollTo`, que usa o primeiro. Ops: `hide` define inline `display:none!important`; `show` remove inline display; `click`; `setText` substitui o texto por `arg`; `addClass`/`removeClass` usam um class name; `scrollTo` rola até ficar visível. Arg máx. 2000. As alterações persistem até serem revertidas explicitamente/substituídas pela página.
- `v.query(tabId, selector)` → string request ID ou null para argumentos inválidos. O resultado é um event `query` posterior: até 50 matches, `tag` em minúsculas, normalized text ≤1000 caracteres, attributes ≤2000, value ≤1000. Sem matches retorna `[]` com sucesso; CSS inválido fornece `error: "invalid-selector"`. Uma página sem receiver do Vault talvez não responda.

## Panels

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

Padrões: posição no canto inferior direito; layout vertical; alinhamento à esquerda; role region; largura ajustada ao conteúdo. Presets de largura: 220/280/360px; largura numérica limitada a 180–520px. Largura do control entre 32–520px e altura entre 20–360px. Tamanhos numéricos aceitam pixel strings. Variantes verticais alteram o espaçamento; inline/row não quebram linha; wrap/toolbar quebram; twoColumn/grid/split/form usam grades; stack minimiza espaçamento. Role fornece semântica de acessibilidade, não bloqueio modal.

IDs são normalizados para ASCII letters/digits/`_`/`-` (máx. 80); escolha IDs únicos e estáveis. Control ID omitido vira `control-N`; type omitido/desconhecido vira text. text/lists omitidos ficam vazios; disabled é false. Chamar `v.panel` substitui toda a spec. `value` omitido reutiliza o event value mais recente do control e aplica normalização do type; `value` explícito o substitui. Autofocus é false por padrão. Fields desconhecidos são descartados; cores/fonts/CSS fornecidos pela regra não são compatíveis.

Campos e valores dos controles:

- `text`: string `text`; padrão igual ao label. `html`: string `html`; remove scripts, event attributes, URLs perigosas e styling.
- `button`: `label`, `action: "submit" | "cancel" | "close"` opcional; value é string (padrão vazio). Actions enviam events; não submetem/fecham nada automaticamente.
- `checkbox`, `toggle`: boolean `value` (padrão false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (padrão vazio). Values de opções vazios são removidos; labels usam value por padrão.
- `textInput`, `textarea`: string value (padrão vazio), `placeholder`; `rows` de textarea entre 1–12 (padrão 3).
- `numberInput`, `range`: numeric value (padrão 0), `min`, `max`, `step` positivo. Values são limitados aos bounds; limites de normalização não especificados são −1000000…1000000. Range padrão 0…100; defina bounds explícitos.
- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` ou `HH:MM:SS`; formatos iniciais inválidos ficam vazios. `color`: `#RRGGBB` (padrão `#000000`).
- `pin`: string de dígitos; `length` 3–12 (padrão 6), `masked` true por padrão, `autoSubmit` false. `section`: `text`, `controls`, layout/align/role opcionais (role padrão group); child sections no depth 3 não têm children (root controls depth 0).

Panel events: controles de entrada enviam `input`/`change` (text input muda em blur/Enter; textarea em blur/Ctrl-or-Cmd+Enter). Controles comuns também enviam `focus`, `blur`, `key`; os metadados key não são encaminhados à regra. Buttons enviam `click` **e** o action configurado como events separados—trate apenas um. PIN envia `change` e `submit` quando autoSubmit é preenchido. Mount/unmount usa `controlId: ""`, `value: true`. `values` contém os inputs atuais por ID; exclui buttons/text/HTML. Events não têm tab ID de origem; use panel IDs separados para interações por tab.

Limites de texto: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; outras value strings 512; option value/label 256. O excesso é truncado.

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Requer **Pasta de regras personalizadas** em Settings e sua permissão. Safari usa o seletor native de pastas e mantém um security-scoped grant; somente a pasta escolhida fica disponível.

- `path` é relativo; `/` separa directories. Segmentos permitem ASCII letters/digits, espaços e `_.,@()-`; sem ponto inicial, `.`/`..`, absolute path ou URL. Extensões: `.txt`, `.csv`, `.json` (sem diferenciar maiúsculas/minúsculas). List path é um directory; `""` lista a root escolhida. Paths que escapam da pasta escolhida, inclusive por symlinks, são rejeitados.
- Read retorna texto UTF-8. Write substitui/cria; append cria/anexa sem newline automático. Diretórios pais são criados ao gravar. String payload é gravado literalmente; outros payloads JSON são serializados; null/omitido significa texto vazio. Interpretar JSON/CSV é responsabilidade da regra. Tamanho máximo de arquivo: 1048576 UTF-8 bytes.
- List retorna subdirectories e arquivos compatíveis imediatamente visíveis. Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension inclui ponto nos arquivos. Exists retorna boolean para um file path compatível.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

result fields não usados são null; sucesso tem error vazio. Falhas incluem invalid-path, unsupported-file-type, permission/folder unavailable, missing file e file-too-large. Trate error como string, não enum exaustivo fixo. Requests não garantem transação/ordem; serialize operações read-modify-write por path.

## Limites

Por evento e grupo: 256 ações em fila, 200 chamadas de log, 64 emissões; o excesso é descartado. Por regra: 1000 handlers, 24 painéis; cada lista de controles tem 32 entradas e cada seleção 64 opções; o excesso é ignorado/truncado. As cadeias de emissões param após 16 gerações. Limite do estado serializado: 65536 bytes UTF-8. Mantenha o registro da regra e os handlers combinados de cada evento abaixo de 1 segundo; excessos repetidos ou um timeout rígido param o grupo até Run. O Log mantém 200 entradas, aceita 50 chamadas por segundo por grupo e trunca mensagens longas em torno de 4096 caracteres. Temporizadores/respostas funcionam conforme o melhor esforço, sem garantias de tempo real.

## Regra completa

Pausa de cinco minutos iniciada por Snooze ou pelo botão do seu panel:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```


## Chamadas de IA em uma regra em execução

Cada custom group escolhe conexão/modelo e reasoning effort em **AI calls**. Regras Mac e navegador usam a mesma API; pedidos do navegador exigem Mac Vault conectado e as credenciais do provedor ficam lá. Grupos vinculados compartilham seleção e limite diário opcional. Em branco significa sem limite do grupo; limites da conta continuam valendo. O limite usa o dia UTC, persiste após reinício e conta tentativas enviadas, inclusive falhas. Link combina uso existente; unlink mantém o uso anterior.

O prompt e o contexto guardados são compartilhados por grupos vinculados e ficam disponíveis nos handlers como `v.context.ai.prompt` e `v.context.ai.context`. O Vault não os envia automaticamente; a regra escolhe o que incluir em cada chamada `v.ai`.

`v.ai({ prompt, input? })` retorna um request ID imediatamente. Chame dentro de um handler, não ao registrar a regra. `input` pode ser qualquer JSON; prompt/input limitados a20KB cada. Respostas chegam como eventos `ai` events: `. Success text is at most48KB; citations are ` `ask` `note`: {requestId, ok, text, citations, error}. Texto de sucesso até48KB; citations {url,title}. Preserve links de fonte visíveis e clicáveis ao exibir respostas da pesquisa Web. Search está sempre disponível ao modelo. Não há prazo fixo do app; concorrência limitada; sem fallback de provedor ou retry automático. Respostas são dados, nunca executadas como JavaScript. A regra decide quais ações existentes tomar.

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

Chamadas pendentes não são reproduzidas após reiniciar. Run, desabilitar/habilitar e exclusão descartam respostas antigas; navegador desconectado informa `ai-unavailable`. Outros erros: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. Chamadas falhas não substituem resultado anterior que a regra escolheu manter. O estado da regra continua limitado a64KB.

Descubra opções sem credenciais com `rule_ai_models` no Mac ou `settings-rule-ai-models` no navegador; configure `ruleAI` pelo caminho set-group existente. Campos: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) e `dailyRequestLimit` (null ou1–100000). Use uma opção retornada; não coloque chave ou URL do provedor no código-fonte.
Os campos guardados opcionais são `prompt` e `context`, cadeias de até16KB cada.

## Registros do grupo

`v.store(request)` inicia uma operação assíncrona de registro JSON dentro de um handler. Os registros são privados do grupo, persistem após Run e reinicialização e são removidos com o grupo. Grupos vinculados têm stores separados. A regra escolhe chaves, valores, versões, invalidação de cache e prioridade do feedback. Regras Mac e navegador usam a mesma API, mas cada app/navegador possui store próprio.

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` ou `null` |
| `{op:"put", key, value, version?, ifRevision?}` | `record` salvo |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | `entries` ordenadas e `next` |
| `{op:"clear", prefix?}` | contagem `deleted` |

Cada registro é `{value, revision, version, updatedAt}`. A revision opaca muda numa gravação real; `version` é metadado do chamador. `list` retorna cabeçalhos sem valores; use `get` para ler e `after: next` `put` `delete` para a página seguinte. Sem `ifRevision`, put/delete são incondicionais; `null` exige chave ausente e string de revisão exige correspondência exata. Conflito retorna `ok:false`, `error:"store-conflict"` e o `record` atual, impedindo resposta automática atrasada de substituir feedback do usuário. `v.context.revision` é um marcador opaco de configuração que a regra pode incluir em sua versão. O framework não impõe política de cache.

Limites: chave 1–2048 caracteres, versão ≤128, valor JSON ≤64KiB, profundidade ≤32, 10000 chaves por grupo, documento inteiro16MiB. `list` retorna até100 cabeçalhos e96KiB por página. No máximo32 pedidos por grupo e128 inícios/segundo no total. Sobrecarga informa `store-busy` uma vez por grupo por segundo e descarta os demais. Erros de armazenamento retornam `ok:false`; documento futuro/malformado é preservado e sinaliza `store-unavailable`. Não há retry nem eviction automáticos. Use ticks para prazos.

## Anexos de conteúdo guardados

`v.attach(tabId, item, id, spec)` guarda uma pill ou vista passiva HTML/CSS para um item de conteúdo observado. Passe o `item` completo de um evento `items` ou `attachment`; um `ref` isolado não é um identificador de anexo. `contentId` identifica o conteúdo guardado e `instanceId` a ocorrência atual. Mantenha o identificador original enquanto aguarda AI. O Vault rejeita anexos tardios para destinos removidos, reciclados ou navegados. `v.item(tabId, ref, verdict)` continua independente.

Para uma pill, `spec` é `{type:"pill", text, tone?, tooltip?}`; os tons são `blue`, `cyan`, `gold`, `pink` ou `red`. Texto simples até 240 caracteres e tooltip até 1000. Para uma vista, spec é `{type:"html", html, css?, label?}`. Limites: HTML 32000 caracteres, CSS 16000, label 200. A vista é reconstruída de HTML/SVG passivo permitido, em shadow root fechado com CSS delimitado. Scripts, atributos de evento, recursos remotos, incorporações e CSS inseguro são removidos. A vista fica dentro do cartão e rola a 480px de altura. IDs usam 1–80 letras/números ASCII, _ ou -. spec null remove a pill do grupo. Chame dentro de um handler; falhas de persistência/entrega aparecem no Log e não são repetidas automaticamente.

Cada item expõe os anexos deste grupo como snapshot somente de leitura em `item.attachments`; anexos de outros grupos não aparecem ali. Se os dados não estiverem disponíveis, `attachments` é null e `attachmentError` é definido; isso não significa cache vazio. Outros handlers continuam. Use o exemplo para não pedir AI outra vez para conteúdo com resultado guardado.

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

Ativações por ponteiro, Enter ou Space geram um evento `attachment` para o grupo. Pills enviam `click`. Controles da vista usam `data-control` ou `id` como `controlId` e enviam `click`, `input` ou `change`, com o `value` atual e `values` limitados dos controles nomeados. Eventos reais da UI têm `ev.origin === "user"`; os da regra têm `origin === "rule"`. Incluem `tabId`, `attachmentId` e o `item` atual. A vista não executa código de regra. Pills e vistas impedem que a interação navegue o cartão subjacente. Os dados guardados não contêm callbacks nem código executável. Uma revisão antiga de pill não pode acionar um anexo atual. Eventos emitidos pela regra são lógica comum; o navegador valida separadamente mensagens reais de clique.

Os anexos são guardados neste perfil do navegador por grupo/conteúdo/ID e retornam em ocorrências posteriores, navegação, reinício do navegador e Run. Disable oculta e mantém os dados; enable restaura. Excluir o grupo remove seus anexos. Grupos vinculados continuam separados; não há sincronização automática entre navegadores/dispositivos. Conteúdo reconhecido de YouTube, Reddit, X e Bilibili usa IDs da plataforma. Outro conteúdo usa URL normalizada conservadoramente, então a disponibilidade depende da marcação de página compatível.

Limites: 8 anexos por grupo/conteúdo, 32 por item entre todos os grupos, 10000 entradas de conteúdo por grupo e documento serializado de anexos de 8MB. Ao atingir o limite, a nova alteração é recusada com `attachment-item-limit` ou `attachment-storage-limit` no Log; os dados existentes são preservados. Um dispatch agrupa gravações; spec idênticos não reescrevem o armazenamento. Anexos são UI de conteúdo do navegador, inclusive no motor nativo de regras do Safari. Regras da app Mac não têm handles de conteúdo do navegador nem superfície de anexos na app.

`code-manual/generic-example.js` é um exemplo executável de política. Usa registros, chamadas AI, feedback do usuário, compare-and-swap, controles HTML, vereditos de item e relatório de uso da regra; esses comportamentos estão no exemplo, não são recursos especiais do armazenamento.
