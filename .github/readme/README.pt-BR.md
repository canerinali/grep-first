# grep-first: seu agente de programação procura um método, uma flag de CLI ou uma chave de configuração no código-fonte instalado antes de usá-lo, ou escreve "Unverified".
**Instalação:** diga ao Claude Code ou ao Codex *"Install the grep-first skill from https://github.com/canerinali/grep-first by following its INSTALL.md"*, ou rode `git clone https://github.com/canerinali/grep-first && cp -r grep-first/skills/grep-first ~/.claude/skills/`  
**Uso:** peça ao seu agente "faça upsert de um User por email com o findOneAndUpsert do mongoose" e, em vez de inventar o método, ele responde `Unverified: Model.findOneAndUpsert ... use findOneAndUpdate(filter, update, { upsert: true })`.

[English](../../README.md) | [Türkçe](README.tr.md) | [简体中文](README.zh-CN.md) | [Español](README.es.md) | **Português (Brasil)**

> Esta é uma tradução. O texto de referência é o [README em inglês](../../README.md); os resultados das avaliações são publicados apenas lá.

- **Confere antes de escrever.** Cada novo símbolo externo é procurado em `node_modules`, `site-packages` ou `--help`, na versão que você tem instalada.
- **Mostra a prova.** Todo "existe" vem com `arquivo:linha` e a assinatura, por exemplo `models.d.ts:1469 findOneAndUpdate(filter, update, options)`.
- **Diz "Unverified" em vez de chutar.** Informa onde procurou e sugere a API real mais próxima.

## Antes / depois

Exemplo ilustrativo, escrito à mão para este README (não é uma saída das avaliações). Mesmo prompt: *"Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."*

Sem grep-first:

```js
// Upserts a user by email.
export async function upsertUser(email, data) {
  return User.findOneAndUpsert({ email }, data, { new: true });
}
// findOneAndUpsert finds a matching document and updates it, or inserts it if none exists.
```

Com grep-first:

```text
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts, Model at runtime: undefined)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(filter, update, options)
```

```js
export async function upsertUser(email, data) {
  return User.findOneAndUpdate({ email }, data, { upsert: true, new: true });
}
```

A primeira versão quebra em tempo de execução com `TypeError: User.findOneAndUpsert is not a function`.

## Recursos

- Confere antes de o código ser escrito, contra o que está instalado (`node_modules`, `site-packages`, `--help`), e não contra a documentação de outra versão.
- Todo "existe" vem com uma linha de evidência: `arquivo:linha` mais a assinatura ou a linha da ajuda.
- Escreve `Unverified: <símbolo>` quando não encontra nada, diz onde procurou e sugere a API real mais próxima.
- Cobre o que os verificadores de tipo não pegam: flags de CLI, chaves de configuração e de ambiente, JS/Python dinâmico e métodos de protótipo do mongoose.
- Lê a versão do lockfile e do `package.json` instalado.
- Vale só para símbolos novos e externos, então o custo extra fica pequeno.
- Usa primeiro o `tsc` ou o LSP quando estão disponíveis.
- Receitas prontas para copiar e colar para Node, Python, flags de CLI e mongoose. A suíte de testes roda todas elas.
- Vem com um banco de avaliação: 20 casos armadilha e 10 casos válidos mas pouco conhecidos, cada um conferido contra pacotes realmente instalados.

Funciona com Claude Code, Codex e qualquer agente que leia SKILL.md ou AGENTS.md. É um único arquivo Markdown com 8 regras mais quatro arquivos curtos de receitas. Não há nada para rodar e nenhuma dependência.

## Saída de exemplo

[`examples/verify-symbol.sh`](../../examples/verify-symbol.sh) roda a receita manualmente contra o fixture de avaliação (mongoose 9.10.3). Esta é a saída real:

```text
$ ./examples/verify-symbol.sh
mongoose 9.10.3 (from node_modules/mongoose/package.json)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(...)
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts and Model at runtime: undefined)
Verified: git log --no-merges  (git log --no-merges exited 0 in a scratch repo)
Unverified: git log --since-commit=HEAD  (git said: fatal: unrecognized argument: --since-commit=HEAD)
```

Um passo a passo mais longo está em [`examples/before-after.md`](../../examples/before-after.md).

## Instalação

Clone uma vez e escolha seu agente:

```sh
git clone https://github.com/canerinali/grep-first
cp -r grep-first/skills/grep-first ~/.claude/skills/     # Claude Code
cp -r grep-first/skills/grep-first ~/.codex/skills/      # Codex
cat grep-first/skills/grep-first/SKILL.md >> AGENTS.md   # any AGENTS.md agent, per repo
```

Instalação por projeto, atualização e desinstalação estão em [INSTALL.md](../../INSTALL.md). O skill é [`skills/grep-first/SKILL.md`](../../skills/grep-first/SKILL.md) e as receitas estão em [`skills/grep-first/references/`](../../skills/grep-first/references/).

## Comparação

| | O que faz | Quando confere | Fonte da verdade |
|---|---|---|---|
| **grep-first** | Faz o agente encontrar cada novo símbolo externo e citar `arquivo:linha` + assinatura, ou escrever `Unverified` | Antes de escrever o código | Código-fonte instalado localmente, `--help`, `man` |
| addyosmani source-driven-development | Skill que baseia as decisões de implementação na documentação oficial | Durante o planejamento e a implementação | Documentação do framework |
| Rune hallucination-guard | Verifica o código em busca de APIs inventadas | Depois de o código ser escrito | O código gerado |
| Context7 | Servidor MCP que coloca a documentação atual das bibliotecas no contexto do agente | Quando a documentação é buscada | Documentação publicada |

Eles se complementam. Por exemplo, o Context7 fornece a documentação e o grep-first confere que o símbolo existe na versão que você tem instalada.

## Avaliações

O banco de avaliação (só para desenvolvimento, nunca publicado) roda os mesmos casos com e sem o skill via `claude -p` ou `codex exec` em uma cópia temporária de [`evals/fixture`](../../evals/fixture/package.json). Cada resposta é classificada como `hallucinated`, `verified-with-evidence`, `used-without-evidence`, `marked-unverified` ou `unclear`.

```sh
npm ci && npm ci --prefix evals/fixture
npm run verify                                   # ground truth: every trap probe fails, every valid probe passes
npx tsx evals/run.ts --agent claude --limit 5 --dry-run   # print argv, spawn nothing
npx tsx evals/run.ts --agent claude --model sonnet --timeout 180
npx tsx evals/run.ts --agent codex --without-skill --only mongoose-
```

Os resultados vão para `evals/results/<UTC-stamp>-<agent>/{raw.jsonl,report.md}`. O relatório mostra estas métricas:
- **hallucination rate**: armadilhas usadas como se existissem.
- **false-unverified rate**: símbolos válidos marcados por engano.
- **evidence rate**: símbolos válidos citados com `arquivo:linha`.
- **token delta**: com skill menos sem skill, pareado por caso.

Os casos estão em [`evals/cases.yaml`](../../evals/cases.yaml), com um comentário em cada armadilha explicando por que ela parece plausível.

O que as avaliações não medem (v0.1):
- O avaliador não abre o `arquivo:linha` citado. Evidência inventada em uma armadilha ainda conta como `hallucinated`, mas evidência inventada em um caso válido não é detectada.
- O executor sempre injeta o texto do skill, então mede as regras, e não se o agente descobre o skill sozinho.
- Só `claude -p` e `codex exec`, uma execução por caso, só tokens (sem custo). Não há hooks, servidor MCP nem verificação automática de evidências.
- Só Node/TS, a biblioteca padrão do Python e as CLIs `git`/`node`.

### Resultados

Ainda não há resultados publicados. Os números vão aparecer só no [README em inglês](../../README.md), como cópia literal de um `report.md` do executor.

## Roteiro de demo de 20 segundos

Para gravar um GIF depois:
1. (0-4 s) Terminal em `evals/fixture`. Digite no `claude`: "Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."
2. (4-12 s) O agente roda `grep -n findOneAndUpsert node_modules/mongoose/types/models.d.ts` e `node -e "typeof require('mongoose').Model.findOneAndUpsert"`, e nenhum dos dois retorna nada.
3. (12-20 s) A resposta começa com `Unverified: Model.findOneAndUpsert`, cita `models.d.ts:1469 findOneAndUpdate(...)` e usa `{ upsert: true }`.

## Contribuindo

Issues e PRs são bem-vindos. Antes de abrir um PR, rode:

```sh
npm ci && npm ci --prefix evals/fixture
npm run lint:skill && npm run links && npm run typecheck && npm run verify && npm test
```

- O SKILL.md tem no máximo 60 linhas e exatamente 8 regras numeradas. `npm run lint:skill` garante isso.
- Um novo caso de avaliação precisa passar em `npm run verify`: no fixture fixado, a sonda de uma armadilha deve falhar e a de um caso válido deve passar. Um caso que não se comporta conforme o rótulo é corrigido ou substituído.
- Todo bloco ` ```sh example ` em `references/` deve sair com código 0 e produzir saída dentro de `evals/fixture`.
- Não adicione números de benchmark ao README à mão. `test/readme.test.ts` os rejeita.
- As traduções ficam em [`.github/readme/`](./). O README em inglês é a referência.

## Licença

[MIT](../../LICENSE) © 2026 canerinali
