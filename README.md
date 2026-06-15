# 1C Quotation Assistant

Десктоп-приложение для быстрого выпуска коммерческих предложений по системам умного дома.

Сейчас проект работает в локальном режиме:

- каталог оборудования загружается из `json / xlsx / xls / csv`
- проект загружается из `json / xlsx / xls / csv`
- расчет строит 3 сценария: `Wiren Board`, `KNX`, `Zigbee`
- итоговый документ выгружается в PDF по фирменному шаблону

## Что уже умеет приложение

- хранить локальный каталог оборудования внутри приложения
- подтягивать цены из каталога в состав проекта
- считать черновое КП по трем технологиям
- подставлять менеджера, сроки действия и тип объекта в шаблон
- убирать из итогового PDF пустые тематические страницы
- работать через демо-набор без ручной подготовки файлов

## Запуск

```powershell
npm install
npm run dev:desktop
```

Сборка:

```powershell
npm run build
```

Быстрый запуск уже собранной десктоп-версии:

```powershell
npm run desktop
```

## Как работать

1. Загрузите локальный каталог оборудования.
2. Выберите файл проекта.
3. Укажите папку, куда сохранять готовые КП.
4. Загрузите проект и выберите нужный сценарий.
5. Сформируйте PDF.

Если хотите быстро проверить приложение без своих файлов, нажмите `Открыть демо-проект`.

## Формат файла проекта

Поддерживаются два варианта:

### 1. JSON в формате приложения

```json
[
  {
    "id": "project-1",
    "name": "Дом в Красногорске",
    "clientName": "Иван Иванов",
    "objectType": "Дом",
    "areaM2": 240,
    "rooms": [
      { "id": "living", "name": "Гостиная", "areaM2": 42 }
    ],
    "requirements": [
      {
        "code": "light-groups",
        "complexity": 1.1,
        "estimatedUnitPrice": 9800,
        "name": "Группы освещения",
        "quantity": 18,
        "source1cSku": "LIGHT-18",
        "unitLabel": "гр.",
        "zone": "Освещение"
      }
    ]
  }
]
```

### 2. Таблица Excel / CSV

Поддерживаются колонки:

- `projectName` или `project`
- `projectId`
- `clientName`
- `objectType`
- `areaM2`
- `roomName`
- `roomAreaM2`
- `requirementName`
- `requirementCode`
- `quantity`
- `complexity`
- `source1cSku`
- `unitLabel`
- `zone`

## Формат каталога оборудования

Можно использовать `json / xlsx / xls / csv`.

Желательные колонки:

- `Код` / `code`
- `Артикул` / `sku`
- `Наименование` / `name`
- `Цена` / `price`

Сопоставление идет по:

1. `source1cSku`
2. `requirement.code`
3. `requirement.name`

## Демо-набор

В проект уже встроены:

- [demo/demo-projects.json](C:\Users\KaMeD\OneDrive\Документы\1c_quotation\demo\demo-projects.json)
- [demo/demo-catalog.json](C:\Users\KaMeD\OneDrive\Документы\1c_quotation\demo\demo-catalog.json)

Они покрывают почти все страницы фирменного PDF:

- освещение
- шторы
- отопление
- климат
- безопасность
- мультимедиа
- видеонаблюдение
- домофон / замок
- голосовые ассистенты

## Пробный экспорт PDF

Для локальной проверки можно использовать скрипт:

```powershell
npx electron scripts/generate-demo-pdf.mjs
```

Он создает тестовое КП в папке `demo/generated`.

## Ключевые файлы

- [src/App.tsx](C:\Users\KaMeD\OneDrive\Документы\1c_quotation\src\App.tsx)
- [src/lib/quotation.ts](C:\Users\KaMeD\OneDrive\Документы\1c_quotation\src\lib\quotation.ts)
- [electron/project-import.js](C:\Users\KaMeD\OneDrive\Документы\1c_quotation\electron\project-import.js)
- [electron/save-estimate.js](C:\Users\KaMeD\OneDrive\Документы\1c_quotation\electron\save-estimate.js)

## Что можно улучшать дальше

- более точное постраничное позиционирование текста в PDF
- отдельный редактор профиля менеджера с превью
- импорт из выгрузки 1С в вашем реальном формате
- отдельные шаблоны КП под разные пакеты и бренды
