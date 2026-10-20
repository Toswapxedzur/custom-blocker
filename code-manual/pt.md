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

- `on(type, handler)` → boolean. Registra `handler(ev)`; vários handlers executam na ordem de inscrição. False significa argumentos inválidos ou limite de handlers atingido. `ev = { type: string, now: number, data }`; `now` é Unix em milissegundos.
- `v.state`: objeto JSON mutável, salvo depois do event dispatch. Inicialize fields ausentes em vez de sobrescrever o state atual. Atribuir non-object ou array redefine para `{}`; atualizações não serializáveis/grandes demais não são salvas.
- `v.log(...values)`: escreve no Log deste grupo. Erros de handlers e erros relatados de ações de página também aparecem aqui; o relato não repete as ações. Logs/Clear são independentes por grupo. Erros de carregamento aparecem no status Run.
- `v.emit(type, data)`: coloca uma cópia JSON de `data` na fila dos handlers deste grupo após o event atual, com um novo `now`; não é uma chamada síncrona.
- `v.panel(id, spec, tabId?)`: substitui o panel nomeado do grupo; omita `tabId` para todas as páginas acessíveis ou use um tab ID inteiro. `spec` null remove o panel. Consulte Panels.
- `v.file(op, path, payload?)` → string request ID. Consulte Files.

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
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` é aproximado; use timestamps, não a contagem de ticks. `active` significa selecionada em uma janela do navegador, não prova que o usuário está olhando para ela. URLs podem estar vazias/restritas.
- `visible` vem de páginas acessíveis e não ocultas; `elapsedMs` é o tempo desde o último heartbeat, zero quando a página está coberta. Não é uso acumulado nem tempo de reprodução.
- `items` informa itens de feed compatíveis novos/alterados e os reenvia após Run/reativação. `ref` identifica um cartão nessa página, não um content ID duradouro; `ref === "page"` identifica a própria página. Títulos/URLs/autores podem estar vazios. `authors` contém source identifiers específicos da plataforma.
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
