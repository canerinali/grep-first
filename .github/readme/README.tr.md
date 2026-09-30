# grep-first: kodlama ajanınız bir metodu, CLI flag'ini ya da config anahtarını kullanmadan önce kurulu kaynak kodda arar; bulamazsa "Unverified" yazar.
**Kurulum:** Claude Code'a ya da Codex'e *"Install the grep-first skill from https://github.com/canerinali/grep-first by following its INSTALL.md"* deyin, ya da şunu çalıştırın: `git clone https://github.com/canerinali/grep-first && cp -r grep-first/skills/grep-first ~/.claude/skills/`  
**Kullanım:** ajanınıza "mongoose'un findOneAndUpsert'ü ile bir User'ı e-postasına göre upsert et" deyin; metodu uydurmak yerine `Unverified: Model.findOneAndUpsert ... use findOneAndUpdate(filter, update, { upsert: true })` diye cevap verir.

[English](../../README.md) | **Türkçe** | [简体中文](README.zh-CN.md) | [Español](README.es.md) | [Português (Brasil)](README.pt-BR.md)

> Bu bir çeviridir. Esas metin [İngilizce README](../../README.md)'dir; eval sonuçları yalnızca orada yayımlanır.

- **Yazmadan önce kontrol eder.** Her yeni dış sembol, kurulu olan sürüm için `node_modules`, `site-packages` ya da `--help` içinde aranır.
- **Kanıtını gösterir.** Her "var" iddiasının yanında `dosya:satır` ve imza bulunur, örneğin `models.d.ts:1469 findOneAndUpdate(filter, update, options)`.
- **Tahmin etmek yerine "Unverified" der.** Nerede aradığını söyler ve bulduğu en yakın gerçek API'yi önerir.

## Önce / sonra

Bu README için elle yazılmış açıklayıcı bir örnektir (eval çıktısı değildir). Aynı istem: *"Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."*

grep-first olmadan:

```js
// Upserts a user by email.
export async function upsertUser(email, data) {
  return User.findOneAndUpsert({ email }, data, { new: true });
}
// findOneAndUpsert finds a matching document and updates it, or inserts it if none exists.
```

grep-first ile:

```text
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts, Model at runtime: undefined)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(filter, update, options)
```

```js
export async function upsertUser(email, data) {
  return User.findOneAndUpdate({ email }, data, { upsert: true, new: true });
}
```

İlk sürüm çalışma anında `TypeError: User.findOneAndUpsert is not a function` hatasıyla düşer.

## Özellikler

- Kod yazılmadan önce, başka bir sürümün belgelerine göre değil, kurulu olana (`node_modules`, `site-packages`, `--help`) göre kontrol eder.
- Her "var" iddiası bir kanıt satırıyla gelir: `dosya:satır` ve imza ya da help satırı.
- Hiçbir şey bulamazsa `Unverified: <sembol>` yazar, nerede aradığını söyler ve en yakın gerçek API'yi önerir.
- Tip denetleyicilerin kaçırdıklarını kapsar: CLI flag'leri, config ve env anahtarları, dinamik JS/Python ve mongoose prototip metotları.
- Sürümü lockfile'dan ve kurulu `package.json`'dan okur.
- Yalnızca yeni ve dış semboller için çalışır, böylece ek maliyet küçük kalır.
- Varsa önce `tsc`'yi ya da LSP'yi kullanır.
- Node, Python, CLI flag'leri ve mongoose için kopyala-yapıştır tarifler. Test paketi hepsini çalıştırır.
- Bir eval düzeneğiyle gelir: 20 tuzak vaka ve 10 geçerli ama az bilinen vaka; her biri gerçek kurulu paketlere karşı doğrulanmıştır.

Claude Code, Codex ve SKILL.md ya da AGENTS.md okuyan her ajanla çalışır. 8 kurallı tek bir Markdown dosyası ve dört kısa tarif dosyasından oluşur. Çalıştırılacak bir şey ve bağımlılık yoktur.

## Örnek çıktı

[`examples/verify-symbol.sh`](../../examples/verify-symbol.sh), tarifi eval fixture'ına (mongoose 9.10.3) karşı elle çalıştırır. Gerçek çıktısı şudur:

```text
$ ./examples/verify-symbol.sh
mongoose 9.10.3 (from node_modules/mongoose/package.json)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(...)
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts and Model at runtime: undefined)
Verified: git log --no-merges  (git log --no-merges exited 0 in a scratch repo)
Unverified: git log --since-commit=HEAD  (git said: fatal: unrecognized argument: --since-commit=HEAD)
```

Daha uzun bir anlatım [`examples/before-after.md`](../../examples/before-after.md) dosyasında.

## Kurulum

Bir kez klonlayın, sonra ajanınızı seçin:

```sh
git clone https://github.com/canerinali/grep-first
cp -r grep-first/skills/grep-first ~/.claude/skills/     # Claude Code
cp -r grep-first/skills/grep-first ~/.codex/skills/      # Codex
cat grep-first/skills/grep-first/SKILL.md >> AGENTS.md   # any AGENTS.md agent, per repo
```

Proje bazında kurulum, güncelleme ve kaldırma [INSTALL.md](../../INSTALL.md) dosyasında. Skill dosyası [`skills/grep-first/SKILL.md`](../../skills/grep-first/SKILL.md), tarifler [`skills/grep-first/references/`](../../skills/grep-first/references/) altında.

## Benzerleriyle karşılaştırma

| | Ne yapar | Ne zaman kontrol eder | Doğruluk kaynağı |
|---|---|---|---|
| **grep-first** | Ajanın her yeni dış sembolü bulup `dosya:satır` + imza göstermesini ya da `Unverified` yazmasını sağlar | Kod yazılmadan önce | Yerel kurulu kaynak, `--help`, `man` |
| addyosmani source-driven-development | Uygulama kararlarını resmi belgelere dayandıran skill | Planlama ve uygulama sırasında | Framework belgeleri |
| Rune hallucination-guard | Koddaki uydurma API'leri kontrol eder | Kod yazıldıktan sonra | Üretilen kod |
| Context7 | Güncel kütüphane belgelerini ajanın bağlamına koyan MCP sunucusu | Belgeler çekildiğinde | Yayımlanmış belgeler |

Birbirlerini tamamlarlar. Örneğin Context7 belgeleri sağlar, grep-first de sembolün kurulu sürümde gerçekten var olduğunu kontrol eder.

## Eval'ler

Düzenek (yalnızca geliştirme için, hiçbir yere yayımlanmaz) aynı vakaları skill'li ve skill'siz olarak `claude -p` ya da `codex exec` ile, [`evals/fixture`](../../evals/fixture/package.json)'ın geçici bir kopyasında çalıştırır. Her cevabı `hallucinated`, `verified-with-evidence`, `used-without-evidence`, `marked-unverified` ya da `unclear` olarak puanlar.

```sh
npm ci && npm ci --prefix evals/fixture
npm run verify                                   # ground truth: every trap probe fails, every valid probe passes
npx tsx evals/run.ts --agent claude --limit 5 --dry-run   # print argv, spawn nothing
npx tsx evals/run.ts --agent claude --model sonnet --timeout 180
npx tsx evals/run.ts --agent codex --without-skill --only mongoose-
```

Sonuçlar `evals/results/<UTC-stamp>-<agent>/{raw.jsonl,report.md}` altına yazılır. Rapor şu metrikleri gösterir:
- **hallucination rate**: var olmadığı hâlde varmış gibi kullanılan tuzaklar.
- **false-unverified rate**: yanlışlıkla işaretlenen geçerli semboller.
- **evidence rate**: `dosya:satır` ile gösterilen geçerli semboller.
- **token delta**: skill'li eksi skill'siz, vaka bazında eşleştirilmiş.

Vakalar [`evals/cases.yaml`](../../evals/cases.yaml) dosyasında; her tuzağın neden inandırıcı olduğunu açıklayan bir yorum var.

Eval'lerin ölçmedikleri (v0.1):
- Puanlayıcı gösterilen `dosya:satır`'ı açmaz. Bir tuzakta uydurulmuş kanıt yine `hallucinated` sayılır, ama geçerli bir vakada uydurulmuş kanıt yakalanmaz.
- Koşucu skill metnini her zaman enjekte eder; yani kuralları ölçer, ajanın skill'i kendiliğinden bulup bulmadığını değil.
- Yalnızca `claude -p` ve `codex exec`, vaka başına tek çalıştırma, yalnızca token (maliyet yok). Hook, MCP sunucusu ya da otomatik kanıt kontrolü yok.
- Yalnızca Node/TS, Python standart kütüphanesi ve `git`/`node` CLI'ları.

### Sonuçlar

Henüz yayımlanmış sonuç yok. Sayılar yalnızca [İngilizce README](../../README.md)'de, bir koşucu `report.md` dosyasının birebir kopyası olarak yer alacak.

## 20 saniyelik demo senaryosu

İleride GIF kaydetmek için:
1. (0-4 sn) `evals/fixture` içinde bir terminal. `claude`'a şunu yazın: "Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."
2. (4-12 sn) Ajan `grep -n findOneAndUpsert node_modules/mongoose/types/models.d.ts` ve `node -e "typeof require('mongoose').Model.findOneAndUpsert"` komutlarını çalıştırır; ikisi de boş döner.
3. (12-20 sn) Cevap `Unverified: Model.findOneAndUpsert` ile başlar, `models.d.ts:1469 findOneAndUpdate(...)` satırını gösterir ve `{ upsert: true }` kullanır.

## Katkı

Issue ve PR'lar memnuniyetle karşılanır. PR açmadan önce şunu çalıştırın:

```sh
npm ci && npm ci --prefix evals/fixture
npm run lint:skill && npm run links && npm run typecheck && npm run verify && npm test
```

- SKILL.md en fazla 60 satır ve tam olarak 8 numaralı kural içerir. `npm run lint:skill` bunu denetler.
- Yeni bir eval vakası `npm run verify`'dan geçmelidir: sabitlenmiş fixture üzerinde tuzak probu başarısız, geçerli vaka probu başarılı olmalıdır. Etiketine uymayan vaka düzeltilir ya da değiştirilir.
- `references/` içindeki her ` ```sh example ` bloğu `evals/fixture` içinde çıktı üreterek 0 koduyla çıkmalıdır.
- README'ye elle benchmark sayısı eklemeyin. `test/readme.test.ts` bunları reddeder.
- Çeviriler [`.github/readme/`](./) altında. Esas metin İngilizce README'dir.

## Lisans

[MIT](../../LICENSE) © 2026 canerinali
