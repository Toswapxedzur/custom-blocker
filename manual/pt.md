# Bloqueador de Web Personalizado — Manual de Instruções

Este é o manual de referência completo para a extensão. Ele começa com os fluxos de trabalho mais fáceis e comuns e gradualmente avança para tópicos avançados, como regras personalizadas de bloqueio de JavaScript e a API auxiliar.

Se você for novo, basta ler **Início rápido** e **Visão geral dos grupos de bloqueio**. Tudo abaixo dessas seções é opcional, dependendo do que você deseja fazer.

---

## 1. O que esta extensão faz

O Custom Web Blocker permite bloquear sites e distrações online de acordo com regras que você mesmo define. Você pode:

- Bloqueie sites imediatamente com o bloqueio de rede nativo do navegador (o mesmo tipo de bloqueio que produz `ERR_BLOCKED_BY_CLIENT`).
- Permita-se um certo número de minutos por dia em um site e bloqueie-o quando ultrapassar esse limite.
- Bloqueie tipos específicos de conteúdo no YouTube, TikTok, Facebook, Instagram, Twitch e Reddit (não no site inteiro).
- Oculte conteúdo bloqueado de feeds em plataformas suportadas, em vez de bloquear apenas páginas individuais.
- Programe quando uma regra estará ativa por dia da semana e por `HHMM-HHMM` janelas de horário.
- Congele uma regra para que você não possa alterá-la facilmente. O congelamento estrito o bloqueia por um determinado número de horas e requer um ritual de confirmação de 20 etapas para ser desfeito.
- Adie uma regra temporariamente, mas somente depois de escrever uma justificativa longa o suficiente.
- Escreva regras personalizadas de bloqueio de JavaScript com auxiliares para temporizadores, armazenamento persistente, detecção de plataforma, correspondência de domínio e registro em log.
- Use a extensão em mais de 20 idiomas.

A extensão é uma extensão do Chrome Manifest V3, com uma página de editor (o pop-up), um service worker em segundo plano e um script de conteúdo executado em cada página.

---

## 2. Tour pela IU

Quando você clica no ícone da extensão, o editor abre como uma página da web completa (não como um pequeno pop-up). A página possui estas áreas:

- **Barra superior**
  - Botão **Manual de Instruções** (este documento)
  - **Seletor de idioma**
- **Painel esquerdo — Grupos de blocos**
  - Lista dos seus grupos de blocos. Cada cartão mostra o nome do grupo, uma pequena linha de resumo e uma caixa de seleção para ativar/desativar.
  - O botão **Adicionar** cria um novo grupo. O menu suspenso próximo a ele escolhe o tipo.
  - **Excluir tudo** remove todos os grupos, com confirmações extras se algum grupo estiver congelado.
  - Você pode arrastar a alça `::` em um cartão para cima ou para baixo para reordenar os grupos.
  - Você pode arrastar o divisor vertical para redimensionar este painel.
- **Painel direito — Editor**
  - Edita o grupo atualmente selecionado: nome, comportamento de bloqueio, listas de bloqueio, filtros específicos de tipo, agendamento, congelamento, soneca.
  - Todas as alterações são salvas automaticamente uma fração de segundo depois que você para de digitar ou interagir.
- **Toast** (pop-up centralizado que desaparece)
  - Mostra mensagens de status como "Alterações salvas" ou erros de entrada.

Enquanto uma página está sendo bloqueada ou tem um cronômetro ativo, uma sobreposição aparece no canto superior esquerdo mostrando todas as restrições de tempo que a afetam atualmente, no formato `hh:mm:ss` (ou `mm:ss`). Múltiplas restrições são empilhadas em múltiplas linhas.

---

## 3. Início rápido

1. Clique no ícone da extensão. O editor abre como uma página inteira.
2. No painel **Bloquear grupos**, escolha um tipo de grupo no menu suspenso:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` ou `Custom`.
3. Clique em **Adicionar**. Um novo grupo aparece e o editor o abre.
4. Dê um nome a ele.
5. Preencha os campos específicos do tipo (para `Default`, isso significa a lista **Sites bloqueados**).
6. Certifique-se de que a caixa de seleção do grupo no painel esquerdo esteja ativada.
7. Visite um dos sites listados. O bloqueio deve entrar em vigor imediatamente.

Esse é todo o caminho feliz. O resto deste manual são apenas opções além disso.

---

## 4. Visão geral dos grupos de blocos

Tudo nesta extensão é organizado como **grupos de blocos**. Um grupo de blocos é um conjunto de regras:

- Ele tem um nome, um tipo e um estado ativado/desativado.
- Tem um comportamento de bloqueio (imediato ou após alguns minutos).
- Possui uma programação opcional (dias + janelas de tempo) e controles opcionais de congelamento/soneca.
- Dependendo do tipo, possui campos adicionais, como uma lista de sites, filtros de criadores do YouTube, nomes de subreddit ou uma função JavaScript.

Você pode ter qualquer número de grupos. Vários grupos podem se inscrever na mesma página; nesse caso, a regra **mais rigorosa** vence:

- “Bloquear imediatamente” é melhor do que “bloquear depois de algum tempo”.
- Um grupo com menos tempo restante vence um grupo com mais tempo restante.

Portanto, adicionar mais grupos só pode bloquear a página mais cedo, nunca mais tarde.

Você pode arrastar grupos pelo identificador `::` para reordená-los. A ordem não altera qual regra é mais rigorosa, mas controla como a lista é lida de cima para baixo.

---

## 5. Tipos de grupo

### 5.1 `Default` — bloquear sites comuns

Para bloquear domínios específicos (o caso de uso típico).

- **Sites bloqueados**: um site por linha. Ambos `facebook.com` e `https://www.facebook.com/somepage` funcionam; a extensão extrai e normaliza o nome do host.
- Uma regra de site se aplica a esse nome de host e a todos os seus subdomínios.
- Este tipo de grupo usa o bloqueio de rede nativo do Chrome, semelhante a `ERR_BLOCKED_BY_CLIENT`. Isso significa que a navegação para um URL bloqueado é interrompida antes mesmo de a página carregar.

### 5.2 `YouTube` — bloquear YouTube e sites de vídeo semelhantes

Adiciona uma seção **Filtros** ao editor:

- **Tipo de conteúdo**:
  - `Apply to all YouTube pages` — cada página do YouTube conta.
  - `Apply to Shorts` — apenas as páginas de Shorts contam.
  - `Apply to long videos` — apenas `/watch`, `/live/`, `/embed/`, etc.
  - `Apply to YouTube posts` — postagens da comunidade (`/post/...`, guias comunidade/postagens do canal).
- **Filtro de autor**:
  - `Do not filter by author` — a identidade do autor não importa.
  - `Apply to certain authors` — apenas autores listados acionam este grupo.
  - `Apply to all except certain authors` — os autores listados estão isentos.
- **Autores**: um autor por linha. Aceita `@handle`, URLs completos, `/channel/UC...`, `/c/...`, `/user/...`.
- **Ocultar entradas bloqueadas no feed do YouTube**: enquanto este grupo estiver bloqueando ativamente, os cartões correspondentes nos feeds do YouTube ficarão ocultos. Quando o bloco fica inativo, eles voltam na próxima atualização.

Para tipos de conteúdo de Shorts e Postagens, quando nenhum filtro de autor está definido e o grupo está bloqueado no momento, a extensão também oculta entradas de navegação relevantes (entrada da barra lateral de Shorts, guias de canal Comunidade/Postagens) e as prateleiras correspondentes, como "Últimas postagens do YouTube".

A detecção de curto versus longo se estende a outros sites de vídeo, como TikTok, Vimeo, clipes/VODs Twitch e Dailymotion, quando seu formato de página pode ser detectado.

### 5.3 `TikTok` — bloquear conteúdo do TikTok

O mesmo cartão de editor do editor de vídeo da plataforma, mas com rótulos específicos do TikTok:

- Tipos de conteúdo: vídeos curtos, vídeos, páginas de perfil.
- Autores: identificadores do TikTok (`@handle`) ou URLs de perfil.
- A ocultação de feed oculta os cartões correspondentes nas páginas do TikTok enquanto o grupo está ativo.

### 5.4 `Facebook` — bloquear conteúdo do Facebook

- Tipos de conteúdo: Momentos, vídeos, postagens.
- Autores: nome da página (`page.name`), URL do perfil ou formulário `profile.php?id=...` (o id numérico é preservado como `id:<number>`).
- A ocultação de feed oculta os cartões de feed correspondentes no Facebook.

### 5.5 `Instagram` — bloquear conteúdo do Instagram

- Tipos de conteúdo: Momentos, vídeos, postagens.
- Autores: identificadores do Instagram ou URLs de perfil.
- Caminhos reservados como `/reel/`, `/p/`, `/tv/`, `/explore/` não são tratados como autores.
- A ocultação de feed oculta cartões correspondentes no Instagram.

### 5.6 `Twitch` — bloquear conteúdo do Twitch

- Tipos de conteúdo: clipes, streams/VODs, páginas de canais.
- Autores: nomes de canais ou URLs de canais.
- Caminhos reservados como `/directory`, `/videos`, `/settings`, etc. não são tratados como nomes de canais.
- A ocultação de feed oculta cartas correspondentes no Twitch.

### 5.7 `Reddit` — bloquear Reddit ou subreddits específicos

- **Subreddits**: um subreddit por linha. Lista vazia significa que o grupo se aplica a todo o Reddit. Tanto `productivity` quanto `r/productivity` são aceitos.

### 5.8 `Custom` — bloqueio por função JavaScript

Você escreve uma função JavaScript. A extensão chama isso a cada segundo e usa o que retorna como a lista de bloqueio atual.

Os grupos `Custom` não mostram: comportamento de bloqueio, sites bloqueados, minutos permitidos, intervalo de redefinição, dias agendados ou janelas de tempo. Eles têm apenas uma grande entrada – a função **Regras de bloqueio** – além de controles padrão de congelamento/soneca.

Consulte a **Seção 11** para obter a referência completa de regras personalizadas e a API auxiliar.

---

## 6. Comportamento de bloqueio

Para a maioria dos tipos de grupo você escolhe um dos dois modos:

### 6.1 Bloquear imediatamente

A regra fica ativa sempre que o grupo está ativado, a programação permite e (para grupos de plataforma) a página corresponde.

Para grupos `Default`, isso usa o bloqueio nativo do Chrome. Para grupos de plataformas, ele usa a lógica de sobreposição/saída na página.

### 6.2 Bloquear após alguns minutos

Este é um orçamento de uso.

- **Minutos permitidos antes do bloqueio** (decimal): quantos minutos você se permite por período. Exemplo: `15`, `0.5`, `90`.
- **Intervalo de redefinição do cronômetro (horas)** (decimal): com que frequência o orçamento é redefinido. Exemplo: `24` diariamente, `1` por hora, `0.25` a cada 15 minutos.

Enquanto sobrar tempo, a página funciona normalmente e mostra a sobreposição do cronômetro. Quando o orçamento chega a zero, a página fica bloqueada pelo resto do período e a sobreposição mostra `0:00`, então a guia tenta sair.

A extensão é por grupo, por período:

- Cada grupo tem seu próprio orçamento.
- O tempo gasto em qualquer página que corresponda ao grupo conta para o orçamento desse grupo.
- Várias guias no mesmo grupo compartilham o orçamento. Seus temporizadores permanecem sincronizados; mudar para outra guia também força uma atualização para mostrar imediatamente o tempo compartilhado atual.

Se vários grupos com limite de tempo se aplicarem à mesma página, o mais restrito vence.

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

Isso se aplica a todos os tipos de grupo, exceto `Custom`.

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
- Se você cancelar a qualquer momento, deverá reiniciar a partir da etapa 1.
- As 20 mensagens giram para que você realmente as leia.

Se o grupo também estiver marcado como "sem soneca" (veja a próxima seção), você também não poderá adiá-lo enquanto estiver congelado.

O status de congelamento é mostrado na linha meta do cartão de grupo, incluindo o tempo restante para o congelamento estrito.

---

## 9. Soneca (desativação temporária)

A suspensão desativa temporariamente um grupo sem descongelá-lo, mas apenas com uma justificativa por escrito.

No cartão **Suspender**:

- **Permitir adiamento para este grupo** — se estiver desativado, este grupo não poderá ser adiado (inclusive enquanto estiver congelado).
- **Suspender por (minutos)** — decimal, quanto tempo dura a soneca.
- **Motivo** — deve ter **pelo menos 100 caracteres e mais de 20 palavras**. O botão Iniciar permanece desativado até que ambos sejam atendidos. Se a regra falhar, um aviso embutido será exibido próximo ao botão.

Se o grupo estiver congelado, os minutos de soneca serão bloqueados no valor escolhido antes do congelamento. Você ainda pode suspender, desde que a suspensão seja permitida e o motivo atenda às regras.

Uma mensagem de status confirma a soneca. Quando a soneca termina, o grupo volta automaticamente ao normal.

Você também pode encerrar uma soneca mais cedo com o botão **Encerrar soneca**.

---

## 10. Ações em massa

- **Excluir tudo** remove todos os grupos.
  - Sempre pede confirmação.
  - Se pelo menos um grupo estiver congelado, será necessário o mesmo ritual de 20 etapas do descongelamento.
  - Se algum grupo estiver totalmente congelado e ainda bloqueado, **Excluir tudo** será desativado.

---

## 11. Grupos personalizados (referência completa)

Um grupo `Custom` executa uma função JavaScript no service worker em segundo plano. A função é chamada a cada segundo e a extensão usa o que retorna para decidir quais domínios devem ser bloqueados no momento.

### 11.1 Assinatura de função

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parâmetros:

- `month` — `1` a `12`.
- `dayOfMonth` — `1` a `31`.
- `dayName` — por exemplo `"Monday"`.
- `hour` — `0` a `23`.
- `minute` — `0` a `59`.
- `blockedDomains` — a lista contínua de domínios que outras regras já produziram. Você pode adicioná-lo, substituí-lo ou ignorá-lo.
- `helpers` — um pacote de objetos auxiliares (veja abaixo).

Valor de retorno:

- Uma matriz de strings de domínio que devem ser bloqueadas agora, OU
- nada (nesse caso, a extensão usa tudo o que você transformou em `blockedDomains`).

A função é validada quando você salva. Erros de sintaxe produzem um aviso de status e a regra não é usada até que você a corrija. Se sua função for lançada em tempo de execução, a extensão a capturará, registrará no console em segundo plano e retornará ao resultado anterior.

### 11.2 Agendamento adaptativo

As regras personalizadas normalmente são executadas a cada segundo. Se sua regra começar a demorar muito, a extensão retardará automaticamente o loop (até cerca de 5 segundos). Você não precisa gerenciar isso sozinho.

### 11.3 O objeto `helpers`

Dentro da função `helpers` expõe vários subajudantes. Cada um tem um nome longo e um apelido curto. Existem também métodos getter explícitos:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — o tempo da época atual em milissegundos.

Todos os métodos auxiliares são projetados para serem seguros: parâmetros incorretos retornam `null`, `false` ou um valor vazio em vez de serem lançados.

#### 11.3.1 `timerHelper`

Gerencia contadores regressivos vinculados a um domínio. Os temporizadores persistem durante as reinicializações do navegador. Cada temporizador pertence ao grupo personalizado que o criou.

- `createTimer(domain, durationMs, displayName?)` — cria e retorna um ID de temporizador exclusivo ou `null` se for inválido. Exemplo: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Enquanto o usuário estiver em uma página que corresponda a esse domínio, a sobreposição na página mostrará `Timer1: 30:00` e marcará para baixo.
- `deleteTimer(id)` — exclui o cronômetro. Retorna `true` em caso de sucesso.
- `pauseTimer(id)` — pausa a contagem regressiva.
- `continueTimer(id)` / `resumeTimer(id)` — retoma um cronômetro pausado.
- `resetTimer(id, durationMs?)` — reinicia o cronômetro. Sem `durationMs`, reutiliza o original.
- `addMs(id, ms)` — adiciona milissegundos (ou subtrai com valores negativos).
- `remainingMs(id)` — milissegundos restantes.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — booleanos.
- `getDomain(id)` / `getDisplayName(id)` — lê as informações do temporizador.
- `findByDomain(domain)` — matriz de IDs de temporizador para esse domínio.
- `list()` — array de `{ id, domain, displayName, durationMs, remainingMs, isPaused }` para cada temporizador que este grupo possui.

A duração máxima do temporizador é de cerca de 30 dias.

#### 11.3.2 `persistenceHelper`

Armazenamento semelhante a um mapa com escopo para seu grupo. Os valores devem ser serializáveis ​​por JSON. Útil para lembrar o estado entre chamadas.

- `set(key, value)` — armazena qualquer valor JSON. Retorna `true` em caso de sucesso.
- `get(key, defaultValue?)` — retorna o valor armazenado ou `defaultValue` se estiver ausente.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Limites flexíveis: cerca de 200 chaves por grupo, 16 KB por valor.

#### 11.3.3 `domainHelper`

- `normalize(value)` — retorna o domínio canônico como `youtube.com` ou `null`.
- `matches(hostname, site)` — `true` se `hostname` pertence a `site` (lida com subdomínios).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — grava no console em segundo plano.

Para ver essas mensagens: `chrome://extensions` → habilite o modo de desenvolvedor → clique no link "service worker" da extensão.

#### 11.3.5 `platformHelper`

Inspecione plataformas sociais/de vídeo suportadas.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — retorna o nome canônico da plataforma ou `null`.
- `normalizeAuthor(author, platform)` — normaliza um identificador de autor (identificador, URL, etc.) para uma plataforma específica, ou `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — retorna `{ platform, hostname, pathname, type, authors, url }` ou `null`.
  - `type` é `"short" | "long" | "post" | "unknown"`.
  - `authors` é a lista de autores normalizados detectáveis ​​nesse URL.
- `getType(urlOrHost)` — atalho para `detect(...).type`.
- `getPlatform(urlOrHost)` — atalho para `detect(...).platform`.
- `getAuthors(urlOrHost)` — atalho para `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — retorna `true` se o URL estiver nessa plataforma e um dos autores fornecidos corresponder.

### 11.4 Exemplos

Fácil: bloqueie as redes sociais nas manhãs dos dias de semana.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Médio: 30 minutos de YouTube por sessão do navegador, com contagem regressiva visível.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

Mais difícil: bloqueie uma sessão do TikTok apenas se forem vídeos curtos E o autor estiver na sua lista de distratores. Use `platformHelper`.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

(`globalThis.location` é apenas um exemplo de espaço reservado – você normalmente conduzirá `platformHelper` a partir de sua própria lógica, não da localização do trabalhador, já que o trabalhador em segundo plano não possui um URL de página real.)

Mais difícil: rotação do "site do dia" com limite diário, persistente nas reinicializações.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. Comportamento de várias páginas

- Todas as guias abertas no mesmo grupo compartilham o mesmo cronômetro.
- Quando você alterna para uma guia no mesmo grupo, sua sobreposição é atualizada imediatamente para mostrar o tempo compartilhado atual.
- Quando uma nova regra é adicionada, cada página aberta detecta a alteração e é atualizada em uma fração de segundo; você não precisa recarregar as guias manualmente.
- Quando uma regra expira, os cartões de feed e botões de navegação ocultos são restaurados na próxima atualização.

---

## 13. Internacionalização

Toda a IU está totalmente traduzida. Use o seletor **Idioma** no canto superior direito.

Os idiomas suportados incluem inglês, chinês (simplificado), espanhol, japonês, coreano, além de cobertura parcial para hindi, árabe, bengali, português, russo, punjabi, alemão, francês, turco, vietnamita, italiano, tailandês, holandês, polonês, indonésio, urdu e persa. Idiomas com cobertura parcial recorrem ao inglês para strings ausentes.

O próprio manual de instruções carrega o arquivo markdown correspondente ao idioma selecionado, com o inglês como alternativa.

---

## 14. Mensagens de status

As mensagens de status aparecem como um brinde centralizado que desaparece após cerca de dois segundos:

- "Alterações salvas."
- "Criado \"Nome do grupo\"."
- Erros de validação como "Os minutos permitidos devem ser um número maior que 0".
- "Os minutos de suspensão devem ser um número maior que 0."
- "Grupos congelados não podem ser alterados."

Para campos de entrada com requisitos de formato, a mensagem também aparece ao lado do botão relevante (para suspender).

---

## 15. Privacidade e armazenamento

- Tudo é armazenado localmente em `chrome.storage.local`. Nenhum dado é enviado para lugar nenhum.
- Os itens armazenados incluem: seus grupos, temporizadores de uso, horários da última redefinição, registros de suspensão, temporizadores personalizados e valores persistentes personalizados.
- A extensão não lê o conteúdo da página além do necessário para detectar o tipo de página (caminho/nome do host/marcadores DOM conhecidos para sites de vídeo). Ele não lê suas mensagens, postagens, comentários ou conteúdo privado.

---

## 16. Permissões

- `storage` — para os dados acima.
- `declarativeNetRequest` — para bloqueio nativo de grupos `Default`.
- `alarms` — para agendar transições de regras com eficiência.
- `host_permissions: <all_urls>` — para que o script de conteúdo possa mostrar a sobreposição do temporizador e detectar o contexto da plataforma em qualquer página.

---

## 17. Solução de problemas

- **Um grupo que adicionei não faz nada.** Certifique-se de que o grupo esteja ativado, que a programação permita isso agora, que nenhuma suspensão esteja ativa e (para grupos de plataforma) que a página realmente corresponda ao tipo de conteúdo escolhido e ao filtro de autor.
- **Um cronômetro está travado ou errado em uma guia.** Afaste-se e volte ou foque a guia, o que aciona uma atualização forçada do cronômetro compartilhado.
- **Os cartões de feed reaparecem depois que eu acho que deveriam ser ocultados.** A ocultação de feed só é executada enquanto a regra está bloqueando ativamente. Se você tiver uma regra `after-minutes`, a ocultação de feed entrará em ação quando seu tempo chegar a zero.
- **Um botão de navegação do YouTube que eu esperava estar oculto ainda está lá.** A ocultação de navegação exige que a regra seja definida como "não filtrar por autor" e que o tipo de conteúdo seja Shorts ou postagens do YouTube. Com filtros de autor, a ocultação ocorre apenas por cartão.
- **A regra personalizada não fez nada ou foi lançada silenciosamente.** Abra `chrome://extensions`, ative o modo de desenvolvedor, clique no link "service work" da extensão e verifique o console. Use `helpers.logHelper.log(...)` para rastrear sua regra.
- **Não consigo excluir um grupo.** Provavelmente ele está congelado. Grupos estritamente congelados não podem ser excluídos até que seu bloqueio expire; grupos congelados não estritos podem ser excluídos por meio do ritual de descongelamento.

---

## 18. Glossário

- **Grupo de bloqueio** — um conjunto de regras com seu próprio tipo, comportamento, programação e congelamento/suspendência.
- **Bloqueio instantâneo** — a regra é bloqueada imediatamente sempre que estiver ativa.
- **Bloqueio após minutos** — a regra começa a bloquear somente depois que o orçamento de tempo do período se esgota.
- **Intervalo de redefinição** — com que frequência o orçamento após minutos é redefinido.
- **Programação** — dias + janelas de tempo durante as quais um grupo está ativo.
- **Congelar/Congelar estrito** — estados anti-adulteração.
- **Soneca** — desativação temporária com justificativa por escrito.
- **Filtro de autor** — para grupos de plataformas, restringe a regra a determinados criadores de conteúdo.
- **Tipo de conteúdo** — para grupos de plataformas, restringe a regra a determinadas formas de conteúdo (curto, longo, postagem).
- **Helpers** — utilitários passados ​​para uma função de regra personalizada.
- **Plataforma** — um de `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Cada um tem seu próprio tipo de grupo e lógica de ocultação de feed.

---

## 19. Limitações

- A ocultação de feed depende do DOM atual de cada plataforma. Se a plataforma alterar seu layout, os seletores de ocultação poderão precisar ser atualizados.
- A detecção de contexto de plataforma para sites que não são do YouTube é baseada principalmente em URLs, por isso é mais confiável em URLs de conteúdo canônico.
- Os loops de regras personalizados acontecem no trabalhador em segundo plano, não nas páginas, portanto, as informações no nível do DOM não estão disponíveis dentro da função. Use `platformHelper.detect(url)` com uma string de URL.
- O navegador pode suspender o service worker quando estiver ocioso. A extensão irá retomá-lo assim que uma página ou alarme precisar; os temporizadores de uso não perderão a precisão por causa disso.
