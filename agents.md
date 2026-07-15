# AGENTS

## Контекст проєкту

Цей репозиторій — frontend і data/storytelling layer для аналітики YouTube-коментарів каналу `@imatrof`.

Ecosystem-wide context (other repos, automation patterns) lives in the owner's private `imatrof-docs` repo; this file covers only this repository.

`@imatrof` — україномовний тех-креатор про:

- ШІ та AI-агентів
- автоматизацію і practical AI for work
- Claude Code, OpenAI Codex, OpenClaw та суміжні інструменти
- локальний запуск, інфраструктуру, VPS, Hostinger
- прикладне використання ШІ в реальній роботі

## Що тут є

- ingestion через YouTube Data API
- локальне нормалізоване сховище коментарів і відео
- аналітичний payload для сайту
- публічний frontend для `imatrof.tech`

## Canonical frontend surface

Якщо треба змінювати live сайт, canonical production files у цьому репозиторії такі:

- `index.html`
- `styles.css`
- `app.js`
- `site-data.json`

Правила:

- саме ці root-level файли є основною поверхнею для змін;
- `dist/` — лише build output;
- перед висновками про структуру сайту звіряти реальний local preview.

## Data pipeline

Базовий локальний контур такий:

1. ingestion через YouTube Data API підтягує відео, top-level comments і replies;
2. сирі й нормалізовані дані зберігаються локально в ignored data/output шарах;
3. аналітичний шар формує `site-data.json` для публічного frontend.

## Локальна автоматизація

- Codex має мати змогу локально запускати automation для оновлення даних і payload;
- після локальної перевірки Codex може комітити й пушити зміни в git, щоб Hostinger підтягнув оновлення на `imatrof.tech`;
- live surface лишається root-level frontend, але локальний ignored Python-шар для refresh-пайплайна вважається допустимим і робочим.

## Deployment path

Live deployment path треба трактувати так:

1. локальні зміни проходять перевірку;
2. production bundle збирається через `npm run build`;
3. source of truth для deploy — GitHub repository `imatrof-youtube-analytics`;
4. Hostinger підтягує зміни з GitHub;
5. live сайт автоматично оновлюється на `imatrof.tech`.

## README vs AGENTS

- `README.md` має бути коротким описом для людей;
- `agents.md` є canonical operating context для агентів;
- agent-facing пояснення про pipeline, canonical files, deploy і робочі правила тримати саме тут.

## Робочі правила

- Secrets only in `.env`.
- Ніколи не комітити `.env`.
- Якщо користувач просить оновити live сайт, після локальної перевірки треба підготувати commit і push у GitHub.
- Якщо користувач просить дані за конкретний період, локальні файли трактувати як cache, а не як безумовне джерело істини.
- Якщо локальне покриття періоду неповне, спершу робити live fetch через YouTube API, а вже потім відповідати.
