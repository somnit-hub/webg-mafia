export const FUNNY_GUEST_NAMES = Object.freeze([
  'Батон',
  'Бублик',
  'Пончик',
  'Вареник',
  'Галушка',
  'Шпрот',
  'Кабачок',
  'Огірочок',
  'Борщик',
  'Компот',
  'Кексик',
  'Круасан',
  'Сирник',
  'Пельмень',
  'Барабулька',
  'Кукумбер',
  'Пупсик',
  'Кнопик',
  'Шкарпет',
  'Тапок',
  'Віник',
  'Чайник',
  'Термос',
  'Баняк',
  'Капець',
  'Карась',
  'Сомик',
  'Хом’як',
  'Бобер',
  'Єнот',
  'Качур',
  'Гусак',
  'Пінгвін',
  'Лось',
  'Кабанчик',
  'Їжак',
  'Тюлень',
  'Буркотун',
  'Хропун',
  'Ждун',
  'Шептун',
  'Реготун',
  'Сонько',
  'Ледацюга',
  'Забудько',
  'Нишпорка',
  'Хитрун',
  'Мудрагель',
  'Панікер',
  'Шулер',
  'Балабол',
  'Мовчун',
  'Красунчик',
  'Шеф',
  'Бос',
  'Кум',
  'Сусід',
  'Дивак',
  'Хитрюга',
  'Чепурун'
]);

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('uk');
}

export function pickFunnyGuestNames(count, excludedNames = [], random = Math.random) {
  const requested = Math.max(0, Math.floor(Number(count) || 0));
  const excluded = new Set(excludedNames.map(normalized).filter(Boolean));
  const available = FUNNY_GUEST_NAMES.filter(name => !excluded.has(normalized(name)));

  for (let index = available.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.max(0, Math.min(0.999999999, random())) * (index + 1));
    [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
  }

  const selected = available.slice(0, requested);
  for (let index = selected.length; index < requested; index++) {
    selected.push(`Гість${index + 1}`);
  }
  return selected;
}
