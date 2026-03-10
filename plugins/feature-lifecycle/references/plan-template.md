# Plan: <nome>
_PRD: ~/.claude/discoveries/<repo>/<nome>/prd.md_
_Gerado em: <data>_

## Problema
<Descrição do problema — extraída diretamente do PRD. Um parágrafo que descreve o que está
sendo resolvido e para quem. Usada pelo executor para verificar alinhamento durante a execução.>

---

## Entregáveis

### E1 — <título curto e ativo>

**Modelo:** sonnet
**Isolamento:** worktree
**Depende de:** nenhum
**Arquivos que toca:**
- `~/git/<repo>/src/path/to/file.ts`
- `~/git/<repo>/src/path/to/other.ts`

**Prompt completo para o subagente:**

> Você está implementando: <objetivo claro em uma frase>.
>
> **Contexto:**
> - Repo: `<repo>` em `~/git/<repo>/`
> - Stack: <tecnologia principal, versão relevante>
> - <Decisão de design já tomada — não re-discutir. Ex: "usamos Repository pattern, não ActiveRecord">
> - <Constraint técnico relevante. Ex: "a API externa retorna arrays, nunca objetos">
>
> **O que fazer:**
> 1. Criar `~/git/<repo>/src/path/to/file.ts` com <o que deve conter>
> 2. Editar `~/git/<repo>/src/path/to/other.ts`: adicionar <o que exatamente>
> 3. <Passo concreto adicional se necessário>
>
> **O que NÃO fazer:**
> - Não implementar <feature Y> — fica para E2
> - Não modificar `~/git/<repo>/src/path/to/config.ts` — está fora do escopo deste entregável
>
> **Validação:** rode `<build/test command>` na raiz do repo e confirme que <resultado esperado>.

**Validação:** `<comando>` → <o que deve passar/retornar>

---

### E2 — <título curto e ativo>

**Modelo:** sonnet
**Isolamento:** worktree
**Depende de:** E1
**Arquivos que toca:**
- `~/git/<repo>/src/path/to/file2.ts`

**Prompt completo para o subagente:**

> Você está implementando: <objetivo claro em uma frase>.
>
> **Contexto:**
> - E1 já criou <o que foi feito em E1 — mínimo necessário para entender o ponto de partida>
> - <Decisão de design relevante>
>
> **O que fazer:**
> 1. <Passo concreto com path exato>
> 2. <Passo concreto com path exato>
>
> **O que NÃO fazer:**
> - Não alterar o que E1 criou em <arquivo> — apenas extender
>
> **Validação:** rode `<comando>` e confirme que <resultado esperado>.

**Validação:** `<comando>` → <o que deve passar/retornar>

---

### E3 — <título curto e ativo>

**Modelo:** haiku
**Isolamento:** nenhum
**Depende de:** nenhum
**Arquivos que toca:**
- `~/git/<repo>/README.md`
- `~/git/<repo>/.env.example`

**Prompt completo para o subagente:**

> Você está atualizando a documentação de setup para refletir <o que mudou>.
>
> **O que fazer:**
> 1. Atualizar `~/git/<repo>/README.md` seção "Getting Started": adicionar passo sobre <novo requisito>
> 2. Adicionar em `~/git/<repo>/.env.example`: `<NOVA_VAR>=<exemplo>`
>
> **O que NÃO fazer:**
> - Não reescrever seções existentes — apenas adicionar o que falta
>
> **Validação:** confirme que `grep "<NOVA_VAR>" ~/git/<repo>/.env.example` retorna a linha adicionada.

**Validação:** `grep "<NOVA_VAR>" ~/git/<repo>/.env.example` → linha presente

---

## Grafo de dependências

```
E3 (independente)

E1 ──→ E2 ──→ E4
              │
              ↓
             E5
```

_E3 pode rodar em paralelo com qualquer batch. E1 deve ser concluído antes de E2. E2 e E4 são sequenciais por tocarem os mesmos arquivos._

---

## Sequência de execução

**Batch 1 (paralelo):** E1, E3
**Gate:** revisão humana — confirmar que E1 (walking skeleton) está funcionando antes de continuar
> Verificar: <comportamento observável que indica que E1 está correto>

**Batch 2 (paralelo):** E2, E4
_(sem gate — entregáveis não tocam infraestrutura crítica)_

**Batch 3 (sequencial):** E5 (depende de E2 e E4)

---

## Checklist de infraestrutura

- [ ] Novo Secret: <não / `NOME_DO_SECRET` — configurar em Railway/Vercel/etc antes de rodar E1>
- [ ] CI/CD: <não muda / adicionar step `<nome>` em `.github/workflows/ci.yml`>
- [ ] Novas dependências: <não / `nome-da-lib@1.2.3` — rodar `npm install` antes de E1>
- [ ] Script de setup: <não / `scripts/migrate.sh` — rodar uma vez antes do primeiro deploy>
- [ ] Migração de dados: <não / renomear coluna `X` para `Y` — rollback: reverter rename>

---

## Rollback

Se algo der errado após execução:

```bash
# Reverter worktree de E1
git worktree remove .claude/worktrees/<nome>-e1
git branch -D worktree-<nome>-e1

# Reverter dependência adicionada (se E3 rodou)
npm uninstall <nome-da-lib>
git checkout -- package-lock.json

# Reverter migração (se aplicável)
<comando de rollback da migração>
```

Se os entregáveis foram mergeados para main: criar branch de reverção e abrir PR.
