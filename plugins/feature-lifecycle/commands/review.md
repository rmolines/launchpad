---
description: "Valida código contra PRD e roda simplify para qualidade. Use após /delivery completar."
argument-hint: "<repo>/<feature>"
---

# /review

Valida que o código implementado resolve o problema do PRD e atende os critérios de sucesso.
Roda simplify no código modificado. Não faz shipping — isso é `/ship`.

**Argumento recebido:** $ARGUMENTS

---

## Essência

Uma pergunta: **o que foi construído resolve o que foi decidido?**

Entrada: código + PRD + plan.
Saída: relatório de alinhamento + código simplificado.
Gate: humano decide se vai pra `/ship` ou corrige antes.

---

## Passo 1 — Localizar contexto

### 1.1 Resolver PRD e plan

**Se `$ARGUMENTS` fornecido:**
- Tentar `~/.claude/discoveries/$ARGUMENTS/prd.md`
- Tentar `~/.claude/discoveries/*/$ARGUMENTS/prd.md`
- Tentar como path literal

**Se em repo git:**
```bash
REPO_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")
ls ~/.claude/discoveries/$REPO_NAME/*/prd.md 2>/dev/null
```

**Se múltiplos:** listar e perguntar.
**Se nenhum:** parar com mensagem clara.

### 1.2 Carregar (em paralelo)

- Ler `prd.md` — focar em: `## Problema`, `## Solução`, `## Não-escopo`, critérios de sucesso
- Ler `plan.md` — focar em: entregáveis e validações
- `git diff origin/main...HEAD` — commits da branch
- `git diff HEAD` — mudanças não commitadas

Combinar os dois diffs como "diff total da feature".

### 1.3 Gate de contexto

- PRD + plan encontrados → prosseguir
- Apenas plan → avisar `⚠️ prd.md não encontrado — validação apenas contra plano técnico. Continuar?`
- Nenhum → parar: `Nenhum contexto encontrado. Especifique: /review <repo>/<feature>`

---

## Passo 2 — Validar alinhamento com PRD

### 2.1 Classificar cada mudança

Comparar o diff com `## Problema` e `## Solução` do PRD:

| Classificação | Critério |
|---|---|
| ✅ Alinhado | Implementa diretamente o que o PRD descreve |
| ⚠️ Drift | Resolve algo relacionado mas diferente do problema original |
| ➕ Extra-escopo | Algo não mencionado no PRD (pode ser ok) |
| ❌ Pendente | Algo que o PRD requer mas não está no diff |
| ❌ Fora-do-escopo | Implementa algo explicitamente excluído em `## Não-escopo` |

### 2.2 Verificar critérios de sucesso

Listar cada critério do PRD e indicar status (✅ / ⚠️ / ❌) com evidência.

### 2.3 Cobrir o plan

Mapear cada entregável do plan contra o diff:

| Status | Critério |
|---|---|
| ✅ Feito | Claramente implementado |
| 🔄 Parcial | Começou mas incompleto |
| ❌ Faltando | Não encontrado no diff |
| ➕ Não planejado | No diff mas não no plan |

---

## Passo 3 — Simplify

Rodar o agente code-simplifier no código modificado:

```
Agent(
  description="simplify changed code",
  model="opus",
  prompt="<prompt do code-simplifier com lista de arquivos modificados>"
)
```

Incluir no prompt do subagente:
- Lista explícita dos arquivos modificados (`git diff origin/main...HEAD --name-only`)
- Contexto do CLAUDE.md do repo (se existir) para coding standards
- Instrução: foco nos arquivos tocados, preservar funcionalidade

---

## Passo 4 — Relatório

```text
## Relatório de Review — <nome-da-feature>

### Alinhamento com PRD

**Problema:** <1-2 frases do PRD>
**Solução esperada:** <1-2 frases do PRD>

| Status | Mudança | Observação |
|--------|---------|------------|
| ✅ | <mudança X> | <como resolve o problema> |
| ⚠️ | <mudança Y> | <como difere do objetivo> |
| ❌ | <o que falta> | <não implementado> |

**Critérios de sucesso:**
| Critério | Status | Evidência |
|----------|--------|-----------|
| <critério 1> | ✅ | <onde no código> |

**Não-escopo violado:** <sim/não>

### Cobertura do plan

| Entregável | Status | Observação |
|------------|--------|------------|
| E1 — <título> | ✅ | |
| E2 — <título> | 🔄 | <o que falta> |

**Resumo:** X/Y entregáveis concluídos.

### Simplify

<resultado do code-simplifier — o que foi melhorado>

### Veredito

**[Aprovado | Ajustes necessários | Bloqueado]**
<Justificativa em 2-3 frases.>
```

Vereditos:
- **Aprovado** — alinhado com PRD, critérios atendidos, plano coberto
- **Ajustes necessários** — drift leve ou itens faltando, sem violação de Não-escopo
- **Bloqueado** — drift significativo, Não-escopo violado, critérios críticos não atendidos

---

## Passo 5 — Gate humano

Apresentar relatório e aguardar.

- **Aprovado** → `Próximo passo: /ship`
- **Ajustes necessários** → listar o que corrigir, perguntar se quer prosseguir mesmo assim
- **Bloqueado** → parar. Não sugerir /ship sem aprovação explícita

```text
Review completo.

Veredito: <veredito>
Próximo passo: /ship <repo>/<feature>

Recomendo /clear antes se a sessão está longa.
```

---

## Regras

- **Read-only.** Review não modifica código (exceto o simplify, que é opt-in pelo agente).
- **PRD é a referência primária.** Plan é secundário — o que importa é se resolve o problema.
- **`## Não-escopo` é hard check.** Qualquer violação = Bloqueado.
- **Uma skill, uma responsabilidade.** Não faz shipping, não faz docs, não faz cleanup.

---

## Quando NÃO usar

- Antes de `/delivery` completar — precisa ter código pra validar
- Para shipping → use `/ship`
- Para fix/debug → use `/fix` ou `/debug`
- Sem PRD nem plan → faça review manual ou rode `/discovery` primeiro
