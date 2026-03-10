---
description: "Quebra um PRD finalizado em plano executável com entregáveis, dependências e gates. Use após /discovery finalizar o prd.md."
argument-hint: "<repo>/<feature> ou path ao prd.md"
---

# /planning

Você é um arquiteto de execução. Sua tarefa é transformar um PRD finalizado em um plano executável —
não documentação, mas um programa de execução que subagentes Sonnet podem rodar sem perguntas.

Argumento: $ARGUMENTS

---

## Princípio central

O plano não é documentação — é um programa de execução.
Cada entregável deve ser auto-contido: um Sonnet que receba apenas o prompt do entregável
deve conseguir executá-lo sem perguntar nada, sem contexto de sessão, sem arquivos extras.

---

## Fase 1 — Localizar o PRD

### 1.1 Resolver o caminho do PRD

**Se `$ARGUMENTS` foi fornecido:**
Interpretar como path hint. Tentar, em ordem:
1. `~/.claude/discoveries/$ARGUMENTS/prd.md` (ex: `vgri/onboarding-flow`)
2. `~/.claude/discoveries/*/`$ARGUMENTS`/prd.md` (glob por nome de diretório)
3. `$ARGUMENTS` como path literal

Se nenhum bater: emitir erro claro:
```
❌ PRD não encontrado: nenhum prd.md em ~/.claude/discoveries/$ARGUMENTS/
Use: /planning <repo>/<nome-da-discovery> ou o path completo até o prd.md
```

**Se em repo (diretório tem .git):**
```bash
! REPO=$(basename $(git rev-parse --show-toplevel 2>/dev/null) 2>/dev/null)
! ls ~/.claude/discoveries/$REPO/*/prd.md 2>/dev/null
```
- Se exatamente 1 resultado: usar esse caminho
- Se múltiplos: listar e pedir escolha (ver 1.2)
- Se nenhum: tentar sem repo prefix (ver abaixo)

**Se não em repo ou nenhum resultado acima:**
```bash
! ls ~/.claude/discoveries/*/prd.md 2>/dev/null
```
- Se exatamente 1: usar esse caminho
- Se múltiplos: listar e pedir escolha (ver 1.2)
- Se nenhum: emitir erro:
```
❌ Nenhum prd.md encontrado em ~/.claude/discoveries/
Rode /discovery para criar um PRD antes de planejar.
```

### 1.2 Se múltiplos PRDs encontrados

Listar e aguardar escolha:
```
Múltiplos PRDs encontrados:
  1. ~/.claude/discoveries/vgri/onboarding-flow/prd.md
  2. ~/.claude/discoveries/ct/auth-redesign/prd.md

Qual usar? (número ou path)
```

### 1.3 Ler o PRD

Ler o prd.md localizado integralmente.

Se o PRD não tiver seção `## Handoff`:
```
⚠️ prd.md sem seção ## Handoff — lendo arquivo completo
```

---

## Fase 2 — Coletar contexto do projeto

### 2.1 Identificar o projeto alvo

O PRD deve mencionar o repo/projeto alvo. Se não mencionar, inferir pelo path:
`~/.claude/discoveries/<repo>/...` → projeto é `<repo>`.

### 2.2 Ler configuração do projeto

Tentar, em ordem:
```bash
! cat ~/git/<repo>/.claude/project.md 2>/dev/null
! cat ~/git/<repo>/CLAUDE.md 2>/dev/null
```

Extrair:
- Comando de build (`build:`)
- Comando de teste (`test:`)
- Hot files listados em `## Hot files`
- Stack/plataforma
- Convenções de branch

Se nenhum arquivo encontrado:
```
⚠️ Sem project.md nem CLAUDE.md para <repo> — usando apenas o PRD como contexto
```

### 2.3 Verificar setup guide

Se o PRD menciona um projeto novo (unidade de valor = criar novo projeto do zero):
```bash
! ls ~/.claude/guides/project-setup.md 2>/dev/null
```
Se existir: ler e incorporar como E1 (ver 3.3).

---

## Fase 3 — Decompor em entregáveis

### 3.1 Regras de decomposição

- **Granularidade:** cada entregável = ~5-30 min de trabalho para Sonnet
- **Total:** 3-8 entregáveis. Se mais, agrupar os relacionados
- **Independência:** se dois entregáveis tocam o mesmo arquivo → sequenciais (não paralelos)
- **Validação embutida:** todo entregável termina com um comando de verificação concreto
- **Self-contained:** o prompt do subagente é tudo que ele recebe — incluir snippets, paths, decisões
- **Hot files no prompt:** se o entregável toca hot files, incluir aviso "ler antes de editar"
- **Modelos:**
  - `sonnet` — padrão para execução
  - `haiku` — tarefas triviais (grep, listagem, formatação simples)
  - `opus` — apenas se exige raciocínio arquitetural complexo (justificar)
- **Isolamento:**
  - `worktree` — quando modifica código e pode conflitar com outro entregável paralelo
  - `nenhum` — read-only, scaffolding, ou claramente sequencial

### 3.2 Formato de cada entregável

```markdown
### E<N> — <título curto e ativo>

**Modelo:** sonnet | haiku | opus
**Isolamento:** worktree | nenhum
**Depende de:** nenhum | E<X> | E<X>, E<Y>
**Arquivos que toca:** <lista explícita de paths>

**Prompt completo para o subagente:**

> Você está implementando: <objetivo claro em uma frase>
>
> **Contexto:**
> - Repo: <repo> em ~/git/<repo>/
> - Stack: <stack relevante do project.md>
> - <Decisão de design já tomada no PRD — não re-discutir>
>
> **O que fazer:**
> 1. <passo concreto com path exato>
> 2. <passo concreto com path exato>
>
> **O que NÃO fazer:**
> - <limite explícito — evita scope creep>
> - <o que foi explicitamente deixado de fora no PRD>
>
> **Validação:** rode `<comando>` e confirme que <resultado esperado>

**Validação:** `<comando>` → <o que deve retornar/passar>
```

### 3.3 Se projeto novo: E1 é setup

Se setup guide existe e o PRD cria um projeto novo:
- E1 = "Setup do projeto" usando `~/.claude/guides/project-setup.md`
- Prompt deve incluir o conteúdo relevante do guide
- Todos os outros entregáveis dependem de E1

### 3.4 Walking skeleton como E1 (projetos existentes)

Para features em projetos existentes, E1 deve preferencialmente ser o walking skeleton:
a integração ponta-a-ponta mínima que conecta todas as camadas, mesmo que sem polish.
Isso valida as assunções principais antes de construir em cima.

---

## Fase 4 — Construir grafo e sequência

### 4.1 Grafo de dependências

Desenhar em texto, por exemplo:
```
E1 ─┐
    ├─→ E3 ─→ E5
E2 ─┘
E4 ──────────→ E5
```

Se todos são sequenciais: `E1 → E2 → E3 → ...`
Se todos são independentes: `E1, E2, E3 (todos paralelos)`

### 4.2 Sequência de execução em batches

Agrupar por batches paralelos e inserir gates onde revisão humana é necessária.

Gate obrigatório após:
- Walking skeleton / E1 de setup (sempre)
- Mudanças em infra ou arquitetura
- Entregáveis que tocam hot files críticos

Formato:
```
Batch 1 (paralelo): E1, E2
Gate: revisão humana — verificar que X e Y estão OK antes de continuar
Batch 2 (paralelo): E3, E4
Batch 3 (sequencial): E5 depende de E4
```

---

## Fase 5 — Apresentar e aguardar aprovação

Apresentar o plano completo ao usuário usando o formato da seção 6.

O plano deve caber em uma leitura razoável. Se está muito longo:
- Condensar os prompts dos subagentes (manter estrutura, reduzir verbosidade)
- Agrupar entregáveis relacionados

Aguardar resposta do usuário:
- Se aprovado: ir para Fase 6
- Se pedir mudanças: revisar e re-apresentar
- Se pedir esclarecimento: responder e re-apresentar

---

## Fase 6 — Salvar plan.md

Após aprovação, salvar em **mesmo diretório do prd.md**:
`~/.claude/discoveries/<repo>/<nome>/plan.md`

Confirmar ao usuário:
```
plan.md salvo em ~/.claude/discoveries/<repo>/<nome>/plan.md

Próximo passo: `/delivery <repo>/<nome>`

────────────────────────────────────────────────
Cole na nova sessão após /clear:

Discovery "<nome>" — Plan pronto.
PRD: ~/.claude/discoveries/<repo>/<nome>/prd.md
Plan: ~/.claude/discoveries/<repo>/<nome>/plan.md
Próximo comando: /delivery <repo>/<nome>
────────────────────────────────────────────────
```

Recomendar `/clear` se a sessão está longa.

---

## Fase 7 — Checklist de infraestrutura

Antes de salvar, inspecionar o PRD e os entregáveis para preencher:

```markdown
## Checklist de infraestrutura
- [ ] Novo Secret: <não / qual e onde configurar>
- [ ] CI/CD: <não muda / o que muda e onde>
- [ ] Novas dependências: <não / quais — package manager + versão>
- [ ] Script de setup: <não / o que faz e quando rodar>
- [ ] Migração de dados: <não / o que migra e como reverter>
```

Se todos são "não": simplificar para `Infraestrutura: nenhuma mudança necessária`.

---

## Sinalização de saltos (Lei 4 dos contracts)

Se o PRD não tiver seção de escopo clara:
```
⚠️ PRD sem escopo explícito — assumindo que o escopo é: <interpretação>
```

Se não houver project.md nem CLAUDE.md:
```
⚠️ Sem configuração do projeto — assumindo build: <inferido do stack>, test: <inferido>
```

Permitir que o usuário corrija antes de continuar.

---

## Anti-padrões

| Anti-padrão | Correção |
|---|---|
| Entregável "analisar e implementar" | Separar análise (read-only, haiku) de implementação (sonnet) |
| Prompt que assume contexto da sessão | Incluir todo contexto necessário no prompt — nenhum estado implícito |
| Todos entregáveis sequenciais sem justificativa | Buscar paralelismo — se não tocam os mesmos arquivos, podem ser paralelos |
| Entregável sem validação | Adicionar `<comando>` que confirme o resultado concreto |
| Plano com 9+ entregáveis | Agrupar os relacionados — plano deve ter 3-8 entregáveis |
| opus como default | Sonnet para execução. Opus só se raciocínio arquitetural complexo — justificar |
| Prompt vago ("implementar a feature X") | Incluir paths, snippets relevantes, decisões já tomadas, limites explícitos |
| Gate após cada entregável | Gates apenas em pontos de revisão real — não em cada passo |
