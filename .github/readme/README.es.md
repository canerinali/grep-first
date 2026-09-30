# grep-first: tu agente de programación busca un método, un flag de CLI o una clave de configuración en el código fuente instalado antes de usarlo, o escribe "Unverified".
**Instalación:** dile a Claude Code o a Codex *"Install the grep-first skill from https://github.com/canerinali/grep-first by following its INSTALL.md"*, o ejecuta `git clone https://github.com/canerinali/grep-first && cp -r grep-first/skills/grep-first ~/.claude/skills/`  
**Uso:** pide a tu agente "haz upsert de un User por email con findOneAndUpsert de mongoose" y, en lugar de inventarse el método, responde `Unverified: Model.findOneAndUpsert ... use findOneAndUpdate(filter, update, { upsert: true })`.

[English](../../README.md) | [Türkçe](README.tr.md) | [简体中文](README.zh-CN.md) | **Español** | [Português (Brasil)](README.pt-BR.md)

> Esto es una traducción. El texto de referencia es el [README en inglés](../../README.md); los resultados de las evaluaciones se publican solo allí.

- **Comprueba antes de escribir.** Cada símbolo externo nuevo se busca en `node_modules`, `site-packages` o `--help`, para la versión que tienes instalada.
- **Muestra la prueba.** Cada "existe" viene con `archivo:línea` y la firma, por ejemplo `models.d.ts:1469 findOneAndUpdate(filter, update, options)`.
- **Dice "Unverified" en lugar de adivinar.** Indica dónde buscó y sugiere la API real más parecida.

## Antes / después

Ejemplo ilustrativo, escrito a mano para este README (no es una salida de las evaluaciones). Mismo prompt: *"Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."*

Sin grep-first:

```js
// Upserts a user by email.
export async function upsertUser(email, data) {
  return User.findOneAndUpsert({ email }, data, { new: true });
}
// findOneAndUpsert finds a matching document and updates it, or inserts it if none exists.
```

Con grep-first:

```text
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts, Model at runtime: undefined)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(filter, update, options)
```

```js
export async function upsertUser(email, data) {
  return User.findOneAndUpdate({ email }, data, { upsert: true, new: true });
}
```

La primera versión falla en tiempo de ejecución con `TypeError: User.findOneAndUpsert is not a function`.

## Características

- Comprueba antes de escribir el código, contra lo que está instalado (`node_modules`, `site-packages`, `--help`), no contra la documentación de otra versión.
- Cada "existe" viene con una línea de evidencia: `archivo:línea` más la firma o la línea de la ayuda.
- Escribe `Unverified: <símbolo>` cuando no encuentra nada, indica dónde buscó y sugiere la API real más parecida.
- Cubre lo que los verificadores de tipos no ven: flags de CLI, claves de configuración y de entorno, JS/Python dinámico y métodos de prototipo de mongoose.
- Lee la versión del lockfile y del `package.json` instalado.
- Solo se aplica a símbolos nuevos y externos, así que el coste extra es pequeño.
- Usa primero `tsc` o el LSP cuando están disponibles.
- Recetas para copiar y pegar para Node, Python, flags de CLI y mongoose. La suite de tests ejecuta todas.
- Incluye un banco de evaluación: 20 casos trampa y 10 casos válidos pero poco conocidos, cada uno comprobado contra paquetes realmente instalados.

Funciona con Claude Code, Codex y cualquier agente que lea SKILL.md o AGENTS.md. Es un solo archivo Markdown con 8 reglas más cuatro archivos cortos de recetas. No hay nada que ejecutar ni dependencias.

## Salida de ejemplo

[`examples/verify-symbol.sh`](../../examples/verify-symbol.sh) ejecuta la receta a mano contra el fixture de evaluación (mongoose 9.10.3). Esta es su salida real:

```text
$ ./examples/verify-symbol.sh
mongoose 9.10.3 (from node_modules/mongoose/package.json)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(...)
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts and Model at runtime: undefined)
Verified: git log --no-merges  (git log --no-merges exited 0 in a scratch repo)
Unverified: git log --since-commit=HEAD  (git said: fatal: unrecognized argument: --since-commit=HEAD)
```

Hay un recorrido más largo en [`examples/before-after.md`](../../examples/before-after.md).

## Instalación

Clona una vez y elige tu agente:

```sh
git clone https://github.com/canerinali/grep-first
cp -r grep-first/skills/grep-first ~/.claude/skills/     # Claude Code
cp -r grep-first/skills/grep-first ~/.codex/skills/      # Codex
cat grep-first/skills/grep-first/SKILL.md >> AGENTS.md   # any AGENTS.md agent, per repo
```

La instalación por proyecto, la actualización y la desinstalación están en [INSTALL.md](../../INSTALL.md). El skill es [`skills/grep-first/SKILL.md`](../../skills/grep-first/SKILL.md) y las recetas están en [`skills/grep-first/references/`](../../skills/grep-first/references/).

## Comparación

| | Qué hace | Cuándo comprueba | Fuente de verdad |
|---|---|---|---|
| **grep-first** | Hace que el agente encuentre cada símbolo externo nuevo y cite `archivo:línea` + firma, o escriba `Unverified` | Antes de escribir el código | Código fuente instalado localmente, `--help`, `man` |
| addyosmani source-driven-development | Skill que basa las decisiones de implementación en la documentación oficial | Durante la planificación y la implementación | Documentación del framework |
| Rune hallucination-guard | Revisa el código en busca de APIs inventadas | Después de escribir el código | El código generado |
| Context7 | Servidor MCP que pone la documentación actual de las librerías en el contexto del agente | Cuando se obtiene la documentación | Documentación publicada |

Se complementan. Por ejemplo, Context7 aporta la documentación y grep-first comprueba después que el símbolo existe en la versión que tienes instalada.

## Evaluaciones

El banco de evaluación (solo para desarrollo, nunca se publica) ejecuta los mismos casos con y sin el skill mediante `claude -p` o `codex exec` en una copia temporal de [`evals/fixture`](../../evals/fixture/package.json). Clasifica cada respuesta como `hallucinated`, `verified-with-evidence`, `used-without-evidence`, `marked-unverified` o `unclear`.

```sh
npm ci && npm ci --prefix evals/fixture
npm run verify                                   # ground truth: every trap probe fails, every valid probe passes
npx tsx evals/run.ts --agent claude --limit 5 --dry-run   # print argv, spawn nothing
npx tsx evals/run.ts --agent claude --model sonnet --timeout 180
npx tsx evals/run.ts --agent codex --without-skill --only mongoose-
```

Los resultados se guardan en `evals/results/<UTC-stamp>-<agent>/{raw.jsonl,report.md}`. El informe muestra estas métricas:
- **hallucination rate**: trampas usadas como si existieran.
- **false-unverified rate**: símbolos válidos marcados por error.
- **evidence rate**: símbolos válidos citados con `archivo:línea`.
- **token delta**: con skill menos sin skill, emparejado por caso.

Los casos están en [`evals/cases.yaml`](../../evals/cases.yaml), con un comentario en cada trampa que explica por qué resulta creíble.

Lo que las evaluaciones no miden (v0.1):
- El evaluador no abre el `archivo:línea` citado. Una evidencia inventada en una trampa sigue contando como `hallucinated`, pero una evidencia inventada en un caso válido no se detecta.
- El ejecutor siempre inyecta el texto del skill, así que mide las reglas, no si el agente descubre el skill por sí mismo.
- Solo `claude -p` y `codex exec`, una ejecución por caso, solo tokens (sin coste). No hay hooks, ni servidor MCP, ni comprobación automática de evidencias.
- Solo Node/TS, la biblioteca estándar de Python y las CLI de `git`/`node`.

### Resultados

Todavía no hay resultados publicados. Las cifras aparecerán solo en el [README en inglés](../../README.md), como copia literal de un `report.md` del ejecutor.

## Guion de demo de 20 segundos

Para grabar un GIF más adelante:
1. (0-4 s) Terminal en `evals/fixture`. Escribe en `claude`: "Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."
2. (4-12 s) El agente ejecuta `grep -n findOneAndUpsert node_modules/mongoose/types/models.d.ts` y `node -e "typeof require('mongoose').Model.findOneAndUpsert"`, y ninguno devuelve nada.
3. (12-20 s) La respuesta empieza con `Unverified: Model.findOneAndUpsert`, cita `models.d.ts:1469 findOneAndUpdate(...)` y usa `{ upsert: true }`.

## Contribuir

Issues y PRs son bienvenidos. Antes de abrir un PR, ejecuta:

```sh
npm ci && npm ci --prefix evals/fixture
npm run lint:skill && npm run links && npm run typecheck && npm run verify && npm test
```

- SKILL.md tiene como máximo 60 líneas y exactamente 8 reglas numeradas. `npm run lint:skill` lo comprueba.
- Un caso de evaluación nuevo debe pasar `npm run verify`: sobre el fixture fijado, la sonda de una trampa debe fallar y la de un caso válido debe pasar. Un caso que no se comporta según su etiqueta se corrige o se sustituye.
- Cada bloque ` ```sh example ` de `references/` debe terminar con código 0 y producir salida dentro de `evals/fixture`.
- No añadas cifras de benchmark al README a mano. `test/readme.test.ts` las rechaza.
- Las traducciones están en [`.github/readme/`](./). El README en inglés es la referencia.

## Licencia

[MIT](../../LICENSE) © 2026 canerinali
