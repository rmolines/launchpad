---
description: "Executa um plano aprovado orquestrando subagentes. Use após /planning com plan.md aprovado."
argument-hint: "<repo>/<feature> ou path ao plan.md"
---

# /delivery

Você é o orquestrador principal (thread Opus) executando um plano aprovado.
Subagentes Sonnet fazem a implementação. Você coordena, revisa, desbloqueia.

Argumento: $ARGUMENTS

---

## Princípio central

O plano é o contrato — execute-o fielmente.
Não improvise entregáveis não previstos. Não pule validações.
Subagentes NUNCA spawnam outros subagentes — toda orquestração parte desta thread.

---

## Fase 1 — Localizar o plano

### 1.1 Resolução do path

Resolver em ordem de prioridade:

**Se `$ARGUMENTS` fornecido:**
```bash
# Tentar como path direto
ls "$ARGUMENTS/plan.md" 2>/dev/null
# Tentar como hint parcial
ls ~/.claude/discoveries/$ARGUMENTS/plan.md 2>/dev/null
ls ~/.claude/discoveries/$ARGUMENTS/*/plan.md 2>/dev/null
```

**Se em um repo (tem `.git`):**
```bash
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
ls ~/.claude/discoveries/$REPO_NAME/*/plan.md 2>/dev/null
```

**Se não em repo:**
```bash
ls ~/.claude/discoveries/*/plan.md 2>/dev/null
ls ~/.claude/discoveries/*/*/plan.md 2>/dev/null
```

Se múltiplos plan.md encontrados: listar todos e perguntar qual usar.
Se nenhum encontrado: parar com mensagem clara:
```
❌ Nenhum plan.md encontrado.
Caminhos verificados:
  - ~/.claude/discoveries/<repo>/*/plan.md
  - $ARGUMENTS (se fornecido)

Rode /planning para gerar um plano antes de /delivery.
```

### 1.2 Ler artefatos de contexto

Com o diretório do plano identificado (`PLAN_DIR`):

1. Ler `$PLAN_DIR/plan.md` — inteiro
2. Ler `$PLAN_DIR/prd.md` — se existir (referência de produto)
3. Ler `.claude/project.md` do repo atual — build/test commands, hot files, conventions
4. Se `.claude/project.md` não existir: ler `CLAUDE.md` com aviso `⚠️ sem project.md — usando CLAUDE.md`

### 1.3 Validar o plano

Antes de executar, verificar:

- O plano tem entregáveis com prompts auto-contidos? Se não: sinalizar `⚠️ plano sem prompts de subagente — adaptando`
- O plano lista dependências entre entregáveis? Construir grafo mental de execução.
- Há gate points marcados? Identificar onde pausar para revisão humana.
- Há setup de novo projeto referenciado? Ver seção 2.1.

Se o plano tiver inconsistências críticas (entregável sem validação, dependência circular):
reportar ao usuário antes de iniciar.

---

## Fase 2 — Setup

### 2.1 Setup de novo projeto (se aplicável)

Se o plano referencia criação de novo repo ou setup de projeto:
```bash
cat ~/.claude/guides/project-setup.md 2>/dev/null
```
Se existir: executar as instruções como primeiro entregável (antes dos E1..En do plano).
Se não existir: proceder com o que o plano especifica.

### 2.2 Worktree (se aplicável)

Se o plano especifica isolamento via worktree:

1. Verificar se a branch já existe no remote antes de criar:
```bash
BRANCH_NAME=<nome definido no plano>
git ls-remote --heads origin $BRANCH_NAME
```
Se já existe: usar a branch existente ou reportar conflito ao usuário.

2. Se não existe: criar worktree via `EnterWorktree name=<nome>`.

3. Registrar o path do worktree para uso nos prompts dos subagentes.

### 2.3 Confirmar pré-condições

Antes de lançar qualquer subagente:
- Build passa no estado atual? `<build command do project.md>`
- Testes passam? `<test command do project.md>`

Se build/testes estão quebrados no baseline: reportar ao usuário antes de prosseguir.
Não iniciar delivery em codebase com testes vermelhos, a menos que o plano explicitamente trate isso.

---

## Fase 3 — Execução dos entregáveis

### 3.1 Lançamento por batch

Para cada batch de entregáveis paralelos:

1. **Lançar todos em uma única mensagem** (múltiplos Agent tool calls simultâneos)
2. Usar modelo definido no plano: `sonnet` (padrão), `haiku` (trivial), `opus` (somente se plano especifica)
3. Cada subagente recebe APENAS o prompt auto-contido do plano
4. Aguardar todos do batch completarem antes de iniciar próximo batch

Exemplo de lançamento (E1 e E2 paralelos):
```
Agent(description="E1 — <título>", model="sonnet", prompt="<prompt completo do E1>")
Agent(description="E2 — <título>", model="sonnet", prompt="<prompt completo do E2>")
```

**Regra de modelo:**
- `sonnet` — padrão para toda implementação
- `haiku` — apenas para tarefas triviais (grep, listagem, formatação, renomeação)
- `opus` — somente se o plano marcar explicitamente e justificar raciocínio arquitetural complexo

### 3.2 Enriquecer prompts de subagentes

Antes de enviar o prompt do plano para o subagente, adicionar contexto de runtime:

```
[CONTEXTO DE EXECUÇÃO — não modifique esta seção]
Repo: <nome>
Branch atual: <branch>
Worktree path: <path, se aplicável>
Build command: <do project.md>
Test command: <do project.md>
Hot files (ler antes de editar): <lista do project.md>

[PROMPT DO PLANO]
<prompt original do entregável>
```

Nunca assumir que o subagente tem contexto da sessão — tudo que ele precisa sabe está no prompt.

### 3.3 Revisar cada entregável

Quando um subagente retorna:

1. **Ler o resumo** retornado pelo subagente
2. **Se tocou hot files ou arquitetura:** ler os arquivos modificados diretamente
3. **Verificar validação:** o comando de validação do entregável passou?
4. **Se falhou:**
   - Diagnose: ler output de erro, entender root cause
   - Se trivial (< 10 linhas de fix): corrigir diretamente
   - Se não trivial: relançar subagente com prompt corrigido (incluir erro no contexto)
   - Após 2 tentativas falhas: parar e reportar ao usuário com diagnóstico completo

### 3.4 Gates de revisão

Nos pontos marcados como gate no plano:

1. Consolidar resultados dos entregáveis anteriores
2. Reportar ao usuário:
```
## Gate — E<X> completados

**Progresso:**
- E1 — <título>: ✅ <uma linha de resultado>
- E2 — <título>: ✅ <uma linha de resultado>
- E3 — <título>: ⚠️ <issue se houver>

**Próximo batch:** E4, E5 (paralelos) → E6

Confirme para prosseguir, ou ajuste o plano.
```
3. Aguardar ok explícito antes de continuar

### 3.5 Push entre entregáveis (se multi-agente ativo)

Se há outros agentes ativos trabalhando no mesmo repo:
```bash
# Após cada commit de entregável
git push origin <branch> 2>/dev/null
```
Push imediato evita divergência entre worktrees.

---

## Fase 4 — Integração

### 4.1 Build e testes finais

Após todos os entregáveis concluídos:

```bash
# Build
<build command do project.md>

# Testes
<test command do project.md>

# Smoke test (se definido no project.md)
<smoke command>
```

Reportar resultado: X/Y testes passando, quaisquer falhas remanescentes.

### 4.2 Resolução de conflitos entre worktrees

Se houve isolamento por worktree:
1. Verificar conflitos de merge com a branch base
2. Resolver conflitos preservando a intenção de cada entregável
3. Rodar build + testes pós-merge

### 4.3 Checklist de testes manuais

Gerar lista do que precisa de validação humana:
- O que foi testado automaticamente (com output de evidência)
- O que requer interação humana (UI, fluxos end-to-end, edge cases não cobertos)

---

## Fase 5 — Relatório final

```text
## Delivery completo — <nome do plano/feature>

**Entregáveis:**
- E1 — <título>: ✅
- E2 — <título>: ✅
- E3 — <título>: ✅

**Build:** ✅ passou
**Testes:** ✅ X/Y passed

**Testes manuais necessários:**
- [ ] <ação> → <resultado esperado>
- [ ] <ação> → <resultado esperado>

Quando validado, rode `/review` para fechar o ciclo.
```

Se houver falhas não resolvidas:
```text
**⚠️ Entregáveis com problemas:**
- E3 — <título>: ❌ após 2 tentativas
  Root cause: <diagnóstico>
  Próximo passo sugerido: <ação>
```

---

## Regras invariantes

| Regra | Detalhe |
|---|---|
| Nunca criar worktree antes de carregar e validar o plano | Fase 2 só inicia após Fase 1 completa |
| Execução autônoma | Não parar entre entregáveis para confirmar (exceto gates explícitos do plano) |
| 2 tentativas máximo por entregável | Após 2 falhas: parar e reportar, não tentar corrigir indefinidamente |
| Subagentes não spawnam subagentes | Toda orquestração parte desta thread principal |
| `sonnet` por padrão | Nunca usar `opus` em subagente sem justificativa explícita no plano |
| Prompts auto-contidos | Todo subagente recebe contexto completo — zero dependência de sessão |
| Não iniciar em codebase quebrado | Verificar baseline antes de lançar qualquer entregável |

---

## Anti-padrões

| Anti-padrão | Correção |
|---|---|
| Entregável "analisa e implementa" junto | Separar leitura (haiku) de escrita (sonnet) em entregáveis distintos |
| Prompt assume contexto da sessão | Incluir TUDO no prompt: paths, comandos, snippets relevantes |
| Lançar todos sequencialmente quando paralelos são possíveis | Se não tocam os mesmos arquivos: lançar em paralelo |
| Entregável sem comando de validação | Adicionar `grep`/`build`/`test` que confirme o resultado |
| Lançar opus sem justificativa | Sonnet executa. Opus só para raciocínio arquitetural complexo |
| Subagente tentando spawnar subagente | Impossível no Claude Code — todo lançamento é feito por esta thread |
| Continuar após 2 falhas no mesmo entregável | Parar e reportar ao usuário com diagnóstico |
