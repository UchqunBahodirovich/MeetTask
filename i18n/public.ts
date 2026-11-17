import type { Language } from '../types';

export interface PublicCopy {
  language: string;
  themeLight: string;
  themeDark: string;
  home: string;
  authGoogleError: string;
  authLoginError: string;
  authInvalidCredentials: string;
  authRegistrationError: string;
  navAria: string;
  menuOpen: string;
  menuClose: string;
  nav: [string, string, string];
  enter: string;
  panel: string;
  heroEyebrow: string;
  hero: [string, string];
  heroText: string;
  start: string;
  watchDemo: string;
  heroNote: string;
  live: string;
  ideaToTask: string;
  nextStep: string;
  motionStop: string;
  motionStart: string;
  capabilitiesLabel: string;
  capabilities: [string, string, string, string];
  visionLabel: string;
  visionTitle: [string, string];
  visionText: string;
  modelLabel: string;
  modelTitle: [string, string];
  modelText: string;
  resultLabel: string;
  resultTitle: [string, string];
  resultText: string;
  layers: Array<{ title: string; text: string }>;
  integrationsMore: string;
  graphAria: string;
  graphCount: string;
  owners: string[];
  toTop: string;
  demoEyebrow: string;
  demoTitle: [string, string];
  demoText: string;
  demoMeeting: string;
  interactive: string;
  conversation: string;
  pause: string;
  replay: string;
  play: string;
  restart: string;
  demoMode: string;
  tasks: string;
  moments: string;
  taskCaption: string;
  momentCaption: string;
  sampleNote: string;
  sample: Array<{ speaker: string; text: string; task: string | null; owner: string; detail: string; moment: string }>;
  featuresEyebrow: string;
  featuresTitle: [string, string];
  featuresText: string;
  features: Array<{ title: string; text: string }>;
  pricingEyebrow: string;
  pricingTitle: [string, string];
  pricingText: string;
  plans: Array<{ name: string; tag: string; features: string[]; featured: boolean }>;
  teamBadge: string;
  price: string;
  pricePending: string;
  viewPlan: string;
  faqEyebrow: string;
  faqTitle: string;
  faq: Array<[string, string]>;
  finalEyebrow: string;
  finalTitle: [string, string];
  goToMeetTask: string;
  footer: string;
  planSuffix: string;
  planText: string;
  close: string;
  continue: string;
}

const uz: PublicCopy = {
  language: 'Til', themeLight: 'Yorug‘ rejim', themeDark: 'Tungi rejim', home: 'MeetTask bosh sahifasi',
  authGoogleError: 'Google orqali kirib bo‘lmadi.', authLoginError: 'Kirish amalga oshmadi.', authInvalidCredentials: 'Email yoki parol noto‘g‘ri.', authRegistrationError: 'Hisob yaratib bo‘lmadi. Ma’lumotlarni tekshirib, qayta urinib ko‘ring.',
  navAria: 'Asosiy navigatsiya', menuOpen: 'Menyuni ochish', menuClose: 'Menyuni yopish', nav: ['Imkoniyatlar', 'Demo', 'Tariflar'], enter: 'Kirish', panel: 'Panelga o‘tish',
  heroEyebrow: 'SUHBATINGIZNING DAVOMI BOR', hero: ['Yaxshi fikrlar.', 'Aniq harakatlar.'],
  heroText: 'Yig‘ilishda suhbatga e’tibor bering. MeetTask AI muhim fikrlarni eslab qoladi, vazifalarni esa tartibga soladi.',
  start: 'MeetTask’ni boshlash', watchDemo: 'Demoni ko‘rish', heroNote: 'O‘zbekcha suhbatlar. Ikki xil analiz rejimi.',
  live: 'Suhbat davom etmoqda', ideaToTask: 'Fikrdan vazifaga', nextStep: 'Keyingi qadam aniq.',
  motionStop: 'Animatsiyani to‘xtatish', motionStart: 'Animatsiyani yoqish', capabilitiesLabel: 'HAR BIR SUHBAT UCHUN',
  capabilities: ['Jonli transkripsiya', 'Muhim momentlar', 'Aniq vazifalar', 'Bir joydagi natijalar'],
  visionLabel: 'G‘OYA', visionTitle: ['Yig‘ilish natija', 'bilan tugashi kerak.'],
  visionText: 'Odamlar muhokama qiladi, qaror qabul qiladi va tasdiqlaydi. Kim nimani qachongacha va’da qilgani esa kimningdir yozuvlariga bog‘liq bo‘lmasligi kerak.',
  modelLabel: 'QANDAY ISHLAYDI', modelTitle: ['Suhbat va ish', 'orasidagi qatlam.'],
  modelText: 'MeetTask suhbatni tinglaydi, qarorlarni topshiriqlardan ajratadi va har bir topshiriqni bajaruvchi va muddati bor vazifaga aylantiradi.',
  resultLabel: 'INTEGRATSIYALAR', resultTitle: ['Ishlayotgan joyingizga', 'ulanadi.'],
  resultText: 'Meet, Zoom, Telegram va vazifa trekerlari bilan integratsiyalar rejalashtirilgan. Natijalar jamoangiz ishlatadigan vositalarga tushadi.',
  layers: [
    { title: 'Jamoangiz', text: 'Ustuvorliklarni belgilaydi, qaror qiladi va tasdiqlaydi.' },
    { title: 'MeetTask AI', text: 'Matnga aylantiradi, muhim momentlarni topadi, vazifalarni tayyorlaydi.' },
    { title: 'Yig‘ilish xotirasi', text: 'Har bir qaror, bajaruvchi va muddat bir joyda.' },
    { title: 'Yig‘ilishlar', text: 'Jonli qo‘ng‘iroqlar, yozuvlar va ularda aytilgan har bir so‘z.' },
  ],
  integrationsMore: 'Tez orada yana',
  graphAria: 'Nuqtalar yig‘ilishda aytilgan so‘zlar. MeetTask ular orasidan vazifalarni topib, rangli halqa bilan belgilaydi va har birini ijrochisiga ulaydi.',
  graphCount: 'vazifa', owners: ['Aziz Karimov', 'Malika Tosheva', 'Nodira Rahimova'],
  toTop: 'Sahifa boshiga qaytish',
  demoEyebrow: '01 / AMALDA KO‘RING', demoTitle: ['Bitta suhbat.', 'Ikki xil nigoh.'],
  demoText: 'Vazifalarni ajrating yoki suhbatning eng muhim joylarini saqlang. Quyidagi interaktiv namunani sinab ko‘ring.',
  demoMeeting: 'Bozor 3D · Reliz yig‘ilishi', interactive: 'INTERAKTIV NAMUNA', conversation: 'SUHBAT',
  pause: 'Pauza', replay: 'Qayta ijro', play: 'Demoni ijro etish', restart: 'Demoni boshidan boshlash', demoMode: 'Demo rejimi',
  tasks: 'Vazifalar', moments: 'Muhim momentlar', taskCaption: 'Bajaruvchi va muddati bilan tartiblangan.',
  momentCaption: 'Muhim fikrlar saqlanadi. Task kartasi yaratilmaydi.',
  sampleNote: 'Demo oldindan tayyorlangan namunadan foydalanadi. Haqiqiy analiz yig‘ilish mazmuniga bog‘liq.',
  sample: [
    { speaker: 'Nodira', text: 'Aziz, to‘lov tizimini dushanbagacha API ga ulang.', task: 'To‘lov tizimini API ga ulash', owner: 'Aziz Karimov', detail: 'Dushanbagacha', moment: 'To‘lov tizimi reliz uchun muhim topshiriq.' },
    { speaker: 'Malika', text: '3D modellar byudjeti o‘ttiz foizga oshdi.', task: null, owner: '', detail: '', moment: 'Muhim holat: 3D modellar byudjeti 30% oshdi.' },
    { speaker: 'Nodira', text: 'Malika, ertaga narxlar ro‘yxatini tayyorlang.', task: 'Narxlar ro‘yxatini tayyorlash', owner: 'Malika Tosheva', detail: 'Ertaga', moment: 'Topshiriq: Malika ertaga narxlar ro‘yxatini tayyorlaydi.' },
    { speaker: 'Nodira', text: 'Reliz sanasini 15-oktabrga belgilaymiz.', task: null, owner: '', detail: '', moment: 'Qaror: reliz sanasi 15-oktabr.' },
  ],
  featuresEyebrow: '02 / SUHBATDAN NATIJAGACHA', featuresTitle: ['Kamroq yozuv.', 'Ko‘proq e’tibor.'],
  featuresText: 'Gaplashish, anglash va bajarish orasidagi masofani qisqartiring.',
  features: [
    { title: 'Gapiring. Fikrni yo‘qotmang.', text: 'Jonli yig‘ilishni yozib oling yoki tayyor audio faylni yuklang. Suhbat matni bir joyda saqlanadi.' },
    { title: 'Muhimini ajratib oling.', text: 'Qarorlar, ochiq savollar va muhim topshiriqlar. Uzoq suhbatdan qayta foydalanish oson bo‘ladi.' },
    { title: 'Keyingi qadamni belgilang.', text: 'Bajaruvchi va muddat bilan vazifalar. Egasi noaniq bo‘lsa, o‘zingiz aniqlashtirib berasiz.' },
  ],
  pricingEyebrow: '03 / SIZGA MOS REJA', pricingTitle: ['Yakka fikrdan.', 'Jamoaviy natijagacha.'],
  pricingText: 'Quyidagi rejalar taklif sifatida ko‘rsatilgan. Narxlar va foydalanish limitlari hali tasdiqlanmagan.',
  plans: [
    { name: 'Shaxsiy', tag: 'O‘z ishini tartibga soluvchilar uchun', features: ['Suhbat transkripsiyasi', 'Muhim momentlar', 'Shaxsiy vazifalar'], featured: false },
    { name: 'Jamoa', tag: 'Birgalikda ishlaydigan jamoalar uchun', features: ['Shaxsiy reja imkoniyatlari', 'Bir nechta bajaruvchi', 'Lavozim bo‘yicha biriktirish', 'Umumiy yig‘ilish natijalari'], featured: true },
    { name: 'Biznes', tag: 'Kengroq ehtiyojlar uchun', features: ['Jamoa reja imkoniyatlari', 'Talab va limitlarni kelishish', 'Joriy etish rejasini muhokama qilish'], featured: false },
  ],
  teamBadge: 'JAMOA UCHUN', price: 'Kelishiladi', pricePending: 'Narx tasdiqlanmoqda', viewPlan: 'Rejani ko‘rish',
  faqEyebrow: 'YANA SAVOLLAR BORMI?', faqTitle: 'Bilish foydali.',
  faq: [
    ['O‘zbek tilidagi suhbatlar bilan ishlaydimi?', 'Ha. MeetTask o‘zbekcha suhbatlarni matnga aylantirish va tahlil qilish uchun mo‘ljallangan. Natija audio sifati va suhbat aniqligiga bog‘liq.'],
    ['Muhim momentlar va vazifalar nimasi bilan farq qiladi?', 'Muhim momentlar rejimi fikrlar, qarorlar va muhim topshiriqlarni matn sifatida saqlaydi. Vazifalar rejimi esa bajaruvchi va muddati bor task kartalarini ajratadi.'],
    ['Bajaruvchi aniq aytilmagan bo‘lsa-chi?', 'Biriktirilmagan AI vazifalari alohida belgilanadi. Analizdan keyin kerakli odamni yoki bir nechta bajaruvchini o‘zingiz tanlashingiz mumkin.'],
    ['Bu yerdan tarif sotib olsa bo‘ladimi?', 'Hozircha bu sahifada to‘lov olinmaydi. Tariflar taklif ko‘rinishida; tasdiqlangan narxlar va limitlar keyin qo‘shiladi.'],
  ],
  finalEyebrow: 'NAVBATDAGI YIG‘ILISHINGIZ UCHUN', finalTitle: ['Suhbat tugaydi.', 'Harakat boshlanadi.'],
  goToMeetTask: 'MeetTask’ga o‘tish', footer: 'Fikrlar unutilmasin.', planSuffix: 'rejasi',
  planText: 'Bu reja hozircha taklif bosqichida. Narx va limitlar tasdiqlanmagan, to‘lov olinmaydi. Hisobingizga kirib mavjud imkoniyatlarni ko‘rishingiz mumkin.',
  close: 'Yopish', continue: 'Davom etish',
};

const en: PublicCopy = {
  language: 'Language', themeLight: 'Light mode', themeDark: 'Dark mode', home: 'MeetTask home',
  authGoogleError: 'Could not sign in with Google.', authLoginError: 'Sign-in failed.', authInvalidCredentials: 'The email or password is incorrect.', authRegistrationError: 'Could not create the account. Check your details and try again.',
  navAria: 'Main navigation', menuOpen: 'Open menu', menuClose: 'Close menu', nav: ['Features', 'Demo', 'Pricing'], enter: 'Log in', panel: 'Open dashboard',
  heroEyebrow: 'YOUR CONVERSATION CONTINUES', hero: ['Good ideas.', 'Clear action.'],
  heroText: 'Stay focused on the conversation. MeetTask AI remembers the important ideas and organizes the work that follows.',
  start: 'Start with MeetTask', watchDemo: 'Watch the demo', heroNote: 'Uzbek conversations. Two analysis modes.',
  live: 'Conversation in progress', ideaToTask: 'From idea to task', nextStep: 'The next step is clear.',
  motionStop: 'Pause animation', motionStart: 'Play animation', capabilitiesLabel: 'FOR EVERY CONVERSATION',
  capabilities: ['Live transcription', 'Key moments', 'Clear tasks', 'Results in one place'],
  visionLabel: 'THE IDEA', visionTitle: ['Meetings should', 'end in action.'],
  visionText: 'People discuss, decide and approve. Who promised what, and by when, should not depend on somebody’s notes.',
  modelLabel: 'HOW IT WORKS', modelTitle: ['A layer between', 'talk and work.'],
  modelText: 'MeetTask listens to the conversation, separates decisions from commitments and turns each commitment into a task with an owner and a deadline.',
  resultLabel: 'INTEGRATIONS', resultTitle: ['Connects to where', 'you already work.'],
  resultText: 'Integrations with Meet, Zoom, Telegram and task trackers are planned, so results land in the tools your team already uses.',
  layers: [
    { title: 'Your team', text: 'Sets priorities, makes decisions and approves.' },
    { title: 'MeetTask AI', text: 'Transcribes, finds key moments and drafts tasks.' },
    { title: 'Meeting memory', text: 'Every decision, owner and deadline in one place.' },
    { title: 'Meetings', text: 'Live calls, recordings and every word said in them.' },
  ],
  integrationsMore: 'More soon',
  graphAria: 'Each dot is a word said in the meeting. MeetTask finds the tasks among them, rings each one and connects it to its owner.',
  graphCount: 'tasks', owners: ['Aziz Karimov', 'Malika Tosheva', 'Nodira Rahimova'],
  toTop: 'Back to top',
  demoEyebrow: '01 / SEE IT IN ACTION', demoTitle: ['One conversation.', 'Two useful views.'],
  demoText: 'Extract action items or save the most important moments from a conversation. Try the interactive sample below.',
  demoMeeting: 'Bozor 3D · Release meeting', interactive: 'INTERACTIVE SAMPLE', conversation: 'CONVERSATION',
  pause: 'Pause', replay: 'Replay', play: 'Play demo', restart: 'Restart demo', demoMode: 'Demo mode', tasks: 'Tasks', moments: 'Key moments',
  taskCaption: 'Organized with an owner and a deadline.', momentCaption: 'Important ideas are saved without creating task cards.',
  sampleNote: 'The demo uses a prepared sample. Real analysis depends on the meeting content.',
  sample: [
    { speaker: 'Nodira', text: 'Aziz, connect the payment system to the API by Monday.', task: 'Connect the payment system to the API', owner: 'Aziz Karimov', detail: 'By Monday', moment: 'The payment system is a critical release commitment.' },
    { speaker: 'Malika', text: 'The budget for 3D models has increased by thirty percent.', task: null, owner: '', detail: '', moment: 'Key update: the 3D model budget increased by 30%.' },
    { speaker: 'Nodira', text: 'Malika, prepare the price list tomorrow.', task: 'Prepare the price list', owner: 'Malika Tosheva', detail: 'Tomorrow', moment: 'Commitment: Malika will prepare the price list tomorrow.' },
    { speaker: 'Nodira', text: 'We will set the release date to October 15.', task: null, owner: '', detail: '', moment: 'Decision: the release date is October 15.' },
  ],
  featuresEyebrow: '02 / FROM CONVERSATION TO OUTCOME', featuresTitle: ['Less note-taking.', 'More attention.'],
  featuresText: 'Shorten the distance between talking, understanding and getting things done.',
  features: [
    { title: 'Talk. Keep every idea.', text: 'Record a live meeting or upload an existing audio file. Keep the transcript in one place.' },
    { title: 'Find what matters.', text: 'Decisions, open questions and important commitments make long conversations useful again.' },
    { title: 'Define the next step.', text: 'Tasks include owners and deadlines. When an owner is unclear, you can resolve it yourself.' },
  ],
  pricingEyebrow: '03 / A PLAN THAT FITS', pricingTitle: ['From one idea.', 'To a team outcome.'],
  pricingText: 'These plans are shown as proposals. Prices and usage limits have not been finalized yet.',
  plans: [
    { name: 'Personal', tag: 'For organizing your own work', features: ['Conversation transcription', 'Key moments', 'Personal tasks'], featured: false },
    { name: 'Team', tag: 'For teams working together', features: ['Everything in Personal', 'Multiple assignees', 'Role-based assignment', 'Shared meeting outcomes'], featured: true },
    { name: 'Business', tag: 'For broader requirements', features: ['Everything in Team', 'Custom requirements and limits', 'Implementation planning'], featured: false },
  ],
  teamBadge: 'FOR TEAMS', price: 'Let’s talk', pricePending: 'Pricing is being finalized', viewPlan: 'View plan',
  faqEyebrow: 'STILL HAVE QUESTIONS?', faqTitle: 'Good to know.',
  faq: [
    ['Does it work with Uzbek conversations?', 'Yes. MeetTask is designed to transcribe and analyze Uzbek conversations. Results depend on audio quality and clarity.'],
    ['What is the difference between key moments and tasks?', 'Key moments save ideas, decisions and commitments as text. Task mode creates cards with owners and deadlines.'],
    ['What if no owner was named?', 'Unassigned AI tasks are marked separately. After analysis, you can select one or more owners yourself.'],
    ['Can I buy a plan here?', 'Not yet. The plans are proposals; confirmed pricing and limits will be added later.'],
  ],
  finalEyebrow: 'FOR YOUR NEXT MEETING', finalTitle: ['The conversation ends.', 'Action begins.'], goToMeetTask: 'Open MeetTask',
  footer: 'Never lose a good idea.', planSuffix: 'plan',
  planText: 'This plan is currently a proposal. Pricing and limits are not finalized, and no payment will be taken. Sign in to explore the available features.',
  close: 'Close', continue: 'Continue',
};

const ru: PublicCopy = {
  language: 'Язык', themeLight: 'Светлая тема', themeDark: 'Тёмная тема', home: 'Главная MeetTask',
  authGoogleError: 'Не удалось войти через Google.', authLoginError: 'Не удалось войти.', authInvalidCredentials: 'Неверная почта или пароль.', authRegistrationError: 'Не удалось создать аккаунт. Проверьте данные и попробуйте снова.',
  navAria: 'Основная навигация', menuOpen: 'Открыть меню', menuClose: 'Закрыть меню', nav: ['Возможности', 'Демо', 'Тарифы'], enter: 'Войти', panel: 'Открыть панель',
  heroEyebrow: 'У ВАШЕГО РАЗГОВОРА ЕСТЬ ПРОДОЛЖЕНИЕ', hero: ['Хорошие идеи.', 'Чёткие действия.'],
  heroText: 'Сосредоточьтесь на разговоре. MeetTask AI запомнит важные мысли и упорядочит следующие задачи.',
  start: 'Начать с MeetTask', watchDemo: 'Смотреть демо', heroNote: 'Разговоры на узбекском. Два режима анализа.',
  live: 'Разговор продолжается', ideaToTask: 'От идеи к задаче', nextStep: 'Следующий шаг понятен.',
  motionStop: 'Остановить анимацию', motionStart: 'Включить анимацию', capabilitiesLabel: 'ДЛЯ КАЖДОГО РАЗГОВОРА',
  capabilities: ['Живая расшифровка', 'Ключевые моменты', 'Чёткие задачи', 'Все результаты вместе'],
  visionLabel: 'ИДЕЯ', visionTitle: ['Встреча должна', 'заканчиваться делом.'],
  visionText: 'Люди обсуждают, решают и утверждают. А кто что пообещал и к какому сроку, не должно зависеть от чьих-то заметок.',
  modelLabel: 'КАК ЭТО РАБОТАЕТ', modelTitle: ['Слой между', 'разговором и работой.'],
  modelText: 'MeetTask слушает разговор, отделяет решения от обязательств и превращает каждое обязательство в задачу с исполнителем и сроком.',
  resultLabel: 'ИНТЕГРАЦИИ', resultTitle: ['Работает там, где', 'вы уже работаете.'],
  resultText: 'Запланированы интеграции с Meet, Zoom, Telegram и трекерами задач, чтобы результаты попадали в привычные инструменты команды.',
  layers: [
    { title: 'Ваша команда', text: 'Задаёт приоритеты, принимает решения и утверждает.' },
    { title: 'MeetTask AI', text: 'Расшифровывает, находит ключевые моменты и готовит задачи.' },
    { title: 'Память встреч', text: 'Каждое решение, исполнитель и срок в одном месте.' },
    { title: 'Встречи', text: 'Живые звонки, записи и каждое сказанное слово.' },
  ],
  integrationsMore: 'Скоро ещё',
  graphAria: 'Каждая точка это слово, сказанное на встрече. MeetTask находит среди них задачи, отмечает их кольцом и связывает с исполнителем.',
  graphCount: 'задач', owners: ['Азиз Каримов', 'Малика Тошева', 'Нодира Рахимова'],
  toTop: 'Наверх',
  demoEyebrow: '01 / ПОСМОТРИТЕ В ДЕЙСТВИИ', demoTitle: ['Один разговор.', 'Два полезных взгляда.'],
  demoText: 'Выделяйте задачи или сохраняйте самые важные моменты разговора. Попробуйте интерактивный пример ниже.',
  demoMeeting: 'Bozor 3D · Релизная встреча', interactive: 'ИНТЕРАКТИВНЫЙ ПРИМЕР', conversation: 'РАЗГОВОР',
  pause: 'Пауза', replay: 'Повторить', play: 'Запустить демо', restart: 'Начать демо заново', demoMode: 'Режим демо', tasks: 'Задачи', moments: 'Ключевые моменты',
  taskCaption: 'Упорядочено по исполнителю и сроку.', momentCaption: 'Важные мысли сохраняются без создания карточек задач.',
  sampleNote: 'В демо используется подготовленный пример. Реальный анализ зависит от содержания встречи.',
  sample: [
    { speaker: 'Нодира', text: 'Азиз, подключите платёжную систему к API до понедельника.', task: 'Подключить платёжную систему к API', owner: 'Азиз Каримов', detail: 'До понедельника', moment: 'Платёжная система: критически важная задача для релиза.' },
    { speaker: 'Малика', text: 'Бюджет на 3D-модели вырос на тридцать процентов.', task: null, owner: '', detail: '', moment: 'Важное обновление: бюджет на 3D-модели вырос на 30%.' },
    { speaker: 'Нодира', text: 'Малика, подготовьте прайс-лист завтра.', task: 'Подготовить прайс-лист', owner: 'Малика Тошева', detail: 'Завтра', moment: 'Обязательство: Малика подготовит прайс-лист завтра.' },
    { speaker: 'Нодира', text: 'Назначим релиз на 15 октября.', task: null, owner: '', detail: '', moment: 'Решение: дата релиза 15 октября.' },
  ],
  featuresEyebrow: '02 / ОТ РАЗГОВОРА К РЕЗУЛЬТАТУ', featuresTitle: ['Меньше записей.', 'Больше внимания.'],
  featuresText: 'Сократите путь от обсуждения и понимания до выполненной работы.',
  features: [
    { title: 'Говорите. Не теряйте идеи.', text: 'Запишите живую встречу или загрузите готовое аудио. Расшифровка останется в одном месте.' },
    { title: 'Выделяйте главное.', text: 'Решения, открытые вопросы и важные обязательства делают длинные разговоры полезными.' },
    { title: 'Определяйте следующий шаг.', text: 'У задач есть исполнители и сроки. Если исполнитель неясен, его можно указать вручную.' },
  ],
  pricingEyebrow: '03 / ПОДХОДЯЩИЙ ПЛАН', pricingTitle: ['От одной идеи.', 'К общему результату.'],
  pricingText: 'Планы показаны как предложения. Цены и лимиты использования пока не утверждены.',
  plans: [
    { name: 'Личный', tag: 'Для организации собственной работы', features: ['Расшифровка разговоров', 'Ключевые моменты', 'Личные задачи'], featured: false },
    { name: 'Команда', tag: 'Для совместной работы команды', features: ['Всё из личного плана', 'Несколько исполнителей', 'Назначение по роли', 'Общие итоги встреч'], featured: true },
    { name: 'Бизнес', tag: 'Для расширенных требований', features: ['Всё из командного плана', 'Индивидуальные требования и лимиты', 'Планирование внедрения'], featured: false },
  ],
  teamBadge: 'ДЛЯ КОМАНД', price: 'По договорённости', pricePending: 'Цена уточняется', viewPlan: 'Посмотреть план',
  faqEyebrow: 'ОСТАЛИСЬ ВОПРОСЫ?', faqTitle: 'Полезно знать.',
  faq: [
    ['Работает ли сервис с узбекской речью?', 'Да. MeetTask создан для расшифровки и анализа разговоров на узбекском. Результат зависит от качества звука и чёткости речи.'],
    ['Чем ключевые моменты отличаются от задач?', 'Ключевые моменты сохраняют мысли, решения и обязательства как текст. Режим задач создаёт карточки с исполнителями и сроками.'],
    ['Что делать, если исполнитель не назван?', 'Неназначенные задачи ИИ отмечаются отдельно. После анализа можно выбрать одного или нескольких исполнителей.'],
    ['Можно ли купить тариф на этой странице?', 'Пока нет. Тарифы представлены как предложения; подтверждённые цены и лимиты появятся позже.'],
  ],
  finalEyebrow: 'ДЛЯ ВАШЕЙ СЛЕДУЮЩЕЙ ВСТРЕЧИ', finalTitle: ['Разговор заканчивается.', 'Действие начинается.'],
  goToMeetTask: 'Перейти в MeetTask', footer: 'Не теряйте хорошие идеи.', planSuffix: '(план)',
  planText: 'Этот план пока находится на стадии предложения. Цены и лимиты не утверждены, оплата не взимается. Войдите в аккаунт, чтобы посмотреть доступные возможности.',
  close: 'Закрыть', continue: 'Продолжить',
};

const PUBLIC_COPY: Record<Language, PublicCopy> = { uz, ru, en };

export const getPublicCopy = (language: Language): PublicCopy => PUBLIC_COPY[language] ?? uz;
