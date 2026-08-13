export const LANGUAGES = Object.freeze([
  { code: 'uk', label: 'Українська', locale: 'uk-UA' },
  { code: 'ru', label: 'Російська', locale: 'ru-RU' },
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'fr', label: 'Français', locale: 'fr-FR' }
]);

const COPY = {
  ru: {
    'Огляд': 'Обзор',
    'Гравці': 'Игроки',
    'Нова гра': 'Новая игра',
    'Статистика': 'Статистика',
    'Ще': 'Ещё',
    'Основна навігація': 'Основная навигация',
    'Mafia — головна': 'Mafia — главная',
    'Встановити застосунок': 'Установить приложение',
    'Профіль ведучого': 'Профиль ведущего',
    'Пояснення': 'Подсказка',
    'Відкрити пояснення': 'Открыть подсказку',
    'Докладніше про синхронізацію': 'Подробнее о синхронизации',
    'Додати гравців': 'Добавить игроков',
    'Продовжити': 'Продолжить',
    'Усі': 'Все',
    'гравців у базі': 'игроков в базе',
    'перемог міста': 'побед города',
    'за ігровим столом': 'за игровым столом',
    '+ Додати гравця': '+ Добавить игрока',
    'Оновити': 'Обновить',
    'Наступна гра': 'Следующая игра',
    'До розсадки': 'К рассадке',
    'Очистити': 'Очистить',
    'Локальний': 'Локальный',
    'Додано ведучим': 'Добавлен ведущим',
    'Назва': 'Название',
    'Правила й таймери': 'Правила и таймеры',
    'Розсадка': 'Рассадка',
    'Перемішати місця': 'Перемешать места',
    '+ Новий профіль': '+ Новый профиль',
    'Роздати ролі': 'Раздать роли',
    'Правила спортивної «Мафії»': 'Правила спортивной «Мафии»',
    'Правила iMafia українською': 'Правила iMafia на украинском',
    'Міжнародний регламент ФІІМ': 'Международный регламент ФИИМ',
    'Налаштування': 'Настройки',
    'перемог мафії': 'побед мафии',
    'загальний час': 'общее время',
    'Результативність ролей': 'Результативность ролей',
    'Протокол': 'Протокол',
    'Видалити': 'Удалить',
    'Домівка нашого мафія-клубу': 'Дом нашего мафия-клуба',
    'Профіль Enjoy': 'Профиль Enjoy',
    'Редагувати профіль': 'Редактировать профиль',
    'Вийти': 'Выйти',
    'На цьому пристрої': 'На этом устройстве',
    'Мова застосунку': 'Язык приложения',
    'Тема оформлення': 'Тема оформления',
    'Темна': 'Тёмная',
    'Світла': 'Светлая',
    'Кав’ярня': 'Кофейня',
    'Звукові сигнали таймера': 'Звуковые сигналы таймера',
    'Вібрація важливих дій': 'Вибрация важных действий',
    'Резервна копія Google Drive': 'Резервная копия Google Drive',
    'Підключено': 'Подключено',
    'Не підключено': 'Не подключено',
    'Зберегти у Drive': 'Сохранить в Drive',
    'Відновити з Drive': 'Восстановить из Drive',
    'Відключити Drive': 'Отключить Drive',
    'Увімкнути резервну копію': 'Включить резервную копию',
    'Режим оглядача': 'Режим наблюдателя',
    'Відкрити публічний екран': 'Открыть публичный экран',
    'Про застосунок': 'О приложении',
    'Мій профіль Enjoy': 'Мой профиль Enjoy',
    'Зробити фото': 'Сделать фото',
    'Обрати з галереї': 'Выбрать из галереи',
    'Фото Google': 'Фото Google',
    'Ім’я для відображення *': 'Отображаемое имя *',
    'Нікнейм': 'Никнейм',
    'Клуб або організація': 'Клуб или организация',
    'Про себе': 'О себе',
    'Показувати мене в каталозі Enjoy': 'Показывать меня в каталоге Enjoy',
    'Google-акаунт': 'Google-аккаунт',
    'Підтверджено': 'Подтверждено',
    'Скасувати': 'Отменить',
    'Зберегти профіль': 'Сохранить профиль',
    'Видалити профіль': 'Удалить профиль',
    'Закрити': 'Закрыть',
    'Закрити це вікно': 'Закрыть это окно',
    'Досвід ведення, улюблена кава…': 'Опыт ведения, любимый кофе…',
    'Оберіть мову інтерфейсу. Налаштування зберігається на цьому пристрої.': 'Выберите язык интерфейса. Настройка сохраняется на этом устройстве.',
    'Небезпечна дія': 'Опасное действие',
    'Видалення профілю потребує окремого підтвердження.': 'Удаление профиля требует отдельного подтверждения.'
  },
  en: {
    'Огляд': 'Overview',
    'Гравці': 'Players',
    'Нова гра': 'New game',
    'Статистика': 'Statistics',
    'Ще': 'More',
    'Основна навігація': 'Main navigation',
    'Mafia — головна': 'Mafia — home',
    'Встановити застосунок': 'Install app',
    'Профіль ведучого': 'Host profile',
    'Пояснення': 'Help',
    'Відкрити пояснення': 'Open help',
    'Докладніше про синхронізацію': 'About synchronization',
    'Додати гравців': 'Add players',
    'Продовжити': 'Continue',
    'Усі': 'All',
    'гравців у базі': 'players in directory',
    'перемог міста': 'city wins',
    'за ігровим столом': 'at the game table',
    '+ Додати гравця': '+ Add player',
    'Оновити': 'Refresh',
    'Наступна гра': 'Next game',
    'До розсадки': 'Open seating',
    'Очистити': 'Clear',
    'Локальний': 'Local',
    'Додано ведучим': 'Added by host',
    'Назва': 'Title',
    'Правила й таймери': 'Rules and timers',
    'Розсадка': 'Seating',
    'Перемішати місця': 'Shuffle seats',
    '+ Новий профіль': '+ New profile',
    'Роздати ролі': 'Deal roles',
    'Правила спортивної «Мафії»': 'Sport Mafia rules',
    'Правила iMafia українською': 'iMafia rules in Ukrainian',
    'Міжнародний регламент ФІІМ': 'FIIM international rules',
    'Налаштування': 'Settings',
    'перемог мафії': 'mafia wins',
    'загальний час': 'total time',
    'Результативність ролей': 'Role performance',
    'Протокол': 'Game log',
    'Видалити': 'Delete',
    'Домівка нашого мафія-клубу': 'Home of our Mafia club',
    'Профіль Enjoy': 'Enjoy profile',
    'Редагувати профіль': 'Edit profile',
    'Вийти': 'Sign out',
    'На цьому пристрої': 'On this device',
    'Мова застосунку': 'App language',
    'Тема оформлення': 'Appearance',
    'Темна': 'Dark',
    'Світла': 'Light',
    'Кав’ярня': 'Coffee shop',
    'Звукові сигнали таймера': 'Timer sounds',
    'Вібрація важливих дій': 'Haptic feedback',
    'Резервна копія Google Drive': 'Google Drive backup',
    'Підключено': 'Connected',
    'Не підключено': 'Not connected',
    'Зберегти у Drive': 'Save to Drive',
    'Відновити з Drive': 'Restore from Drive',
    'Відключити Drive': 'Disconnect Drive',
    'Увімкнути резервну копію': 'Enable backup',
    'Режим оглядача': 'Observer mode',
    'Відкрити публічний екран': 'Open public display',
    'Про застосунок': 'About the app',
    'Мій профіль Enjoy': 'My Enjoy profile',
    'Зробити фото': 'Take photo',
    'Обрати з галереї': 'Choose from gallery',
    'Фото Google': 'Google photo',
    'Ім’я для відображення *': 'Display name *',
    'Нікнейм': 'Nickname',
    'Клуб або організація': 'Club or organization',
    'Про себе': 'About me',
    'Показувати мене в каталозі Enjoy': 'Show me in the Enjoy directory',
    'Google-акаунт': 'Google account',
    'Підтверджено': 'Verified',
    'Скасувати': 'Cancel',
    'Зберегти профіль': 'Save profile',
    'Видалити профіль': 'Delete profile',
    'Закрити': 'Close',
    'Закрити це вікно': 'Close this window',
    'Досвід ведення, улюблена кава…': 'Hosting experience, favorite coffee…',
    'Оберіть мову інтерфейсу. Налаштування зберігається на цьому пристрої.': 'Choose the interface language. This setting is stored on this device.',
    'Небезпечна дія': 'Danger zone',
    'Видалення профілю потребує окремого підтвердження.': 'Deleting your profile requires a separate confirmation.'
  },
  fr: {
    'Огляд': 'Aperçu',
    'Гравці': 'Joueurs',
    'Нова гра': 'Nouvelle partie',
    'Статистика': 'Statistiques',
    'Ще': 'Plus',
    'Основна навігація': 'Navigation principale',
    'Mafia — головна': 'Mafia — accueil',
    'Встановити застосунок': 'Installer l’application',
    'Профіль ведучого': 'Profil de l’animateur',
    'Пояснення': 'Aide',
    'Відкрити пояснення': 'Ouvrir l’aide',
    'Докладніше про синхронізацію': 'À propos de la synchronisation',
    'Додати гравців': 'Ajouter des joueurs',
    'Продовжити': 'Continuer',
    'Усі': 'Toutes',
    'гравців у базі': 'joueurs dans l’annuaire',
    'перемог міста': 'victoires de la ville',
    'за ігровим столом': 'à la table de jeu',
    '+ Додати гравця': '+ Ajouter un joueur',
    'Оновити': 'Actualiser',
    'Наступна гра': 'Prochaine partie',
    'До розсадки': 'Voir le placement',
    'Очистити': 'Effacer',
    'Локальний': 'Local',
    'Додано ведучим': 'Ajouté par l’animateur',
    'Назва': 'Nom',
    'Правила й таймери': 'Règles et minuteurs',
    'Розсадка': 'Placement',
    'Перемішати місця': 'Mélanger les places',
    '+ Новий профіль': '+ Nouveau profil',
    'Роздати ролі': 'Distribuer les rôles',
    'Правила спортивної «Мафії»': 'Règles de la Mafia sportive',
    'Правила iMafia українською': 'Règles iMafia en ukrainien',
    'Міжнародний регламент ФІІМ': 'Règlement international FIIM',
    'Налаштування': 'Paramètres',
    'перемог мафії': 'victoires de la mafia',
    'загальний час': 'temps total',
    'Результативність ролей': 'Performance des rôles',
    'Протокол': 'Compte rendu',
    'Видалити': 'Supprimer',
    'Домівка нашого мафія-клубу': 'Le foyer de notre club Mafia',
    'Профіль Enjoy': 'Profil Enjoy',
    'Редагувати профіль': 'Modifier le profil',
    'Вийти': 'Se déconnecter',
    'На цьому пристрої': 'Sur cet appareil',
    'Мова застосунку': 'Langue de l’application',
    'Тема оформлення': 'Thème',
    'Темна': 'Sombre',
    'Світла': 'Clair',
    'Кав’ярня': 'Café',
    'Звукові сигнали таймера': 'Sons du minuteur',
    'Вібрація важливих дій': 'Retour haptique',
    'Резервна копія Google Drive': 'Sauvegarde Google Drive',
    'Підключено': 'Connecté',
    'Не підключено': 'Non connecté',
    'Зберегти у Drive': 'Enregistrer dans Drive',
    'Відновити з Drive': 'Restaurer depuis Drive',
    'Відключити Drive': 'Déconnecter Drive',
    'Увімкнути резервну копію': 'Activer la sauvegarde',
    'Режим оглядача': 'Mode observateur',
    'Відкрити публічний екран': 'Ouvrir l’écran public',
    'Про застосунок': 'À propos',
    'Мій профіль Enjoy': 'Mon profil Enjoy',
    'Зробити фото': 'Prendre une photo',
    'Обрати з галереї': 'Choisir dans la galerie',
    'Фото Google': 'Photo Google',
    'Ім’я для відображення *': 'Nom affiché *',
    'Нікнейм': 'Pseudo',
    'Клуб або організація': 'Club ou organisation',
    'Про себе': 'À propos de moi',
    'Показувати мене в каталозі Enjoy': 'M’afficher dans l’annuaire Enjoy',
    'Google-акаунт': 'Compte Google',
    'Підтверджено': 'Vérifié',
    'Скасувати': 'Annuler',
    'Зберегти профіль': 'Enregistrer le profil',
    'Видалити профіль': 'Supprimer le profil',
    'Закрити': 'Fermer',
    'Закрити це вікно': 'Fermer cette fenêtre',
    'Досвід ведення, улюблена кава…': 'Expérience d’animation, café préféré…',
    'Оберіть мову інтерфейсу. Налаштування зберігається на цьому пристрої.': 'Choisissez la langue de l’interface. Ce réglage est enregistré sur cet appareil.',
    'Небезпечна дія': 'Zone dangereuse',
    'Видалення профілю потребує окремого підтвердження.': 'La suppression du profil nécessite une confirmation distincte.'
  }
};

Object.assign(COPY.ru, {
  'Як дістатися': 'Как добраться', 'Місто': 'Город', 'Каталог недоступний': 'Каталог недоступен',
  'Синхронізовано': 'Синхронизировано', 'Офлайн-кеш': 'Офлайн-кеш', 'Синхронізація…': 'Синхронизация…', 'Помилка': 'Ошибка',
  'НАСТУПНА ГРА': 'СЛЕДУЮЩАЯ ИГРА', 'без опису': 'без описания', 'Очікує Google': 'Ожидает Google',
  'ПРОМОВА, СЕК': 'РЕЧЬ, СЕК', 'АВТОКАТАСТРОФА, СЕК': 'АВТОКАТАСТРОФА, СЕК', 'ОСТАННЄ СЛОВО, СЕК': 'ПОСЛЕДНЕЕ СЛОВО, СЕК',
  'НІЧНА ДІЯ, СЕК': 'НОЧНОЕ ДЕЙСТВИЕ, СЕК', 'СИСТЕМА ФОЛІВ': 'СИСТЕМА ФОЛОВ', 'Турнірна': 'Турнирная', 'Клубна': 'Клубная',
  'Інші випадкові 10': 'Другие случайные 10', 'Тимчасовий гравець': 'Временный игрок',
  'Шериф': 'Шериф', 'Дон': 'Дон', 'Мафія': 'Мафия', 'Мирний житель': 'Мирный житель',
  'Червона команда': 'Красная команда', 'Чорна команда': 'Чёрная команда',
  'Передайте телефон особисто': 'Передайте телефон лично', 'Сховати й передати далі': 'Скрыть и передать дальше', 'Показати мою роль': 'Показать мою роль',
  'Створити гру': 'Создать игру', 'Немає гри': 'Нет игры',
  'Роздача ролей': 'Раздача ролей', 'Нульова ніч': 'Нулевая ночь', 'Голосування': 'Голосование',
  'Автокатастрофа · промови': 'Автокатастрофа · речи', 'Автокатастрофа · голосування': 'Автокатастрофа · голосование',
  'Вихід усіх кандидатів': 'Выход всех кандидатов', 'Останнє слово': 'Последнее слово', 'Гру завершено': 'Игра завершена',
  'Місто засинає': 'Город засыпает', 'Мафія стріляє': 'Мафия стреляет', 'Дон шукає Шерифа': 'Дон ищет Шерифа',
  'Шериф перевіряє місто': 'Шериф проверяет город', 'Місто прокидається': 'Город просыпается', 'Чорна команда знайомиться': 'Чёрная команда знакомится',
  'Публічний екран': 'Публичный экран', 'Мафія прокидається': 'Мафия просыпается', 'Почати день 1': 'Начать день 1',
  'Пауза': 'Пауза', 'Старт': 'Старт', 'Скинути': 'Сбросить', 'Коло завершено': 'Круг завершён', 'Кандидатур немає': 'Кандидатур нет',
  'Назад': 'Назад', 'До голосування': 'К голосованию', 'Перейти до ночі': 'Перейти к ночи', 'Поточна промова': 'Текущая речь',
  'Завершити коло': 'Завершить круг', 'Наступний →': 'Следующий →', 'Повторне голосування': 'Повторное голосование',
  'Залишок останньому': 'Остаток последнему', 'Підсумувати': 'Подвести итог', 'Голосувати': 'Голосовать', 'ПРОТИ': 'ПРОТИВ',
  'Наступне слово →': 'Следующее слово →', 'Наступний день →': 'Следующий день →', 'Ранок': 'Утро', 'Далі: стрільба мафії': 'Далее: стрельба мафии',
  'Промах': 'Промах', 'Зафіксувати': 'Зафиксировать', 'Продовжити': 'Продолжить', 'Показати результат': 'Показать результат',
  'Далі': 'Далее', 'Змінити ціль': 'Изменить цель', 'Сховати й далі': 'Скрыть и продолжить', 'Панель ведучого': 'Панель ведущего',
  'Сховати': 'Скрыть', 'Ролі': 'Роли', 'Таймери': 'Таймеры', 'Копіювати протокол': 'Копировать протокол', 'Оглядач': 'Наблюдатель',
  'Подій ще немає': 'Событий пока нет', 'Публічна інформація': 'Публичная информация',
  'Немає кандидатів': 'Нет кандидатов', 'Перемога мирного міста': 'Победа мирного города',
  'Перемога чорної команди': 'Победа чёрной команды', 'Реванш': 'Реванш', 'На головну': 'На главную',
  'Профіль гравця': 'Профиль игрока', 'Новий гравець': 'Новый игрок', 'Зберегти': 'Сохранить'
});

Object.assign(COPY.en, {
  'Як дістатися': 'Directions', 'Місто': 'City', 'Каталог недоступний': 'Directory unavailable',
  'Синхронізовано': 'Synchronized', 'Офлайн-кеш': 'Offline cache', 'Синхронізація…': 'Synchronizing…', 'Помилка': 'Error',
  'НАСТУПНА ГРА': 'NEXT GAME', 'без опису': 'no description', 'Очікує Google': 'Awaiting Google',
  'ПРОМОВА, СЕК': 'SPEECH, SEC', 'АВТОКАТАСТРОФА, СЕК': 'TIE SPEECH, SEC', 'ОСТАННЄ СЛОВО, СЕК': 'LAST WORD, SEC',
  'НІЧНА ДІЯ, СЕК': 'NIGHT ACTION, SEC', 'СИСТЕМА ФОЛІВ': 'FOUL SYSTEM', 'Турнірна': 'Tournament', 'Клубна': 'Club',
  'Інші випадкові 10': 'Another random 10', 'Тимчасовий гравець': 'Temporary player',
  'Шериф': 'Sheriff', 'Дон': 'Don', 'Мафія': 'Mafia', 'Мирний житель': 'Citizen',
  'Червона команда': 'Red team', 'Чорна команда': 'Black team',
  'Передайте телефон особисто': 'Hand the phone over in person', 'Сховати й передати далі': 'Hide and pass on', 'Показати мою роль': 'Show my role',
  'Створити гру': 'Create game', 'Немає гри': 'No game',
  'Роздача ролей': 'Role reveal', 'Нульова ніч': 'Zero night', 'Голосування': 'Voting',
  'Автокатастрофа · промови': 'Tie · speeches', 'Автокатастрофа · голосування': 'Tie · voting',
  'Вихід усіх кандидатів': 'Eliminate all candidates', 'Останнє слово': 'Last word', 'Гру завершено': 'Game finished',
  'Місто засинає': 'The city falls asleep', 'Мафія стріляє': 'Mafia shoots', 'Дон шукає Шерифа': 'Don searches for the Sheriff',
  'Шериф перевіряє місто': 'Sheriff checks the city', 'Місто прокидається': 'The city wakes up', 'Чорна команда знайомиться': 'The black team meets',
  'Публічний екран': 'Public display', 'Мафія прокидається': 'Mafia wakes up', 'Почати день 1': 'Start day 1',
  'Пауза': 'Pause', 'Старт': 'Start', 'Скинути': 'Reset', 'Коло завершено': 'Round complete', 'Кандидатур немає': 'No nominees',
  'Назад': 'Back', 'До голосування': 'Proceed to voting', 'Перейти до ночі': 'Proceed to night', 'Поточна промова': 'Current speech',
  'Завершити коло': 'Finish round', 'Наступний →': 'Next →', 'Повторне голосування': 'Revote',
  'Залишок останньому': 'Assign remainder to last', 'Підсумувати': 'Finalize', 'Голосувати': 'Vote', 'ПРОТИ': 'AGAINST',
  'Наступне слово →': 'Next speech →', 'Наступний день →': 'Next day →', 'Ранок': 'Morning', 'Далі: стрільба мафії': 'Next: Mafia shooting',
  'Промах': 'Miss', 'Зафіксувати': 'Confirm', 'Продовжити': 'Continue', 'Показати результат': 'Show result',
  'Далі': 'Next', 'Змінити ціль': 'Change target', 'Сховати й далі': 'Hide and continue', 'Панель ведучого': 'Host panel',
  'Сховати': 'Hide', 'Ролі': 'Roles', 'Таймери': 'Timers', 'Копіювати протокол': 'Copy game log', 'Оглядач': 'Observer',
  'Подій ще немає': 'No events yet', 'Публічна інформація': 'Public information',
  'Немає кандидатів': 'No candidates', 'Перемога мирного міста': 'The city wins',
  'Перемога чорної команди': 'The black team wins', 'Реванш': 'Rematch', 'На головну': 'Home',
  'Профіль гравця': 'Player profile', 'Новий гравець': 'New player', 'Зберегти': 'Save'
});

Object.assign(COPY.fr, {
  'Як дістатися': 'Itinéraire', 'Місто': 'Ville', 'Каталог недоступний': 'Annuaire indisponible',
  'Синхронізовано': 'Synchronisé', 'Офлайн-кеш': 'Cache hors ligne', 'Синхронізація…': 'Synchronisation…', 'Помилка': 'Erreur',
  'НАСТУПНА ГРА': 'PROCHAINE PARTIE', 'без опису': 'sans description', 'Очікує Google': 'En attente de Google',
  'ПРОМОВА, СЕК': 'DISCOURS, S', 'АВТОКАТАСТРОФА, СЕК': 'ÉGALITÉ, S', 'ОСТАННЄ СЛОВО, СЕК': 'DERNIER MOT, S',
  'НІЧНА ДІЯ, СЕК': 'ACTION DE NUIT, S', 'СИСТЕМА ФОЛІВ': 'SYSTÈME DE FAUTES', 'Турнірна': 'Tournoi', 'Клубна': 'Club',
  'Інші випадкові 10': '10 autres au hasard', 'Тимчасовий гравець': 'Joueur temporaire',
  'Шериф': 'Shérif', 'Дон': 'Don', 'Мафія': 'Mafia', 'Мирний житель': 'Citoyen',
  'Червона команда': 'Équipe rouge', 'Чорна команда': 'Équipe noire',
  'Передайте телефон особисто': 'Remettez le téléphone en main propre', 'Сховати й передати далі': 'Masquer et transmettre', 'Показати мою роль': 'Afficher mon rôle',
  'Створити гру': 'Créer une partie', 'Немає гри': 'Aucune partie',
  'Роздача ролей': 'Révélation des rôles', 'Нульова ніч': 'Nuit zéro', 'Голосування': 'Vote',
  'Автокатастрофа · промови': 'Égalité · discours', 'Автокатастрофа · голосування': 'Égalité · vote',
  'Вихід усіх кандидатів': 'Sortie de tous les candidats', 'Останнє слово': 'Dernier mot', 'Гру завершено': 'Partie terminée',
  'Місто засинає': 'La ville s’endort', 'Мафія стріляє': 'La mafia tire', 'Дон шукає Шерифа': 'Le Don cherche le Shérif',
  'Шериф перевіряє місто': 'Le Shérif inspecte la ville', 'Місто прокидається': 'La ville se réveille', 'Чорна команда знайомиться': 'L’équipe noire fait connaissance',
  'Публічний екран': 'Écran public', 'Мафія прокидається': 'La mafia se réveille', 'Почати день 1': 'Commencer le jour 1',
  'Пауза': 'Pause', 'Старт': 'Démarrer', 'Скинути': 'Réinitialiser', 'Коло завершено': 'Tour terminé', 'Кандидатур немає': 'Aucun candidat',
  'Назад': 'Retour', 'До голосування': 'Passer au vote', 'Перейти до ночі': 'Passer à la nuit', 'Поточна промова': 'Discours en cours',
  'Завершити коло': 'Terminer le tour', 'Наступний →': 'Suivant →', 'Повторне голосування': 'Nouveau vote',
  'Залишок останньому': 'Attribuer le reste au dernier', 'Підсумувати': 'Finaliser', 'Голосувати': 'Voter', 'ПРОТИ': 'CONTRE',
  'Наступне слово →': 'Discours suivant →', 'Наступний день →': 'Jour suivant →', 'Ранок': 'Matin', 'Далі: стрільба мафії': 'Suite : tir de la mafia',
  'Промах': 'Manqué', 'Зафіксувати': 'Confirmer', 'Продовжити': 'Continuer', 'Показати результат': 'Afficher le résultat',
  'Далі': 'Suivant', 'Змінити ціль': 'Changer de cible', 'Сховати й далі': 'Masquer et continuer', 'Панель ведучого': 'Panneau de l’animateur',
  'Сховати': 'Masquer', 'Ролі': 'Rôles', 'Таймери': 'Minuteurs', 'Копіювати протокол': 'Copier le compte rendu', 'Оглядач': 'Observateur',
  'Подій ще немає': 'Aucun événement', 'Публічна інформація': 'Informations publiques',
  'Немає кандидатів': 'Aucun candidat', 'Перемога мирного міста': 'Victoire de la ville',
  'Перемога чорної команди': 'Victoire de l’équipe noire', 'Реванш': 'Revanche', 'На головну': 'Accueil',
  'Профіль гравця': 'Profil du joueur', 'Новий гравець': 'Nouveau joueur', 'Зберегти': 'Enregistrer'
});

Object.assign(COPY.ru, {
  'Навігація активної гри': 'Навигация активной игры', 'Активна гра': 'Активная игра',
  'Активні ігри': 'Активные игры', 'Триває зараз': 'Идёт сейчас', 'Спостерігати': 'Наблюдать',
  'Створити гру': 'Создать игру', 'Незавершена гра': 'Незавершённая игра', 'Останні ігри': 'Последние игры',
  'завершених ігор': 'завершённых игр', 'Гра': 'Игра', 'ігор': 'игр', 'Спільний архів ігор': 'Общий архив игр',
  'Ігор ще немає': 'Игр пока нет', 'Нікого не знайдено': 'Никого не найдено', 'Рейтинг ще порожній': 'Рейтинг пока пуст',
  'Архів ігор порожній': 'Архив игр пуст', 'Активну гру не знайдено': 'Активная игра не найдена', 'Номінацій ще немає': 'Номинаций пока нет',
  'Завершити гру': 'Завершить игру', 'Фінал гри': 'Финал игры', 'Протокол гри': 'Протокол игры', 'Налаштування гри': 'Настройки игры',
  'Bluetooth і музика': 'Bluetooth и музыка', 'Відтворити музику': 'Воспроизвести музыку', 'Призупинити музику': 'Приостановить музыку',
  'Керування звуком для гри': 'Управление звуком для игры', 'Як працює Bluetooth': 'Как работает Bluetooth', 'Як працює керування музикою': 'Как работает управление музыкой',
  'Bluetooth недоступний': 'Bluetooth недоступен', 'Можна вибрати BLE-пристрій': 'Можно выбрать BLE-устройство', 'Web Bluetooth не підтримується': 'Web Bluetooth не поддерживается',
  'Вибрати BLE-пристрій': 'Выбрать BLE-устройство', 'Відкриваємо список…': 'Открываем список…', 'Музика в Mafia': 'Музыка в Mafia',
  'Аудіофайл не обрано': 'Аудиофайл не выбран', 'Готово до відтворення.': 'Готово к воспроизведению.', 'Оберіть інший файл.': 'Выберите другой файл.',
  'Обрати аудіофайл': 'Выбрать аудиофайл', 'Прибрати': 'Убрать', 'Цей гравець уже має місце за столом': 'Этот игрок уже сидит за столом', 'Файл відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.': 'Файл воспроизводится локально, не загружается в сеть и действует до закрытия вкладки. Звук пойдёт на колонку, если она уже подключена к телефону.'
});

Object.assign(COPY.en, {
  'Навігація активної гри': 'Active game navigation', 'Активна гра': 'Active game',
  'Активні ігри': 'Live games', 'Триває зараз': 'Live now', 'Спостерігати': 'Watch',
  'Створити гру': 'Create game', 'Незавершена гра': 'Unfinished game', 'Останні ігри': 'Recent games',
  'завершених ігор': 'completed games', 'Гра': 'Game', 'ігор': 'games', 'Спільний архів ігор': 'Shared game archive',
  'Ігор ще немає': 'No games yet', 'Нікого не знайдено': 'No players found', 'Рейтинг ще порожній': 'The ranking is empty',
  'Архів ігор порожній': 'The game archive is empty', 'Активну гру не знайдено': 'No active game found', 'Номінацій ще немає': 'No nominations yet',
  'Завершити гру': 'End game', 'Фінал гри': 'Game result', 'Протокол гри': 'Game log', 'Налаштування гри': 'Game settings',
  'Bluetooth і музика': 'Bluetooth and music', 'Відтворити музику': 'Play music', 'Призупинити музику': 'Pause music',
  'Керування звуком для гри': 'Game audio controls', 'Як працює Bluetooth': 'How Bluetooth works', 'Як працює керування музикою': 'How music controls work',
  'Bluetooth недоступний': 'Bluetooth unavailable', 'Можна вибрати BLE-пристрій': 'A BLE device can be selected', 'Web Bluetooth не підтримується': 'Web Bluetooth is not supported',
  'Вибрати BLE-пристрій': 'Choose BLE device', 'Відкриваємо список…': 'Opening device list…', 'Музика в Mafia': 'Music in Mafia',
  'Аудіофайл не обрано': 'No audio file selected', 'Готово до відтворення.': 'Ready to play.', 'Оберіть інший файл.': 'Choose another file.',
  'Обрати аудіофайл': 'Choose audio file', 'Прибрати': 'Remove', 'Цей гравець уже має місце за столом': 'This player already has a seat', 'Файл відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.': 'The file plays locally, is never uploaded, and remains available until this tab is closed. Audio will use a speaker already connected to the phone.'
});

Object.assign(COPY.fr, {
  'Навігація активної гри': 'Navigation de la partie active', 'Активна гра': 'Partie active',
  'Активні ігри': 'Parties en cours', 'Триває зараз': 'En direct', 'Спостерігати': 'Regarder',
  'Створити гру': 'Créer une partie', 'Незавершена гра': 'Partie inachevée', 'Останні ігри': 'Parties récentes',
  'завершених ігор': 'parties terminées', 'Гра': 'Partie', 'ігор': 'parties', 'Спільний архів ігор': 'Archives partagées',
  'Ігор ще немає': 'Aucune partie', 'Нікого не знайдено': 'Aucun joueur trouvé', 'Рейтинг ще порожній': 'Le classement est vide',
  'Архів ігор порожній': 'Les archives sont vides', 'Активну гру не знайдено': 'Aucune partie active', 'Номінацій ще немає': 'Aucune nomination',
  'Завершити гру': 'Terminer la partie', 'Фінал гри': 'Résultat de la partie', 'Протокол гри': 'Compte rendu', 'Налаштування гри': 'Paramètres de la partie',
  'Bluetooth і музика': 'Bluetooth et musique', 'Відтворити музику': 'Lire la musique', 'Призупинити музику': 'Mettre la musique en pause',
  'Керування звуком для гри': 'Contrôle audio du jeu', 'Як працює Bluetooth': 'Fonctionnement du Bluetooth', 'Як працює керування музикою': 'Fonctionnement des commandes musicales',
  'Bluetooth недоступний': 'Bluetooth indisponible', 'Можна вибрати BLE-пристрій': 'Un appareil BLE peut être sélectionné', 'Web Bluetooth не підтримується': 'Web Bluetooth n’est pas pris en charge',
  'Вибрати BLE-пристрій': 'Choisir un appareil BLE', 'Відкриваємо список…': 'Ouverture de la liste…', 'Музика в Mafia': 'Musique dans Mafia',
  'Аудіофайл не обрано': 'Aucun fichier audio sélectionné', 'Готово до відтворення.': 'Prêt à lire.', 'Оберіть інший файл.': 'Choisissez un autre fichier.',
  'Обрати аудіофайл': 'Choisir un fichier audio', 'Прибрати': 'Retirer', 'Цей гравець уже має місце за столом': 'Ce joueur a déjà une place', 'Файл відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.': 'Le fichier est lu localement, n’est jamais téléversé et reste disponible jusqu’à la fermeture de l’onglet. Le son utilisera une enceinte déjà connectée au téléphone.'
});

Object.assign(COPY.ru, {
  'Місце': 'Место', 'Після перегляду роль автоматично сховається перед передачею телефона наступному гравцеві.': 'После просмотра роль автоматически скроется перед передачей телефона следующему игроку.',
  'Потрібне підтвердження': 'Нужно подтверждение', 'Завершення гри': 'Завершение игры', 'Оберіть команду-переможця. Результат одразу потрапить до протоколу та статистики.': 'Выберите команду-победителя. Результат сразу попадёт в протокол и статистику.',
  'Мирне місто': 'Мирный город', 'Історія подій': 'История событий'
});
Object.assign(COPY.en, {
  'Місце': 'Seat', 'Після перегляду роль автоматично сховається перед передачею телефона наступному гравцеві.': 'After viewing, the role is hidden automatically before the phone is passed to the next player.',
  'Потрібне підтвердження': 'Confirmation required', 'Завершення гри': 'Finish game', 'Оберіть команду-переможця. Результат одразу потрапить до протоколу та статистики.': 'Choose the winning team. The result is added to the game log and statistics immediately.',
  'Мирне місто': 'City', 'Історія подій': 'Event history'
});
Object.assign(COPY.fr, {
  'Місце': 'Place', 'Після перегляду роль автоматично сховається перед передачею телефона наступному гравцеві.': 'Après consultation, le rôle est automatiquement masqué avant de transmettre le téléphone au joueur suivant.',
  'Потрібне підтвердження': 'Confirmation requise', 'Завершення гри': 'Fin de la partie', 'Оберіть команду-переможця. Результат одразу потрапить до протоколу та статистики.': 'Choisissez l’équipe gagnante. Le résultat est immédiatement ajouté au compte rendu et aux statistiques.',
  'Мирне місто': 'Ville', 'Історія подій': 'Historique des événements'
});

Object.assign(COPY.ru, {
  'Кращий хід': 'Лучший ход', 'Кращий хід, сек': 'Лучший ход, сек',
  'Знайомство мафії': 'Знакомство мафии', 'Знайомство мафії, сек': 'Знакомство мафии, сек',
  'Позначення Шерифа': 'Обозначение Шерифа', 'Позначення Шерифа, сек': 'Обозначение Шерифа, сек',
  'Вільна посадка': 'Свободная посадка', 'Вільна посадка, сек': 'Свободная посадка, сек',
  'Мафія засинає': 'Мафия засыпает', 'Показати сигнал ведучого': 'Показать сигнал ведущего',
  'Записати КХ': 'Записать ЛХ', 'Без КХ': 'Без ЛХ', 'Завершити паузу': 'Завершить паузу',
  'Результат гри': 'Результат игры', 'Нічия': 'Ничья', 'Без переможця': 'Без победителя',
  'Скасувати результат': 'Отменить результат', 'Гру завершено нічиєю': 'Игра завершена вничью'
});
Object.assign(COPY.en, {
  'Кращий хід': 'Best move', 'Кращий хід, сек': 'Best move, sec',
  'Знайомство мафії': 'Mafia introduction', 'Знайомство мафії, сек': 'Mafia introduction, sec',
  'Позначення Шерифа': 'Sheriff identification', 'Позначення Шерифа, сек': 'Sheriff identification, sec',
  'Вільна посадка': 'Free seating', 'Вільна посадка, сек': 'Free seating, sec',
  'Мафія засинає': 'Mafia falls asleep', 'Показати сигнал ведучого': 'Show the host signal',
  'Записати КХ': 'Save best move', 'Без КХ': 'No best move', 'Завершити паузу': 'Finish pause',
  'Результат гри': 'Game result', 'Нічия': 'Draw', 'Без переможця': 'No winner',
  'Скасувати результат': 'Undo result', 'Гру завершено нічиєю': 'Game ended in a draw'
});
Object.assign(COPY.fr, {
  'Кращий хід': 'Meilleur choix', 'Кращий хід, сек': 'Meilleur choix, s',
  'Знайомство мафії': 'Présentation de la mafia', 'Знайомство мафії, сек': 'Présentation de la mafia, s',
  'Позначення Шерифа': 'Identification du Shérif', 'Позначення Шерифа, сек': 'Identification du Shérif, s',
  'Вільна посадка': 'Placement libre', 'Вільна посадка, сек': 'Placement libre, s',
  'Мафія засинає': 'La mafia s’endort', 'Показати сигнал ведучого': 'Afficher le signal de l’animateur',
  'Записати КХ': 'Enregistrer le choix', 'Без КХ': 'Sans choix', 'Завершити паузу': 'Terminer la pause',
  'Результат гри': 'Résultat de la partie', 'Нічия': 'Match nul', 'Без переможця': 'Sans vainqueur',
  'Скасувати результат': 'Annuler le résultat', 'Гру завершено нічиєю': 'La partie se termine par un nul'
});

Object.assign(COPY.ru, {
  'Аватар гравця': 'Аватар игрока', 'Змінити аватар': 'Изменить аватар',
  'Оберіть один із базових аватарів. Зміна збережеться у ручному профілі та буде видима іншим ведучим.': 'Выберите один из базовых аватаров. Изменение сохранится в ручном профиле и будет видно другим ведущим.',
  'Єнот': 'Енот', 'Кішка': 'Кошка', 'Капібара': 'Капибара', 'Мопс': 'Мопс', 'Лисиця': 'Лиса',
  'Сова': 'Сова', 'Хом’як': 'Хомяк', 'Лев': 'Лев', 'Жабка': 'Лягушка', 'Кабанчик': 'Кабан'
});
Object.assign(COPY.en, {
  'Аватар гравця': 'Player avatar', 'Змінити аватар': 'Change avatar',
  'Оберіть один із базових аватарів. Зміна збережеться у ручному профілі та буде видима іншим ведучим.': 'Choose one of the built-in avatars. The change is saved to the manual profile and visible to other hosts.',
  'Єнот': 'Raccoon', 'Кішка': 'Cat', 'Капібара': 'Capybara', 'Мопс': 'Pug', 'Лисиця': 'Fox',
  'Сова': 'Owl', 'Хом’як': 'Hamster', 'Лев': 'Lion', 'Жабка': 'Frog', 'Кабанчик': 'Boar'
});
Object.assign(COPY.fr, {
  'Аватар гравця': 'Avatar du joueur', 'Змінити аватар': 'Changer l’avatar',
  'Оберіть один із базових аватарів. Зміна збережеться у ручному профілі та буде видима іншим ведучим.': 'Choisissez un avatar prédéfini. La modification sera enregistrée dans le profil manuel et visible par les autres animateurs.',
  'Єнот': 'Raton laveur', 'Кішка': 'Chat', 'Капібара': 'Capybara', 'Мопс': 'Carlin', 'Лисиця': 'Renard',
  'Сова': 'Chouette', 'Хом’як': 'Hamster', 'Лев': 'Lion', 'Жабка': 'Grenouille', 'Кабанчик': 'Sanglier'
});

Object.assign(COPY.ru, {
  'Замовити напій': 'Заказать напиток', 'Замовлення напою': 'Заказ напитка',
  'Кав’ярня Enjoy': 'Кофейня Enjoy',
  'Оберіть напій — повідомлення відразу піде в Telegram.': 'Выберите напиток — сообщение сразу уйдёт в Telegram.',
  'Кава': 'Кофе', 'Чай': 'Чай', 'Капучино': 'Капучино', 'Лате': 'Латте',
  'Тестовий одержувач: @Chemelev': 'Тестовый получатель: @Chemelev',
  'Замовлення не надіслано': 'Заказ не отправлен', 'Замовлення надіслано': 'Заказ отправлен',
  '«Кава» — замовлення надіслано': '«Кофе» — заказ отправлен', '«Чай» — замовлення надіслано': '«Чай» — заказ отправлен',
  '«Капучино» — замовлення надіслано': '«Капучино» — заказ отправлен', '«Лате» — замовлення надіслано': '«Латте» — заказ отправлен',
  'Повідомлення передано тестовому одержувачу в Telegram.': 'Сообщение передано тестовому получателю в Telegram.',
  'Не вдалося надіслати замовлення': 'Не удалось отправить заказ'
});
Object.assign(COPY.en, {
  'Замовити напій': 'Order a drink', 'Замовлення напою': 'Drink order',
  'Кав’ярня Enjoy': 'Enjoy coffee shop',
  'Оберіть напій — повідомлення відразу піде в Telegram.': 'Choose a drink — the message will be sent to Telegram immediately.',
  'Кава': 'Coffee', 'Чай': 'Tea', 'Капучино': 'Cappuccino', 'Лате': 'Latte',
  'Тестовий одержувач: @Chemelev': 'Test recipient: @Chemelev',
  'Замовлення не надіслано': 'Order not sent', 'Замовлення надіслано': 'Order sent',
  '«Кава» — замовлення надіслано': 'Coffee — order sent', '«Чай» — замовлення надіслано': 'Tea — order sent',
  '«Капучино» — замовлення надіслано': 'Cappuccino — order sent', '«Лате» — замовлення надіслано': 'Latte — order sent',
  'Повідомлення передано тестовому одержувачу в Telegram.': 'The message was sent to the test recipient in Telegram.',
  'Не вдалося надіслати замовлення': 'Could not send the order'
});
Object.assign(COPY.fr, {
  'Замовити напій': 'Commander une boisson', 'Замовлення напою': 'Commande de boisson',
  'Кав’ярня Enjoy': 'Café Enjoy',
  'Оберіть напій — повідомлення відразу піде в Telegram.': 'Choisissez une boisson — le message sera immédiatement envoyé sur Telegram.',
  'Кава': 'Café', 'Чай': 'Thé', 'Капучино': 'Cappuccino', 'Лате': 'Latte',
  'Тестовий одержувач: @Chemelev': 'Destinataire de test : @Chemelev',
  'Замовлення не надіслано': 'Commande non envoyée', 'Замовлення надіслано': 'Commande envoyée',
  '«Кава» — замовлення надіслано': 'Café — commande envoyée', '«Чай» — замовлення надіслано': 'Thé — commande envoyée',
  '«Капучино» — замовлення надіслано': 'Cappuccino — commande envoyée', '«Лате» — замовлення надіслано': 'Latte — commande envoyée',
  'Повідомлення передано тестовому одержувачу в Telegram.': 'Le message a été envoyé au destinataire de test sur Telegram.',
  'Не вдалося надіслати замовлення': 'Impossible d’envoyer la commande'
});

Object.assign(COPY.ru, {
  'Фото синхронізовано': 'Фото синхронизировано',
  'Синхронізація фото…': 'Синхронизация фото…',
  'Фото ще не синхронізовано': 'Фото ещё не синхронизировано',
  'Фото очікує синхронізації': 'Фото ожидает синхронизации'
});
Object.assign(COPY.en, {
  'Фото синхронізовано': 'Photo synced',
  'Синхронізація фото…': 'Syncing photo…',
  'Фото ще не синхронізовано': 'Photo not synced yet',
  'Фото очікує синхронізації': 'Photo waiting to sync'
});
Object.assign(COPY.fr, {
  'Фото синхронізовано': 'Photo synchronisée',
  'Синхронізація фото…': 'Synchronisation de la photo…',
  'Фото ще не синхронізовано': 'Photo pas encore synchronisée',
  'Фото очікує синхронізації': 'Photo en attente de synchronisation'
});

Object.assign(COPY.ru, {
  'Онлайн': 'Онлайн', 'Офлайн': 'Офлайн',
  'Активність протягом останніх двох хвилин': 'Активность в течение последних двух минут',
  'Активності не було понад дві хвилини': 'Не было активности более двух минут'
});
Object.assign(COPY.en, {
  'Онлайн': 'Online', 'Офлайн': 'Offline',
  'Активність протягом останніх двох хвилин': 'Active within the last two minutes',
  'Активності не було понад дві хвилини': 'No activity for over two minutes'
});
Object.assign(COPY.fr, {
  'Онлайн': 'En ligne', 'Офлайн': 'Hors ligne',
  'Активність протягом останніх двох хвилин': 'Actif au cours des deux dernières minutes',
  'Активності не було понад дві хвилини': 'Aucune activité depuis plus de deux minutes'
});

const PATTERNS = {
  ru: [[/(\d+) хв/g, '$1 мин'], [/(\d+) год/g, '$1 ч'], [/(\d+) ігор/g, '$1 игр'], [/(\d+)% перемог/g, '$1% побед'], [/тимчасових (\d+)/g, 'временных $1'], [/черга (\d+)/g, 'очередь $1'], [/ · ведучий /g, ' · ведущий '], [/(\d+) гравців за столом/g, '$1 игроков за столом'], [/(\d+)\/10 живих/g, '$1/10 живых'], [/Екран бачить лише гравець №(\d+)/g, 'Экран видит только игрок №$1'], [/Змінити аватар/g, 'Изменить аватар']],
  en: [[/(\d+) хв/g, '$1 min'], [/(\d+) год/g, '$1 hr'], [/(\d+) ігор/g, '$1 games'], [/(\d+)% перемог/g, '$1% wins'], [/тимчасових (\d+)/g, '$1 temporary'], [/черга (\d+)/g, 'queue $1'], [/ · ведучий /g, ' · host '], [/(\d+) гравців за столом/g, '$1 players at the table'], [/(\d+)\/10 живих/g, '$1/10 alive'], [/Екран бачить лише гравець №(\d+)/g, 'Only player #$1 can see the screen'], [/Змінити аватар/g, 'Change avatar']],
  fr: [[/(\d+) хв/g, '$1 min'], [/(\d+) год/g, '$1 h'], [/(\d+) ігор/g, '$1 parties'], [/(\d+)% перемог/g, '$1 % de victoires'], [/тимчасових (\d+)/g, '$1 temporaires'], [/черга (\d+)/g, 'file $1'], [/ · ведучий /g, ' · animateur '], [/(\d+) гравців за столом/g, '$1 joueurs à table'], [/(\d+)\/10 живих/g, '$1/10 en vie'], [/Екран бачить лише гравець №(\d+)/g, 'Seul le joueur n°$1 voit l’écran'], [/Змінити аватар/g, 'Changer l’avatar']]
};

export function normalizeLanguage(value) {
  return LANGUAGES.some(language => language.code === value) ? value : 'uk';
}

export function languageLocale(value) {
  return LANGUAGES.find(language => language.code === normalizeLanguage(value))?.locale || 'uk-UA';
}

function translated(value, language) {
  if (language === 'uk' || !value) return value;
  const dictionary = COPY[language] || {};
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (dictionary[trimmed]) return value.replace(trimmed, dictionary[trimmed]);
  return (PATTERNS[language] || []).reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
}

export function applyLanguage(language) {
  const normalized = normalizeLanguage(language);
  document.documentElement.lang = normalized;
  try { localStorage.setItem('mafia-desk-language', normalized); } catch { /* IndexedDB remains authoritative. */ }
  return normalized;
}

export function localizeDom(root, language) {
  const normalized = normalizeLanguage(language);
  if (!root || normalized === 'uk') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    if (node.parentElement?.closest('[data-no-i18n]')) return;
    node.nodeValue = translated(node.nodeValue, normalized);
  });
  root.querySelectorAll('[placeholder], [aria-label], [title]').forEach(element => {
    ['placeholder', 'aria-label', 'title'].forEach(attribute => {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, translated(element.getAttribute(attribute), normalized));
    });
  });
}
