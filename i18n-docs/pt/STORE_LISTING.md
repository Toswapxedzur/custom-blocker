# Fonte de listagem da Chrome Web Store

Esta é a fonte em inglês da extensão atual do Manifest V3. Verifique-o em `manifest.json` antes de publicar uma nova construção de loja.

## Nome da extensão

```text
Adamancia Vault
```

## Breve descrição

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Descrição detalhada

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Explicações sobre permissões

| Permissão | Finalidade atual |
| --- | --- |
| `storage` | Salve grupos, configurações e estado do editor local. |
| `alarms` | Agende verificações de antecedentes e atualizações de grupo com base no tempo. |
| `offscreen` | Execute o tempo de execução controlado de regras personalizadas em que o Chromium requer um documento fora da tela. |
| `tabs` | Leia o contexto da guia ativa necessário para aplicar um grupo e mostrar o status. |
| `webNavigation` | Reavalie os grupos aplicáveis ​​após a navegação. |
| `favicon` | Exiba ícones de sites no editor, quando disponíveis. |
| `<all_urls>` | Aplique regras de site e plataforma criadas pelo usuário às páginas que o usuário escolhe controlar. |

## Liberar verificações

1. Execute `./tests/run.sh`.
2. Atualize a versão do manifesto apenas para o commit de lançamento.
3. Revise o manual em inglês e o resultado da auditoria de tradução.
4. Construa o artefato de upload a partir do commit revisado.
5. Não inclua notas de origem, acessórios de teste ou arquivos de desenvolvimento privados no artefato de upload.
