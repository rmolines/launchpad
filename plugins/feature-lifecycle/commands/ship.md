---
description: "Faz PR, merge, deploy, captura learnings e fecha o ciclo. Use após /review aprovar."
argument-hint: "<repo>/<feature>"
---

# /ship

Coloca código em produção e fecha o ciclo de desenvolvimento.
PR + merge + deploy + docs + cleanup.

**Argumento recebido:** $ARGUMENTS

---

## Essência

Transição: **código verificado → produção → conhecimento capturado.**

Entrada: código revisado (post /review) + PRD + plan.
Saída: PR merged, deploy verificado, docs atualizados, discovery arquivado.

---

## Fase 1 — Contexto

### 1.1 Localizar PRD e plan

Mesma lógica de resolução do /review:
- `$ARGUMENTS` como hint → `~/.claude/discoveries/$ARGUMENTS/`
- Inferir do repo atual se em git
- Listar e perguntar se múltiplos

Ambos são opcionais — /ship pode rodar sem PRD (ex: fix rápido), mas avisa:
```
⚠️ Sem prd.md — shipping sem referência de produto. PR não incluirá critérios de sucesso.
```

### 1.2 Configuração do projeto

```bash
SPEC=".claude/project.md"
BUILD_CMD=$(grep "^build:" "$SPEC" 2>/dev/null | sed 's/^build: //' | head -1)
TEST_CMD=$(grep "^test:" "$SPEC" 2>/dev/null | sed 's/^test: //' | head -1)
SMOKE_TEST=$(grep "^smoke:" "$SPEC" 2>/dev/null | sed 's/^smoke: //' | head -1)
LEARNINGS_PATH=$(grep "^learnings:" "$SPEC" 2>/dev/null | sed 's/^learnings: //' | head -1)
HOT_FILES=$(awk '/^## Hot files/{found=1; next} found && /^- /{print substr($0,3)} found && /^##/{exit}' "$SPEC" 2>/dev/null)
```

Fallback: `CLAUDE.md`. Se nenhum: perguntar ao usuário.

---

## Fase 2 — Build + test (HARD GATE)

```bash
$BUILD_CMD
$TEST_CMD
```

Se qualquer um falhar: **parar**. Nunca criar PR com build quebrado.
Mostrar output completo.

---

## Fase 3 — Commit + PR + merge

### 3.1 Detectar caminho

```bash
LINES_CHANGED=$(git diff origin/main...HEAD --stat | tail -1 | grep -oE '[0-9]+ (insertion|deletion)' | awk '{sum+=$1} END {print sum+0}')
HOT_FILES_TOUCHED=$(git diff origin/main...HEAD --name-only | grep -Fxf <(echo "$HOT_FILES" | tr ' ' '\n') | wc -l | tr -d ' ')
```

| Condição | Caminho |
|---|---|
| `LINES < 150` e `HOT_FILES_TOUCHED == 0` | **Fast** — merge direto |
| Caso contrário | **Standard** — PR com rastreabilidade |

### 3.2 Commit

Mensagem no formato:
```
feat|fix|chore: <descrição concisa>

PRD: <path relativo ao prd.md>

- <detalhe 1>
- <detalhe 2>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### 3.3 Preflight de hot files

```bash
git fetch origin
MERGE_BASE=$(git merge-base HEAD origin/main)
OVERLAP=$(comm -12 <(git diff --name-only $MERGE_BASE origin/main | sort) <(git diff --name-only $MERGE_BASE HEAD | sort))
```

Hot file em overlap → **ALERTA** + perguntar antes de rebaser.

### 3.4 Rebase + push

```bash
git rebase origin/main
git push -u origin <branch>
```

Conflitos → listar e pedir orientação. Nunca `--force` sem aprovação.

### 3.5 PR + merge

**Fast:**
```bash
gh pr create --title "<título>" --body "$(cat <<'EOF'
## O que foi feito
- <bullets>

## PRD
- Referência: <path>
- Critérios de sucesso: <lista>

> Fast path: verificação local passou.
EOF
)"
gh pr merge --squash
```

**Standard:**
```bash
gh pr create --title "<título>" --body "$(cat <<'EOF'
## O que foi feito
- <bullets>

## PRD
- Referência: <path>
- Critérios de sucesso: <lista>
- Não-escopo respeitado: sim

## Como testar
- <passos>

## Impacto em produção
- Restart/redeploy: sim/não
- Novo secret: <nome> ou nenhum
EOF
)"
```

Standard path: aguardar CI antes de mergear.
```bash
gh pr checks <pr_number> --watch
gh pr merge --squash
```

Ambos os paths: deletar branch remota após merge.

---

## Fase 4 — Deploy + smoke test

### 4.1 Verificar deploy

Usar comando de `project.md` ou `CLAUDE.md`.
Se não especificado: perguntar ao usuário.
**Não declarar deploy OK sem confirmar.**

### 4.2 Smoke test

Usar `$SMOKE_TEST` de project.md.
Se não encontrado: perguntar. **Nunca inventar smoke test genérico.**
Se falhar: investigar logs antes de escalar.

---

## Fase 5 — Documentação (4 subagentes paralelos, model: sonnet)

Coletar antes de disparar:
- SHA do merge commit: `git log --oneline -5`
- PR number
- URL do repo: `git remote get-url origin`
- Paths do prd.md e plan.md
- `REPO_ROOT=$(git worktree list | head -1 | awk '{print $1}')`

Se `REPO_ROOT` falhar: parar antes de qualquer write.

### Subagente A — HANDOVER.md
> Ler prd.md e plan.md. Gerar entrada com: data, o que foi feito (orientado pelo PRD),
> decisões, armadilhas, próximos passos, arquivos-chave.
> Append em `$REPO_ROOT/HANDOVER.md` (criar se não existir).

### Subagente B — CHANGELOG.md
> Formato AI-native: git history é a fonte de verdade — pointer, não prose.
> ```
> ## <feature> — PR #N — YYYY-MM-DD
> **Tipo:** feat|fix|improvement
> **PRD:** <path>
> **Commit:** `git show <SHA>`
> **Decisões:** ver LEARNINGS.md#<feature>
> ```
> Inserir após `# Changelog`. Criar se não existir.

### Subagente C — LEARNINGS.md
> Avaliar se algo vale registrar — agente decide, não pergunta.
> Prioridade: gaps entre PRD e implementação.
> Se sim: propor ao usuário, com aprovação adicionar.
> Se não: "nada novo".

### Subagente D — CLAUDE.md pitfalls
> Avaliar se houve armadilha nova — agente decide.
> Critério: problema não-óbvio que outro agente cometeria.
> Se sim: propor ao usuário, com aprovação adicionar.
> Se não: "sem novas armadilhas".

Commit único:
```bash
git -C "$REPO_ROOT" add HANDOVER.md CHANGELOG.md LEARNINGS.md CLAUDE.md
git -C "$REPO_ROOT" commit -m "docs(<feature>): close cycle — HANDOVER, CHANGELOG, LEARNINGS

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git -C "$REPO_ROOT" push origin main
```

---

## Fase 6 — Cleanup

### 6.1 Worktree

```bash
WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/$FEATURE"
# Verificar se não estamos dentro da worktree
CURRENT_DIR=$(pwd)
if [[ "$CURRENT_DIR" == "$WORKTREE_PATH"* ]]; then
  echo "AVISO: saia da worktree antes de remover."
fi

git -C "$REPO_ROOT" worktree remove --force "$WORKTREE_PATH" 2>/dev/null || true
git -C "$REPO_ROOT" worktree prune
git -C "$REPO_ROOT" branch -D "worktree-$FEATURE" 2>/dev/null || true
```

### 6.2 Arquivar discovery

```bash
DISCOVERY_SRC="$HOME/.claude/discoveries/$REPO_NAME/$FEATURE"
DISCOVERY_DST="$HOME/.claude/discoveries/$REPO_NAME/archived/$FEATURE"
if [ -d "$DISCOVERY_SRC" ]; then
  mkdir -p "$(dirname "$DISCOVERY_DST")"
  mv "$DISCOVERY_SRC" "$DISCOVERY_DST"
fi
```

### 6.3 Cockpit (se existir)

```bash
COCKPIT="$HOME/git/cockpit.md"
if [ -f "$COCKPIT" ]; then
  printf "| %s | %s | Feature \`%s\` — ciclo fechado (PR #%s merged) |\n" \
    "$(date +%Y-%m-%d)" "$(basename $REPO_ROOT)" "$FEATURE" "$PR_NUMBER" >> "$COCKPIT"
fi
```

---

## Fase 7 — Resumo final

```text
## Ciclo completo — <feature>

**Ship:** PR #N merged — <url>
**Deploy:** ✅ verificado
**Smoke test:** ✅

**Docs:**
- HANDOVER.md ✅
- CHANGELOG.md ✅
- LEARNINGS.md <✅ ou ⏭️ nada novo>
- CLAUDE.md pitfalls <✅ ou ⏭️>

**Cleanup:**
- Worktree: <removida | não existia>
- Discovery: arquivado em ~/.claude/discoveries/<repo>/archived/<feature>/

Ciclo fechado. Próximo: /discovery para a próxima feature.
```

---

## Regras

- **Build + test é HARD GATE.** Nunca PR com build quebrado.
- **Standard path espera CI.** Fast path mergea direto.
- **Nunca `--force` sem aprovação.**
- **Nunca declarar "em produção" sem verificar deploy e smoke test.**
- **Smoke test vem do project.md — nunca inventar genérico.**
- **Subagentes de docs usam model: sonnet.**
- **Se qualquer fase falhar: parar e reportar.**

---

## Quando NÃO usar

- Antes de `/review` aprovar — valide primeiro
- Sem código pra mergear — rode `/delivery` antes
- Para validação de alinhamento → use `/review`
