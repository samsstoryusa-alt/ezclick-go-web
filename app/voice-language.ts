import { languages, translateWeather, type WeatherLanguage } from './weather-translations';

/** Accept only the language codes carried by the voice bridge. */
export function voiceLanguage(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z]{2}$/.test(value) ? value : null;
}

export function voiceDirection(language: string): 'rtl' | 'ltr' {
  return ['ar', 'fa', 'he', 'ur'].includes(language) ? 'rtl' : 'ltr';
}

// Exact English source, Russian, Romanian, Arabic. Keep placeholders unchanged.
const rows: readonly (readonly [string, string, string, string])[] = [
  ['Start recording', 'Начать запись', 'Începe înregistrarea', 'بدء التسجيل'],
  ['Done', 'Готово', 'Gata', 'تم'],
  ['Cancel', 'Отмена', 'Anulează', 'إلغاء'],
  ['Tap to turn on the microphone.', 'Нажмите, чтобы включить микрофон.', 'Apasă pentru a activa microfonul.', 'اضغط لتشغيل الميكروفون.'],
  ['Recording cancelled.', 'Запись отменена.', 'Înregistrarea a fost anulată.', 'تم إلغاء التسجيل.'],
  ['Ask another question.', 'Задайте ещё вопрос.', 'Pune o altă întrebare.', 'اطرح سؤالًا آخر.'],
  ['Preparing recording…', 'Подготовка записи…', 'Se pregătește înregistrarea…', 'جارٍ تجهيز التسجيل…'],
  ['Recognizing your request…', 'Распознаю ваш запрос…', 'Se recunoaște cererea…', 'جارٍ التعرف على طلبك…'],
  ['Checking…', 'Проверяю…', 'Se verifică…', 'جارٍ التحقق…'],
  ['Route draft ready.', 'Маршрут подготовлен.', 'Schița traseului este gata.', 'مسودة المسار جاهزة.'],
  ['Allow microphone access…', 'Разрешите доступ к микрофону…', 'Permite accesul la microfon…', 'اسمح بالوصول إلى الميكروفون…'],
  ['Listening', 'Слушаю', 'Ascult', 'أستمع'],
  ['Listening · up to 20 seconds', 'Слушаю · до 20 секунд', 'Ascult · până la 20 de secunde', 'أستمع · حتى 20 ثانية'],
  ['Recording failed. Please try again.', 'Не удалось записать. Попробуйте ещё раз.', 'Înregistrarea a eșuat. Încearcă din nou.', 'فشل التسجيل. حاول مرة أخرى.'],
  ['Could not prepare the recording. Please try again.', 'Не удалось подготовить запись. Попробуйте ещё раз.', 'Nu s-a putut pregăti înregistrarea. Încearcă din nou.', 'تعذر تجهيز التسجيل. حاول مرة أخرى.'],
  ['The recording is empty. Please try again.', 'Запись пустая. Попробуйте ещё раз.', 'Înregistrarea este goală. Încearcă din nou.', 'التسجيل فارغ. حاول مرة أخرى.'],
  ['Recording ready. You can listen or send it.', 'Запись готова. Можно прослушать или отправить.', 'Înregistrarea este gata. O poți asculta sau trimite.', 'التسجيل جاهز. يمكنك الاستماع إليه أو إرساله.'],
  ['Voice assistant is unavailable. Please try again later.', 'Голосовой помощник недоступен. Попробуйте позже.', 'Asistentul vocal nu este disponibil. Încearcă mai târziu.', 'المساعد الصوتي غير متاح. حاول لاحقًا.'],
  ['Microphone access is blocked. Allow it in your browser settings.', 'Доступ к микрофону заблокирован. Разрешите его в настройках браузера.', 'Accesul la microfon este blocat. Permite-l în setările browserului.', 'الوصول إلى الميكروفون محظور. اسمح به في إعدادات المتصفح.'],
  ['Microphone is unavailable. Check your browser and input device.', 'Микрофон недоступен. Проверьте браузер и устройство ввода.', 'Microfonul nu este disponibil. Verifică browserul și dispozitivul de intrare.', 'الميكروفون غير متاح. تحقق من المتصفح وجهاز الإدخال.'],
  ['Recording saved. You can retry in {seconds} s.', 'Запись сохранена. Повторить можно через {seconds} с.', 'Înregistrarea a fost păstrată. Poți reîncerca în {seconds} s.', 'تم حفظ التسجيل. يمكنك المحاولة مجددًا بعد {seconds} ث.'],
  ['Recording saved. Tap “Send recording” — no need to record again.', 'Запись сохранена. Нажмите «Отправить запись» — записывать заново не нужно.', 'Înregistrarea a fost păstrată. Apasă „Trimite înregistrarea” — nu trebuie să înregistrezi din nou.', 'تم حفظ التسجيل. اضغط «إرسال التسجيل» — لا حاجة للتسجيل مجددًا.'],
  ['Wait {seconds} s', 'Подождите {seconds} с', 'Așteaptă {seconds} s', 'انتظر {seconds} ث'],
  ['Send recording', 'Отправить запись', 'Trimite înregistrarea', 'إرسال التسجيل'],
  ['Could not save the clarification. Please repeat the full request.', 'Не удалось сохранить уточнение. Повторите запрос целиком.', 'Nu s-a putut păstra clarificarea. Repetă cererea completă.', 'تعذر حفظ التوضيح. كرر الطلب كاملًا.'],
  ['No response from the server. Check your connection and retry.', 'Сервер не отвечает. Проверьте соединение и повторите.', 'Serverul nu răspunde. Verifică conexiunea și reîncearcă.', 'لا توجد استجابة من الخادم. تحقق من الاتصال وحاول مجددًا.'],
  ['Could not process your request. Please try again.', 'Не удалось обработать запрос. Попробуйте ещё раз.', 'Nu s-a putut procesa cererea. Încearcă din nou.', 'تعذرت معالجة طلبك. حاول مرة أخرى.'],
  ['No speech was recognized. Please try recording again.', 'Речь не распознана. Попробуйте записать ещё раз.', 'Nu s-a recunoscut nicio voce. Încearcă să înregistrezi din nou.', 'لم يتم التعرف على كلام. حاول التسجيل مرة أخرى.'],
  ['Could not understand the request. Please say it another way.', 'Не удалось понять запрос. Скажите иначе.', 'Nu am înțeles cererea. Spune-o altfel.', 'تعذر فهم الطلب. قل ذلك بطريقة أخرى.'],
  ['The assistant is busy. Please try again shortly.', 'Помощник занят. Попробуйте немного позже.', 'Asistentul este ocupat. Încearcă din nou în curând.', 'المساعد مشغول. حاول مجددًا بعد قليل.'],
  ['Open the assistant from the weather map.', 'Откройте помощник на погодной карте.', 'Deschide asistentul din harta meteo.', 'افتح المساعد من خريطة الطقس.'],
  ['The route changed. Please repeat your request.', 'Маршрут изменился. Повторите запрос.', 'Traseul s-a schimbat. Repetă cererea.', 'تغير المسار. كرر طلبك.'],
  ['Voice request cancelled.', 'Голосовой запрос отменён.', 'Cererea vocală a fost anulată.', 'تم إلغاء الطلب الصوتي.'],
  ['A newer voice request replaced this request.', 'Этот запрос заменён новым голосовым запросом.', 'Această cerere a fost înlocuită de o cerere vocală nouă.', 'حل طلب صوتي أحدث محل هذا الطلب.'],
  ['Finding your route…', 'Ищу маршрут…', 'Se caută traseul…', 'جارٍ البحث عن مسارك…'],
  ['Checking your forecast…', 'Проверяю прогноз…', 'Se verifică prognoza…', 'جارٍ التحقق من توقعات الطقس…'],
  ['Could not build the route. Please try again.', 'Не удалось построить маршрут. Попробуйте ещё раз.', 'Nu s-a putut calcula traseul. Încearcă din nou.', 'تعذر إنشاء المسار. حاول مرة أخرى.'],
  ['Say the starting city and state.', 'Назовите город и штат отправления.', 'Spune orașul și statul de plecare.', 'اذكر مدينة الانطلاق والولاية.'],
  ['Say the destination city and state.', 'Назовите город и штат назначения.', 'Spune orașul și statul de destinație.', 'اذكر مدينة الوجهة والولاية.'],
  ['Please give the departure day and time in your device timezone ({timezone}).', 'Укажите день и время выезда в часовом поясе устройства ({timezone}).', 'Spune ziua și ora plecării în fusul orar al dispozitivului ({timezone}).', 'حدد يوم ووقت المغادرة حسب المنطقة الزمنية لجهازك ({timezone}).'],
  ['That local time occurs twice when the clocks change. Please choose a different departure time.', 'При переводе часов это местное время наступает дважды. Выберите другое время выезда.', 'Această oră locală apare de două ori la schimbarea orei. Alege altă oră de plecare.', 'يتكرر هذا الوقت المحلي مرتين عند تغيير الساعة. اختر وقت مغادرة آخر.'],
  ['That departure time ({time}) has already passed. Are you leaving now or tomorrow at {time}?', 'Время выезда ({time}) уже прошло. Выезжаете сейчас или завтра в {time}?', 'Ora de plecare ({time}) a trecut deja. Pleci acum sau mâine la {time}?', 'وقت المغادرة ({time}) قد مضى. هل ستغادر الآن أم غدًا الساعة {time}؟'],
  ['What day and time are you leaving? You can also say “now”.', 'В какой день и во сколько выезжаете? Можно сказать «сейчас».', 'În ce zi și la ce oră pleci? Poți spune și „acum”.', 'في أي يوم ووقت ستغادر؟ يمكنك أيضًا قول «الآن».'],
  ['Which state is {city} in? Please say the city and state.', 'В каком штате находится {city}? Назовите город и штат.', 'În ce stat se află {city}? Spune orașul și statul.', 'في أي ولاية تقع {city}؟ اذكر المدينة والولاية.'],
  ['That departure time has passed. When are you leaving?', 'Время выезда уже прошло. Когда выезжаете?', 'Ora de plecare a trecut. Când pleci?', 'وقت المغادرة قد مضى. متى ستغادر؟'],
  ['City search is unavailable. Please try again.', 'Поиск города недоступен. Попробуйте ещё раз.', 'Căutarea orașului nu este disponibilă. Încearcă din nou.', 'البحث عن المدن غير متاح. حاول مرة أخرى.'],
  ['Say the city and state for a separate forecast.', 'Назовите город и штат для отдельного прогноза.', 'Spune orașul și statul pentru o prognoză separată.', 'اذكر المدينة والولاية للحصول على توقعات منفصلة.'],
  ['Waiting for the route forecast…', 'Ожидаю прогноз по маршруту…', 'Se așteaptă prognoza traseului…', 'بانتظار توقعات الطقس على المسار…'],
  ['Comparing weather over the next four hours…', 'Сравниваю погоду на ближайшие четыре часа…', 'Se compară vremea pentru următoarele patru ore…', 'جارٍ مقارنة الطقس خلال الساعات الأربع القادمة…'],
  ['Choose the forecast city. Times use your device timezone.', 'Выберите город прогноза. Время указано в часовом поясе устройства.', 'Alege orașul pentru prognoză. Orele folosesc fusul orar al dispozitivului.', 'اختر مدينة التوقعات. الأوقات حسب المنطقة الزمنية لجهازك.'],
  ['City not found. Please give its name and state.', 'Город не найден. Укажите название и штат.', 'Orașul nu a fost găsit. Spune numele și statul.', 'لم يتم العثور على المدينة. اذكر اسمها والولاية.'],
  ['Choose a city, date and future time, or “Now”.', 'Выберите город, дату и будущее время или «Сейчас».', 'Alege un oraș, o dată și o oră viitoare sau „Acum”.', 'اختر مدينة وتاريخًا ووقتًا مستقبليًا أو «الآن».'],
  ['Loading forecast…', 'Загрузка прогноза…', 'Se încarcă prognoza…', 'جارٍ تحميل توقعات الطقس…'],
  ['Could not load the forecast. Please try again.', 'Не удалось загрузить прогноз. Попробуйте ещё раз.', 'Nu s-a putut încărca prognoza. Încearcă din nou.', 'تعذر تحميل توقعات الطقس. حاول مرة أخرى.'],
  ['Could not prepare the reply. Check the forecast on the map and try again.', 'Не удалось подготовить ответ. Проверьте прогноз на карте и повторите.', 'Nu s-a putut pregăti răspunsul. Verifică prognoza pe hartă și reîncearcă.', 'تعذر تجهيز الرد. تحقق من التوقعات على الخريطة وحاول مجددًا.'],
  ['City', 'Город', 'Oraș', 'المدينة'],
  ['Choose a place', 'Выберите место', 'Alege un loc', 'اختر مكانًا'],
  ['Weather now', 'Погода сейчас', 'Vremea acum', 'الطقس الآن'],
  ['Date', 'Дата', 'Data', 'التاريخ'],
  ['Time', 'Время', 'Ora', 'الوقت'],
  ['Loading…', 'Загрузка…', 'Se încarcă…', 'جارٍ التحميل…'],
  ['Show weather', 'Показать погоду', 'Arată vremea', 'عرض الطقس'],
];

const quotaKeys = [
  'Your daily voice allowance is used up. It resets at midnight in New York.',
  'The shared daily voice allowance is used up. It resets at midnight in New York.',
  "All 20 voice requests for today are used up. I'm taking a pit stop ☕ See you tomorrow! The limit resets at midnight in New York. The map and forecasts still work.",
] as const;

/** Exact source keys used to populate parent-to-recorder translation labels. */
export const VOICE_RECORDER_KEYS: readonly string[] = [...rows.map(row => row[0]), ...quotaKeys];

const dictionaries: Record<string, Readonly<Record<string, string>>> = Object.fromEntries(
  ['ru', 'ro', 'ar'].map((code, index) => [code, Object.fromEntries(rows.map(row => [row[0], row[index + 1]]))]),
);
const supported = new Set<string>(languages.map(language => language.code));

export function translateVoice(key: string, language: string, values: Record<string, string | number> = {}): string {
  const dictionary = Object.prototype.hasOwnProperty.call(dictionaries, language) ? dictionaries[language] : undefined;
  const translated = dictionary && Object.prototype.hasOwnProperty.call(dictionary, key)
    ? dictionary[key]
    : supported.has(language) ? translateWeather(key, language as WeatherLanguage) : key;
  return translated.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder);
}
