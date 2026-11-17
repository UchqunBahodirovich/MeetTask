# Google Cloud'ga deploy qilish

Go backend Cloud Run'da, frontend Firebase Hosting'da ishlaydi. **Ikkalasi bitta domendan** ko'rinadi: Firebase Hosting `/api/**` so'rovlarini Cloud Run'ga uzatadi.

## Nega aynan shunday

Bu shunchaki qulaylik emas — ikkita muammoni hal qiladi:

1. **Refresh cookie ishlaydi.** Backend cookie'ni `SameSite=Strict` bilan qo'yadi. Agar frontend `meettaskai.web.app` da, API esa `xxx.run.app` da bo'lsa, brauzer bu cookie'ni **umuman yubormaydi** — foydalanuvchi har safar sahifani yangilaganda tizimdan chiqib ketardi. Bitta domen bo'lsa muammo yo'q.
2. **CORS kerak emas.** So'rovlar bir xil origin'dan ketadi, ya'ni preflight ham, allowlist ham shart emas.

Shu sababli frontend'da `VITE_API_BASE_URL` ni **bo'sh qoldirish kerak** — nisbiy `/api/...` yo'llari o'zi ishlaydi.

---

## 1. Bir martalik tayyorgarlik

### Loyihani tanlash

> Cloud Shell boshqa loyihada ochilgan bo'lishi mumkin. Firestore va Hosting
> `meettaskai` da, shuning uchun API ham **aynan shu loyihada** bo'lishi shart.

```bash
gcloud config set project meettaskai
```

```bash
gcloud config get-value project     # meettaskai chiqishi kerak
```

### API'larni yoqish

Bittalab, har birining natijasini ko'rib boring:

```bash
gcloud services enable run.googleapis.com
```

```bash
gcloud services enable secretmanager.googleapis.com
```

```bash
gcloud services enable cloudbuild.googleapis.com
```

```bash
gcloud services enable artifactregistry.googleapis.com
```

```bash
gcloud services enable firestore.googleapis.com
```

### Firestore

Baza allaqachon yaratilgan. Qilish kerak bo'lgani — uning regionini bilib olish va qoidalar bilan indekslarni yuklash.

```bash
# Region Cloud Run bilan bir xil bo'lgani yaxshi (kechikish va chiqish trafigi uchun).
# Firestore regioni keyin o'zgartirilmaydi, shuning uchun Cloud Run'ni shunga moslang.
gcloud firestore databases describe --format="value(locationId)"
```

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Indekslar yig'ilishi bir necha daqiqa olishi mumkin:

```bash
gcloud firestore indexes composite list --format="table(name.basename(),state)"
```

> **Qoidalar to'g'ri.** `firestore.rules` hamma narsani taqiqlaydi (`allow read, write: if false`) — bu ataylab shunday: Go API Admin huquqlari bilan ishlaydi va qoidalarni chetlab o'tadi, brauzer esa Firestore'ga to'g'ridan-to'g'ri hech qachon murojaat qilmaydi. Ruxsat nazorati faqat backend'da.

### Sirlar

Buyruqlarni **bittalab** bajaring. Bir blok qilib joylashtirmang: xato chiqsa,
qaysi bosqichda ekanini ko'rmay qolasiz.

```bash
gcloud secrets create SONIOX_API_KEY --replication-policy=automatic
```

```bash
gcloud secrets create OPENAI_API_KEY --replication-policy=automatic
```

```bash
gcloud secrets create JWT_SECRET --replication-policy=automatic
```

```bash
gcloud secrets create REFRESH_SECRET --replication-policy=automatic
```

Har biri `Created secret [NAME].` deb javob berishi kerak. Agar
`PERMISSION_DENIED` yoki `API ... not enabled` chiqsa — yuqoridagi
`gcloud services enable secretmanager.googleapis.com` bajarilmagan.

Endi qiymatlarni yozamiz. **Kalitni buyruq satriga yozmang** — u shell
tarixida (`~/.bash_history`) va ekranda qolib ketadi. Quyidagi usulda kiritilgan
matn ko'rinmaydi va tarixga tushmaydi:

```bash
read -rs SECRET && printf '%s' "$SECRET" | gcloud secrets versions add SONIOX_API_KEY --data-file=- && unset SECRET
```

Enter bosgach kursor kutadi — Soniox kalitini joylashtirib, yana Enter bosing.

```bash
read -rs SECRET && printf '%s' "$SECRET" | gcloud secrets versions add OPENAI_API_KEY --data-file=- && unset SECRET
```

JWT sirlari tasodifiy yaratiladi (kamida 32 belgi bo'lishi shart —
`config.Load()` buni tekshiradi):

```bash
openssl rand -base64 48 | tr -d '\n' | gcloud secrets versions add JWT_SECRET --data-file=-
```

```bash
openssl rand -base64 48 | tr -d '\n' | gcloud secrets versions add REFRESH_SECRET --data-file=-
```

Tekshirish:

```bash
gcloud secrets list --format="table(name.basename())"
```

### Xizmat akkaunti

```bash
gcloud iam service-accounts create meettask-api --display-name="MeetTask API"
```

```bash
gcloud projects add-iam-policy-binding meettaskai \
  --member="serviceAccount:meettask-api@meettaskai.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

Sirlarga kirish huquqi — to'rttasiga alohida:

```bash
gcloud secrets add-iam-policy-binding SONIOX_API_KEY \
  --member="serviceAccount:meettask-api@meettaskai.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

```bash
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:meettask-api@meettaskai.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

```bash
gcloud secrets add-iam-policy-binding JWT_SECRET \
  --member="serviceAccount:meettask-api@meettaskai.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

```bash
gcloud secrets add-iam-policy-binding REFRESH_SECRET \
  --member="serviceAccount:meettask-api@meettaskai.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 2. Backend'ni deploy qilish

Bu bosqich **kodni Cloud Shell'ga olib borishni** talab qiladi — `--source .`
joriy katalogni yuklaydi, shuning uchun repo Cloud Shell ichida bo'lishi kerak.

```bash
git clone https://github.com/UchqunBahodirovich/MeetTask.git
```

```bash
cd MeetTask
```

Repo allaqachon klon qilingan bo'lsa, o'zgarishlarni tortib oling:

```bash
cd ~/MeetTask && git pull
```

Deploydan oldin `go.mod`, `Dockerfile` va `backend/` borligini tekshiring:

```bash
ls go.mod Dockerfile backend
```

> `--region` ni yuqorida aniqlangan Firestore regioni bilan bir xil qiling.

```bash
gcloud run deploy meettask-api \
  --source . \
  --region us-central1 \
  --service-account meettask-api@meettaskai.iam.gserviceaccount.com \
  --set-env-vars GOOGLE_CLOUD_PROJECT=meettaskai,OPENAI_MODEL=gpt-4o-mini,COOKIE_SECURE=true,ANALYZE_CHUNK_CHARS=12000 \
  --set-secrets SONIOX_API_KEY=SONIOX_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,REFRESH_SECRET=REFRESH_SECRET:latest \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 900 \
  --max-instances 10
```

Muhim tanlovlar:

| Sozlama | Nega |
|---|---|
| `--timeout 900` | Uzun transkriptni bo'laklab tahlil qilish bir necha daqiqa olishi mumkin (standart 300 s yetmaydi) |
| `--allow-unauthenticated` | Kirish nazorati ilovaning o'z JWT'si bilan, IAM bilan emas |
| `--memory 512Mi` | 200 MB gacha fayl xom baytlar sifatida o'tadi |
| `CORS_ORIGINS` **berilmaydi** | Bir xil domen — CORS kerak emas |

> `ALLOW_LEGACY_API=true` ni **ishlab chiqarishda yoqmang**. U transkripsiya va tahlil endpointlarini tokensiz ochib qo'yadi — bu sizning Soniox/OpenAI hisobingiz hisobidan begonalar foydalanishi demak.

---

## 3. Frontend'ni deploy qilish

```bash
# VITE_API_BASE_URL bo'sh bo'lsin — /api rewrite orqali ketadi
npm run build
firebase deploy --only hosting
```

`firebase.json` dagi rewrite tartibi muhim: `/api/**` qoidasi SPA'ning `**` qoidasidan **oldin** turishi kerak, aks holda API so'rovlari `index.html` ni oladi.

---

## 4. Tekshirish

```bash
# API tirikmi
curl -s https://meettaskai.web.app/api/health
# {"ok":true,"services":{"transcription":true,"analysis":true}}

# Ro'yxatdan o'tish
curl -s -X POST https://meettaskai.web.app/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Aziz","email":"aziz@meettask.ai","password":"parol12345","workspaceName":"MeetTask"}'
```

Brauzerda: ro'yxatdan o'ting → vazifa yarating → sahifani yangilang. Vazifa joyida qolsa, sessiya va baza ishlayapti.

---

## 5. Lokal ishga tushirish

```bash
# 1-terminal: Firestore emulyatori
firebase emulators:start --only firestore

# 2-terminal: Go API
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export GOOGLE_CLOUD_PROJECT=meettaskai
export JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
export REFRESH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
export COOKIE_SECURE=false          # localhost HTTPS emas
export SONIOX_API_KEY=... OPENAI_API_KEY=...
go run ./backend/cmd/api

# 3-terminal: frontend (vite /api ni :3001 ga proxy qiladi)
npm run dev
```

---

## 6. localStorage'dan ko'chirish

Eski ma'lumot brauzerda qolgan bo'lsa:

```js
// Brauzer konsolida, eski versiyada
copy(JSON.stringify({
  meetings: JSON.parse(localStorage['meettask.meetings'] ?? '[]'),
  tasks:    JSON.parse(localStorage['meettask.tasks'] ?? '[]'),
  team:     JSON.parse(localStorage['meettask.team'] ?? '[]'),
  settings: JSON.parse(localStorage['meettask.settings'] ?? '{}'),
}))
```

Natijani `export.json` ga saqlab:

```bash
go run ./backend/cmd/import-localstorage \
  -file export.json \
  -workspace <WORKSPACE_ID> \
  -owner <OWNER_USER_ID>
```

---

## 7. Xarajat va kuzatuv

- Cloud Run **nolga tushadi** — bo'sh turganda to'lov yo'q.
- Firestore bepul kvotasi kichik jamoa uchun odatda yetarli.
- Asosiy xarajat — OpenAI va Soniox chaqiruvlari. Backend'da soatiga 10 tadan rate limit bor (`rateLimited("analysis", 10, time.Hour, ...)`).

```bash
gcloud run services logs read meettask-api --region us-central1 --limit 50
```
