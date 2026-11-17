# MeetTask Go backend

MeetTask backend endi faqat Go’da yozilgan va ma’lumotlarni Google Firestore’da saqlaydi. Eski Express server olib tashlangan.

## Tarkib

- `backend/cmd/api` — HTTP server kirish nuqtasi
- `backend/internal/httpapi` — endpointlar, validation, CORS va rate limit
- `backend/internal/store` — Firestore repository va workspace izolyatsiyasi
- `backend/internal/auth` — argon2id, 15 daqiqalik JWT va aylantiriladigan refresh cookie
- `backend/internal/analysis` — OpenAI Responses API, ketma-ket chunk, retry va task deduplikatsiyasi
- `backend/internal/soniox` — vaqtinchalik kalit, 200 MB raw upload va provider cleanup
- `firestore.rules` — brauzerdan Firestore’ga to‘g‘ridan-to‘g‘ri kirishni yopadi
- `firestore.indexes.json` — API querylari uchun indekslar

## Lokal ishga tushirish

1. `.env.example` dan `.env` tayyorlang.
2. Firebase service-account JSON faylini loyiha tashqarisida saqlang va `GOOGLE_APPLICATION_CREDENTIALS` orqali ko‘rsating. Emulator ishlatilsa `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` yetarli.
3. Firestore indeks va qoidalarini yuboring:

   ```sh
   firebase deploy --only firestore
   ```

4. Frontend va backendni birga ishga tushiring:

   ```sh
   npm run dev
   ```

Faqat API:

```sh
go run ./backend/cmd/api
```

Testlar:

```sh
go test ./backend/...
```

Eski `localStorage` JSON eksportini mavjud workspace’ga ko‘chirish:

```sh
go run ./backend/cmd/import-localstorage -file export.json -workspace <uuid> -owner <uuid>
```

Avval owner `/api/auth/register` orqali yaratilgan bo‘lishi kerak. Import eski foydalanuvchi, meeting, transcript, task va settings identifikatorlarini yangi UUID’larga xaritalaydi.

## Muhim muhit o‘zgaruvchilari

`GOOGLE_CLOUD_PROJECT`, `JWT_SECRET`, `REFRESH_SECRET`, `SONIOX_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANALYZE_CHUNK_CHARS`, `CORS_ORIGINS`.

Production HTTPS’da `COOKIE_SECURE=true` bo‘lishi shart. Sirlarning hech biri `VITE_` prefiksiga ega bo‘lmasligi kerak.

`ALLOW_LEGACY_API=true` faqat frontend autentifikatsiyaga ko‘chirilayotgan lokal davr uchun: u eski UI’dan keladigan AI/STT so‘rovlarini tokensiz qabul qiladi. Productionda bu qiymat `false` bo‘lishi shart.

## Xavfsizlik modeli

Har bir himoyalangan so‘rov JWT’dagi `workspaceId` bo‘yicha Firestore membership bilan qayta tekshiriladi. Store har bir meeting va task hujjatida `workspaceId` mosligini tekshiradi. Owner/admin/member/guest huquqlari serverda qo‘llanadi; oxirgi owner Firestore transaction orqali himoyalangan.

Firestore qoidalari client o‘qish/yozishini butunlay yopadi. React faqat Go API bilan gaplashadi; service account faqat serverda bo‘ladi.
