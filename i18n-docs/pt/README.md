# Extensão do cofre

A extensão Vault é uma ferramenta de foco do Manifest V3 para navegadores Chromium. Seu editor atual gerencia grupos de blocos de sites, grupos de plataformas suportadas, grupos JavaScript personalizados, programações, controles de congelamento e suspensão e links opcionais de ponte de aplicativos da web.

O código-fonte é o contrato do produto. O manual do aplicativo em inglês em [manual/en.md](manual/en.md) explica os controles enviados; ele substitui os manuais anteriores copiados e traduzidos automaticamente.

## Capacidades atuais

- Grupos de sites padrão com comportamento de lista de bloqueio ou lista de permissão, redirecionamento opcional, bloqueio imediato, limite de tempo ou contagem regressiva.
- Grupos dedicados para YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord e Twitter/X.
- Filtros específicos da plataforma e controles opcionais de ocultar elementos onde o perfil da plataforma atual os suporta.
- Grupos JavaScript personalizados com verificação de sintaxe, modelos, controles de execução, tempo de execução controlado e feed de log.
- Programações por grupo, modos de congelamento, controles de soneca, importação/exportação e salvamento automático.
- Acesso opcional à pasta local para operações suportadas de texto de regras personalizadas, CSV e JSON.
- Conexão opcional a um hub de ponte nativo do Vault para grupos explicitamente vinculados.

## Execute localmente

1. Abra `chrome://extensions` em um navegador Chromium.
2. Ative o **modo de desenvolvedor**.
3. Selecione **Carregar descompactado** e escolha esta pasta de repositório.
4. Abra a extensão do Vault e crie um grupo.

O manifesto requer o Chrome 116 ou posterior para suas APIs fora da tela e de regras atuais.

## Verificações de desenvolvimento

Execute o conjunto de testes de extensão nesta pasta:

```bash
./tests/run.sh
```

O conjunto exercita comportamento auxiliar, perfis de plataforma, renderização Markdown e auditoria do catálogo de tradução.

## Manuais e traduções localizados

Os documentos em inglês continuam sendo a fonte canônica. A extensão envia seus manuais localizados ao lado de `manual/en.md`, e as cópias localizadas de outros documentos mantidos estão em `i18n-docs/<locale>/`.

Os catálogos da UI em `translation/*.json` estão completos para cada localidade suportada. Verifique os catálogos e documentos localizados com:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Escopo

A extensão Vault atua apenas no perfil do navegador onde está instalada e nas páginas às quais o navegador lhe concede acesso. Ele não instala aplicativos nativos, altera permissões do sistema ou sincroniza grupos, a menos que o usuário conecte explicitamente uma ponte e vincule grupos correspondentes.
