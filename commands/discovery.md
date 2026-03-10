---
description: "Processo iterativo de eliminação de riscos que produz um PRD agêntico. Use quando o usuário quiser explorar uma ideia, investigar um problema, planejar uma feature, ou validar uma hipótese."
argument-hint: "slug, ideia, pergunta, ou --finalize"
---

# /discovery

Processo iterativo de eliminação de riscos. Transforma uma ideia em um PRD validado
através de ciclos de investigação (conversa, mockup, spike, pesquisa).

**Input:** $ARGUMENTS — pode ser: slug, ideia, pergunta, ou vazio

---

## Conceitos

**Feature** = unidade mínima de valor entregável. Tem um problema claro, uma solução,
e gera valor pra alguém quando entregue. Pode ser uma tela, uma integração, um fluxo.

**Projeto** = agrupamento de features sob um contexto comum (repo, produto, iniciativa).

**Ciclo** = uma rodada de investigação focada em um risco específico. Cada ciclo:
investiga → descobre → decide → salva em disco → /clear.

---

## Estrutura em disco

```
~/.claude/discoveries/
  <projeto>/                    # nível 1: projeto
    <feature>/                  # nível 2: feature
      draft.md                  # PRD vivo (evolui a cada ciclo)
      prd.md                    # PRD final (quando finalizado)
      cycles/
        01-<tipo>-<desc>.md     # ciclo textual
        02-<tipo>-<desc>/       # ciclo com artefatos (mockup, spike)
          notes.md
          index.html            # (mockup) ou main.py (spike) etc.
```

---

## Passo 0 — Detectar contexto

### CWD awareness

```bash
# Detectar se estamos num repo
REPO_NAME=""
if git rev-parse --is-inside-work-tree 2>/dev/null; then
  # Tentar ler alias de project.md, fallback para nome do repo
  REPO_NAME=$(grep "^alias:" .claude/project.md 2>/dev/null | sed 's/^alias: //' | head -1)
  [ -z "$REPO_NAME" ] && REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
fi
```

**Se dentro de um repo** → contexto é projeto existente. Discovery cria features dentro dele.
- Path: `~/.claude/discoveries/$REPO_NAME/<feature>/`
- Ler `.claude/project.md` e `CLAUDE.md` para contexto do projeto

**Se fora de um repo** (ex: `~/git/`) → contexto é projeto novo.
- Path: `~/.claude/discoveries/<projeto>/`
- Sem project.md para ler — tudo será descoberto no processo
- Se PRD concluir que é projeto novo: referenciar `~/.claude/guides/project-setup.md`

### Parsear $ARGUMENTS

- Se contém `/` → interpretar como `<projeto>/<feature>` (path explícito)
- Se é slug simples → usar como nome da feature (dentro do projeto detectado) ou nome do projeto (se fora de repo)
- Se `--finalize` → pular direto pra finalização do PRD
- Se vazio → perguntar o que o usuário quer explorar

### Retomar ou criar

Verificar se já existe discovery no path detectado:

- **Se `draft.md` existe** → retomar. Ler draft.md e listar ciclos existentes.
  Exibir: "Retomando discovery de `<nome>`. N ciclos realizados. Último: `<tipo>-<desc>`."
  Perguntar: "Qual risco quer investigar agora?"

- **Se `prd.md` existe** → discovery já finalizado.
  Exibir: "Discovery de `<nome>` já finalizado. PRD em `<path>`."
  Perguntar: "Quer reabrir o discovery ou seguir pra `/planning`?"

- **Se nada existe** → novo discovery. Criar diretório e começar pelo framing.

### Calibração de profundidade

Avaliar antes de começar o framing:

| Contexto | Profundidade do framing |
|---|---|
| Projeto novo, ideia vaga, sem dados | Framing profundo (extração socrática, múltiplas rodadas) |
| Projeto existente, feature clara, dados disponíveis | Framing leve (1 rodada: sintetizar + validar) |
| Projeto existente, feature trivial | Considerar pular discovery — sugerir ir direto pro código |

O default é framing leve quando dentro de um repo existente. Framing profundo é a exceção, não a regra.

---

## Passo 1 — Framing (primeiro ciclo, sempre)

> **Regra de ouro:** Antes de fazer qualquer pergunta, declare em uma frase o que você
> está tentando decidir com a resposta. Nunca pergunte no automático.

### 1.0 — Triagem de sinal

Antes de perguntar qualquer coisa, avaliar o que já se sabe:

- **O usuário trouxe dados objetivos?** (números, scans, inventários, exemplos concretos)
- **O problema é auto-evidente?** (ex: 1035 markdowns espalhados = bagunça óbvia)
- **Estamos num repo existente com contexto legível?** (project.md, CLAUDE.md, código)

Com base nisso, escolher o modo de conversa:

| Sinal disponível | Modo | Comportamento |
|---|---|---|
| Vago ("tenho uma ideia", "algo me incomoda") | **Extração** | Socrático — perguntar exemplos concretos, uma pergunta por vez |
| Hipótese formada ("quero construir X") | **Validação** | Propor interpretação do problema e pedir confirmação |
| Dados concretos (scans, números, inventário) | **Síntese** | Apresentar análise do que os dados mostram, perguntar o que falta |

**Não usar extração quando síntese ou validação são possíveis.** Pedir exemplos quando
já se tem dados é desperdiçar o tempo do usuário.

### 1.1 — Extração de sinal (modo: extração)

Usar apenas quando o input é genuinamente vago e não há dados para analisar.

- "Quero entender se a dor é de X ou Y, porque isso muda a solução — me dá um exemplo?"
- "Não sei se isso é problema de [A] ou [B] — o que você queria que existisse?"

Sempre prefixar com o que você está tentando descobrir.

### 1.1b — Proposta direta (modo: validação ou síntese)

Usar quando já tem informação suficiente para formular hipótese.

- Apresentar o que os dados/contexto mostram
- Propor formulação do problema
- Perguntar: "Isso captura? O que falta?"

### 1.2 — Identificação de tensões

Quando o problema ainda não está cristalizado (qualquer modo):

**Inversão:** "O que definitivamente NÃO seria uma boa solução?"
**Separação de níveis:** "O incômodo na superfície é X... mas o que está por baixo?"
**Teste de transferência:** "Se você não existisse, outra pessoa teria esse problema?"

Usar apenas as técnicas que agregam — não aplicar todas mecanicamente.

### 1.3 — Primeira síntese

Propor formulação do problema:
- "Parece que o problema central é... Chega perto?"
- Iterar até o usuário reconhecer ("é isso", "exatamente")
- Se veio do modo síntese, essa etapa pode já ter acontecido em 1.1b.

### 1.4 — Identificar riscos

Com o problema definido, identificar riscos que precisam ser validados antes de construir:

| Tipo de risco | Quando é relevante | Validação barata |
|---|---|---|
| Usabilidade/UX | Tem interface pro usuário | Mockup HTML |
| Técnico | Integração, API, performance | Spike (código descartável) |
| Negócio/mercado | Produto novo, monetização | Pesquisa web + análise |
| Distribuição | Como chega no usuário | Análise de canais |
| Integração | Depende de serviço externo | Teste de API, spike |

Apresentar riscos identificados e propor ordem de investigação.
Se tiver dúvida sobre relevância de um risco: perguntar ao usuário.

### 1.5 — Salvar ciclo de framing

Criar `cycles/01-framing-<desc>.md`:

```markdown
# Ciclo: Framing — <desc>

## Risco investigado
Definição do espaço do problema.

## Método
Conversa socrática com o usuário.

## Descobertas
<o que aprendemos — na linguagem do usuário>

## Decisão
Problema definido como: <formulação cristalizada>

## Riscos identificados para investigação
1. <risco> — tipo: <tipo> — método proposto: <método>
2. <risco> — tipo: <tipo> — método proposto: <método>

## Artefatos
Nenhum (conversa pura).
```

### 1.6 — Criar draft.md inicial

Criar `draft.md` usando o template em `prd-template.md`:

- Preencher **Problema** com a formulação cristalizada
- Preencher **Riscos validados** como tabela vazia (serão preenchidos nos próximos ciclos)
- Deixar **Solução** e **Não-escopo** em branco ou com hipóteses iniciais
- Status: `draft`

Exibir:

```text
Ciclo 01-framing salvo. Draft do PRD criado.

Riscos identificados:
1. <risco> → próximo ciclo sugerido: <tipo>-<desc>
2. <risco> → ...

Recomendo /clear e depois `/discovery <slug>` pra continuar.
O draft.md preserva todo o contexto.
```

---

## Passo 2 — Ciclos de validação (iterativo)

Cada vez que o usuário volta com `/discovery <slug>`, o skill:

1. Lê `draft.md` (estado atual do pensamento)
2. Lista ciclos já realizados
3. Identifica próximo risco a investigar
4. Propõe o ciclo ou pergunta ao usuário qual risco quer atacar

### Tipos de ciclo

#### research — Pesquisa web/competitiva

Quando usar: risco de negócio, mercado, distribuição, ou precisa entender o espaço.

Processo:
1. Lançar 2-3 subagentes paralelos (model: sonnet) com WebSearch:
   - **Agente A:** estado da arte, produtos similares, o que foi tentado
   - **Agente B:** campos adjacentes, analogias de outros domínios
   - **Agente C:** (se relevante) análise de distribuição/canais
2. Sintetizar resultados
3. Apresentar ao usuário, discutir implicações
4. Atualizar draft.md (seções Solução, Riscos validados)
5. Salvar ciclo em `cycles/NN-research-<desc>.md`

#### mockup — Protótipo visual

Quando usar: risco de usabilidade/UX, ou para alinhar visão ("o que eu disse pode ser diferente do que tenho na cabeça").

Processo:
1. Discutir com o usuário o que o mockup deve mostrar
2. Gerar HTML estático + Tailwind CSS + dados hardcoded
   - Sem framework, sem build step, sem servidor
   - Foco em fidelidade visual, não funcionalidade
   - Um arquivo `index.html` que abre direto no browser
3. Salvar em `cycles/NN-mockup-<desc>/index.html`
4. Instruir o usuário a abrir no browser: `open cycles/NN-mockup-<desc>/index.html`
5. Coletar feedback: "O que funciona? O que não funciona? O que falta?"
6. **Iterar** — modificar o mockup baseado no feedback, quantas vezes forem necessárias
7. Quando o usuário aprovar: atualizar draft.md e salvar `cycles/NN-mockup-<desc>/notes.md`

Regras do mockup:
- HTML + Tailwind CDN — nada mais
- Dados fake mas realistas
- Código descartável — não será reaproveitado no delivery
- Múltiplas telas? Criar `page1.html`, `page2.html` etc.
- Incluir no index.html links de navegação entre telas se houver

#### spike — Prova de conceito técnica

Quando usar: risco técnico, integração com API, viabilidade de performance.

Processo:
1. Definir com o usuário: "O que exatamente precisa ser provado?"
2. Escrever código mínimo que responda a pergunta
   - Linguagem/stack mais rápida pra testar (não necessariamente a do projeto)
   - Código descartável — foco em responder a pergunta, não em qualidade
3. Executar e coletar resultado
4. Salvar em `cycles/NN-spike-<desc>/` (código + notes.md com conclusão)
5. Atualizar draft.md (Riscos validados)

#### interview — Input externo

Quando usar: precisa de perspectiva de stakeholder, usuário, ou domínio expertise.

Processo:
1. Definir com o usuário: quem consultar, que perguntas fazer
2. Preparar roteiro de perguntas (3-5 perguntas focadas)
3. O usuário conduz a entrevista externamente
4. Usuário volta com respostas/insights
5. Sintetizar e atualizar draft.md
6. Salvar ciclo em `cycles/NN-interview-<desc>.md`

#### analysis — Análise estruturada

Quando usar: risco de negócio complexo, trade-off que precisa ser modelado.

Processo:
1. Definir o framework de análise (ex: prós/contras, impact/effort, build vs buy)
2. Executar análise com o usuário (conversa estruturada)
3. Documentar decisão
4. Atualizar draft.md
5. Salvar ciclo em `cycles/NN-analysis-<desc>.md`

### Formato padrão de ciclo

```markdown
# Ciclo: <nome descritivo>

## Risco investigado
<qual risco, por que importa>

## Método
<como foi validado — conversa, mockup, spike, pesquisa>

## Descobertas
<o que aprendemos>

## Decisão
<o que ficou decidido>

## Artefatos
<paths pra mockups, spikes, etc. — ou "nenhum">
```

### Atualização do draft.md

Após cada ciclo, atualizar o draft.md:
- **Problema**: refinar se o ciclo revelou algo novo
- **Solução**: adicionar/modificar se o ciclo informou a solução
- **Não-escopo**: adicionar itens que ficaram explicitamente fora
- **Riscos validados**: adicionar linha na tabela com o risco investigado
- **Riscos aceitos**: mover riscos que o usuário decidiu aceitar
- **Ciclos realizados**: adicionar entrada na tabela

### Fim de cada ciclo

```text
Ciclo NN-<tipo>-<desc> salvo. Draft atualizado.

Estado atual:
- Riscos validados: N/M
- Riscos pendentes: <lista>
- Próximo ciclo sugerido: <tipo>-<desc>

Opções:
1. /clear e `/discovery <slug>` — continuar com próximo ciclo
2. /clear e `/discovery <slug> --finalize` — PRD está pronto, finalizar
3. Continuar na mesma sessão (se contexto ainda está limpo)
```

---

## Passo 3 — Finalização

Acionado quando:
- O usuário pede `--finalize`
- Todos os riscos relevantes foram endereçados
- O agente propõe finalizar e o usuário concorda

### 3.1 — Revisar draft.md

Ler o draft completo e verificar:
- [ ] Problema está claro e cristalizado?
- [ ] Solução está definida com critérios de sucesso?
- [ ] Não-escopo está explícito?
- [ ] Riscos relevantes foram validados?
- [ ] Riscos aceitos estão documentados com justificativa?

Se algum item está fraco: sinalizar e perguntar se quer fazer mais um ciclo.

### 3.2 — Polish final

Fazer uma passada no draft para:
- Consolidar linguagem (remover referências a "achamos que", "parece que")
- Garantir que cada seção é auto-contida (agente do /planning vai ler sem contexto)
- Verificar que Não-escopo é específico o suficiente pro agente não inventar

### 3.3 — Gerar prd.md

Copiar draft.md para prd.md com:
- Status: `final`
- Data de finalização

### 3.4 — Verificar se é projeto novo

Se o PRD indica criação de um novo repo/projeto:
- Verificar se `~/.claude/guides/project-setup.md` existe
- Sinalizar ao usuário: "Este PRD é pra um projeto novo. O /planning vai incluir setup do repo como primeiro entregável."

### 3.5 — Encerrar

```text
PRD finalizado! Salvo em: <path>/prd.md

Resumo:
- Problema: <uma frase>
- Solução: <uma frase>
- Riscos validados: N (tipos: <lista>)
- Riscos aceitos: M
- Ciclos realizados: K

Próximo passo: `/planning <slug>`
Recomendo /clear antes de continuar.
```

---

## Regras gerais

- **Uma pergunta por vez.** Nunca empilhar perguntas.
- **Justifique antes de perguntar.** Declare o que está tentando decidir antes de fazer qualquer pergunta.
- **Calibre a profundidade.** Se tem dados, sintetize. Se tem hipótese, valide. Só extraia quando realmente falta sinal.
- **Se tiver dúvida, perguntar.** Especialmente sobre relevância de riscos.
- **Draft.md é o cérebro persistente.** Sempre atualizar após cada ciclo.
- **Ciclos são registro/auditoria.** O draft é o que importa entre sessões.
- **Mockups são descartáveis.** HTML + Tailwind, sem reaproveitamento.
- **Spikes são descartáveis.** Código mínimo pra responder uma pergunta.
- **Subagentes usam model: sonnet** para pesquisa. Nunca opus em subagente.
- **Pular mockup se não tem interface.** Ex: API pura, CLI, integração backend.
- **Pular riscos óbvios.** Se é feature pequena em projeto existente, talvez 1 ciclo de framing baste.
- **Não forçar ciclos.** Se após framing está tudo claro, propor finalizar.

---

## Flags

| Flag | Comportamento |
|---|---|
| (nenhuma) | Novo discovery ou retomar existente |
| `--finalize` | Pular pra finalização (Passo 3) |

---

## Quando NÃO usar

- Bug/fix → use `/debug` ou `/fix`
- Código já escrito, só precisa fazer PR → use `/review`
- Plano já existe, só executar → use `/delivery`
- Tarefa trivial e clara → vá direto pro código
