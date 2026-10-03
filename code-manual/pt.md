# Manual de código da extensão de navegador Vault

[Manual do usuário](../manual/pt.md)

## Contrato da regra

Source: uma expressão de função `(on, v) => { ... }`. Apenas JavaScript síncrono e a API abaixo são compatíveis; não há timers, network, extension APIs nem acesso direto ao DOM. Regras baseadas em tempo usam `ev.now` e events.

- A edição salva um rascunho; **Run** ativa a regra e habilita o grupo. Grupos congelados não podem executar Run. Source vazio descarrega a regra.
- Um Run bem-sucedido substitui handlers e panels, preservando `v.state`. Se a compilação/inscrição falhar, a regra anterior é mantida; um timeout pode interrompê-la. Ao recarregar o engine, a última source ativada é registrada novamente; closure variables são redefinidas.
- A inscrição pode inicializar state, registrar handlers, exibir panels e gravar logs. Ações de página/arquivo e emits pertencem aos handlers; a fila criada durante a inscrição é descartada.
- Disable suspende handlers e remove panels, sheets, covers e decisões de itens gerenciados. Enable restaura panels/sheets preservados e solicita os itens novamente. Run não limpa sheets, covers nem decisões de itens existentes. Delete remove a regra e seus state/effects. Navegação, alterações do DOM e gravações de arquivos não são desfeitas.
- Events não se limitam aos alvos comuns do grupo; filtre URLs/items na regra. Actions entram em uma fila e são aplicadas após o dispatch. Exceptions interrompem o handler sem reverter seu state/actions; handlers seguintes podem continuar. Só há confirmação de action nos events file/query.

## API compartilhada

- `on(type, handler)` → boolean. Registra `handler(ev)`; vários handlers executam na ordem de inscrição. False significa argumentos inválidos ou limite de handlers atingido. `ev = { type: string, now: number, data }`; `now` é Unix em milissegundos.
- `v.state`: objeto JSON mutável, salvo depois do event dispatch. Inicialize fields ausentes em vez de sobrescrever o state atual. Atribuir non-object ou array redefine para `{}`; atualizações não serializáveis/grandes demais não são salvas.
- `v.log(...values)`: única forma de produzir o Log deste grupo. Logs/Clear são independentes por grupo. Erros de carregamento aparecem no status Run; diagnósticos de handlers não preenchem Log.
- `v.emit(type, data)`: coloca uma cópia JSON de `data` na fila dos handlers deste grupo após o event atual, com um novo `now`; não é uma chamada síncrona.
- `v.panel(id, spec, tabId?)`: substitui o panel nomeado do grupo; omita `tabId` para todas as páginas acessíveis ou use um tab ID inteiro. `spec` null remove o panel. Consulte Panels.
- `v.file(op, path, payload?)` → string request ID. Consulte Files.

Outras chamadas compartilhadas retornam `undefined`. IDs/state pertencem a um grupo, não ao nome exibido.

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
- Tags exigem Classifier desktop conectado e build/plataforma com marcação habilitada (Chromium e Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence é de 1–5. `tagsSettled === false` significa pendente/indisponível, não sem tags; `tags: []` quando settled significa sem tags. Builds Firefox não têm essa integração de marcação.
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

Por event por group: 256 queued actions, 200 log calls, 64 emits; excesso é descartado. Por rule: 1000 handlers, 24 panels; cada control list tem 32 entries e cada choice 64 options; excesso é ignorado/truncado. Emit chains param após 16 gerações. Serialized state limit: 65536 JavaScript string characters. Mantenha registration e handlers combinados de cada event abaixo de 1 segundo; excessos repetidos ou hard timeout param a regra até Run. Log mantém 200 entries, aceita 50/sec por grupo e trunca mensagens longas perto de 4096 caracteres. Timers/replies são best-effort, sem garantias real-time.

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
