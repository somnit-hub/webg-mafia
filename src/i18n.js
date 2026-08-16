export const LANGUAGES = Object.freeze([
  { code: 'uk', label: 'Українська', locale: 'uk-UA' },
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
  { code: 'it', label: 'Italiano', locale: 'it-IT' }
]);

const COPY = {
  it: {
    'Огляд': 'Panoramica',
    'Гравці': 'Giocatori',
    'Фото гравця': 'Foto del giocatore',
    'Відкрити фото': 'Apri foto',
    'Нова гра': 'Nuova partita',
    'Статистика': 'Statistiche',
    'Ще': 'Di più',
    'Основна навігація': 'Navigazione principale',
    'Mafia — головна': 'Mafia — casa',
    'Встановити застосунок': 'Installa l\'app',
    'Профіль ведучого': 'Profilo dell\'ospite',
    'Пояснення': 'Aiuto',
    'Відкрити пояснення': 'Apri la guida',
    'Докладніше про синхронізацію': 'Informazioni sulla sincronizzazione',
    'Додати гравців': 'Aggiungi giocatori',
    'Продовжити': 'Continuare',
    'Усі': 'Tutto',
    'гравців у базі': 'giocatori nella directory',
    'перемог міста': 'vince la città',
    'середній час гри': 'durata media della partita',
    '+ Додати гравця': '+ Aggiungi giocatore',
    'Оновити': 'Aggiorna',
    'Наступна гра': 'Prossima partita',
    'До розсадки': 'Posti a sedere aperti',
    'Очистити': 'Chiaro',
    'Локальний': 'Locale',
    'Додано ведучим': 'Aggiunto dall\'host',
    'Назва': 'Titolo',
    'Правила й таймери': 'Regole e timer',
    'Музика гри': 'Musica di gioco',
    'Автоматична музика': 'Musica automatica',
    'Роздача ролей': 'Distribuzione dei ruoli',
    'Нульова ніч': 'Notte zero',
    'Нічні дії': 'Azioni notturne',
    'Результат ночі': 'Esito della notte',
    'Мелодія': 'Brano',
    'Прослухати': 'Ascolta',
    'Файл з пристрою': 'File dal dispositivo',
    'Увімкнено': 'Attivo',
    'Вимкнено': 'Disattivo',
    'Власний файл із пристрою': 'File personale dal dispositivo',
    'Розсадка': 'Posti a sedere',
    'Перемішати місця': 'Sedili mescolati',
    '+ Новий профіль': '+ Nuovo profilo',
    'Роздати ролі': 'Affrontare i ruoli',
    'Правила спортивної «Мафії»': 'Regole sportive Mafia',
    'Правила iMafia українською': 'iMafia regole in ucraino',
    'Міжнародний регламент ФІІМ': 'FIIM regole internazionali',
    'Налаштування': 'Impostazioni',
    'перемог мафії': 'mafia vince',
    'загальний час': 'tempo totale',
    'Результативність ролей': 'Prestazioni di ruolo',
    'Протокол': 'registro delle partite',
    'Видалити': 'Eliminare',
    'Домівка мафія-клубу': 'Sede del club Mafia',
    'Профіль Enjoy': 'Profilo Enjoy',
    'Редагувати': 'Modificare',
    'Вийти': 'disconnessione',
    'На цьому пристрої': 'Su questo dispositivo',
    'Мова застосунку': 'Lingua dell\'app',
    'Тема оформлення': 'Aspetto',
    'Темна': 'Buio',
    'Світла': 'Leggero',
    'Кав’ярня': 'Caffetteria',
    'Звукові сигнали таймера': 'Il timer suona',
    'Вібрація важливих дій': 'Feedback tattile',
    'Резервна копія Google Drive': 'Backup Google Drive',
    'Підключено': 'Collegato',
    'Не підключено': 'Non connesso',
    'Зберегти у Drive': 'Salva in Drive',
    'Відновити з Drive': 'Ripristina da Drive',
    'Відключити Drive': 'Scollegare Drive',
    'Увімкнути резервну копію': 'Backup Enable',
    'Режим оглядача': 'Modalità osservatore',
    'Відкрити публічний екран': 'Visualizzazione pubblica aperta',
    'Про застосунок': 'Informazioni sull\'app',
    'Мій профіль': 'Il mio profilo',
    'Зробити фото': 'Scatta una foto',
    'Обрати з галереї': 'Scegli dalla galleria',
    'Фото Google': 'Foto Google',
    'Ім’я *': 'Nome *',
    'Нікнейм': 'Soprannome',
    'Якщо заповнений, використовуватиметься як основне ім’я гравця під час гри.': 'Se compilato, verrà usato come nome principale del giocatore durante la partita.',
    'Вкажіть ім’я': 'Inserisci il nome',
    'Клуб або організація': 'Club o organizzazione',
    'Про себе': 'Su di me',
    'Показувати мене в каталозі Enjoy': 'Mostrami nella directory Enjoy',
    'Google-акаунт': 'Conto Google',
    'Підтверджено': 'Verificato',
    'Скасувати': 'Cancellare',
    'Зберегти профіль': 'Salva profilo',
    'Видалити профіль': 'Elimina profilo',
    'Закрити': 'Vicino',
    'Закрити це вікно': 'Chiudi questa finestra',
    'Досвід ведення, улюблена кава…': 'Esperienza di hosting, caffè preferito...',
    'Оберіть мову інтерфейсу. Налаштування зберігається на цьому пристрої.': 'Scegli la lingua dell\'interfaccia. Questa impostazione è memorizzata su questo dispositivo.',
    'Небезпечна дія': 'Zona pericolosa',
    'Видалення профілю потребує окремого підтвердження.': 'L\'eliminazione del tuo profilo richiede una conferma separata.'
  },
  en: {
    'Огляд': 'Overview',
    'Гравці': 'Players',
    'Фото гравця': 'Player photo',
    'Відкрити фото': 'Open photo',
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
    'середній час гри': 'average game duration',
    '+ Додати гравця': '+ Add player',
    'Оновити': 'Refresh',
    'Наступна гра': 'Next game',
    'До розсадки': 'Open seating',
    'Очистити': 'Clear',
    'Локальний': 'Local',
    'Додано ведучим': 'Added by host',
    'Назва': 'Title',
    'Правила й таймери': 'Rules and timers',
    'Музика гри': 'Game music',
    'Автоматична музика': 'Automatic music',
    'Роздача ролей': 'Role dealing',
    'Нульова ніч': 'Zero night',
    'Нічні дії': 'Night actions',
    'Результат ночі': 'Night result',
    'Мелодія': 'Track',
    'Прослухати': 'Preview',
    'Файл з пристрою': 'File from device',
    'Увімкнено': 'Enabled',
    'Вимкнено': 'Disabled',
    'Власний файл із пристрою': 'Custom file from device',
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
    'Домівка мафія-клубу': 'Home of the Mafia club',
    'Профіль Enjoy': 'Enjoy profile',
    'Редагувати': 'Edit',
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
    'Мій профіль': 'My profile',
    'Зробити фото': 'Take photo',
    'Обрати з галереї': 'Choose from gallery',
    'Фото Google': 'Google photo',
    'Ім’я *': 'Name *',
    'Нікнейм': 'Nickname',
    'Якщо заповнений, використовуватиметься як основне ім’я гравця під час гри.': 'If provided, this will be used as the player’s primary name during the game.',
    'Вкажіть ім’я': 'Enter the name',
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
    'Фото гравця': 'Photo du joueur',
    'Відкрити фото': 'Ouvrir la photo',
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
    'середній час гри': 'durée moyenne d’une partie',
    '+ Додати гравця': '+ Ajouter un joueur',
    'Оновити': 'Actualiser',
    'Наступна гра': 'Prochaine partie',
    'До розсадки': 'Voir le placement',
    'Очистити': 'Effacer',
    'Локальний': 'Local',
    'Додано ведучим': 'Ajouté par l’animateur',
    'Назва': 'Nom',
    'Правила й таймери': 'Règles et minuteurs',
    'Музика гри': 'Musique de la partie',
    'Автоматична музика': 'Musique automatique',
    'Роздача ролей': 'Distribution des rôles',
    'Нульова ніч': 'Nuit zéro',
    'Нічні дії': 'Actions nocturnes',
    'Результат ночі': 'Résultat de la nuit',
    'Мелодія': 'Morceau',
    'Прослухати': 'Écouter',
    'Файл з пристрою': 'Fichier de l’appareil',
    'Увімкнено': 'Activé',
    'Вимкнено': 'Désactivé',
    'Власний файл із пристрою': 'Fichier personnel de l’appareil',
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
    'Домівка мафія-клубу': 'Le foyer du club Mafia',
    'Профіль Enjoy': 'Profil Enjoy',
    'Редагувати': 'Modifier',
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
    'Мій профіль': 'Mon profil',
    'Зробити фото': 'Prendre une photo',
    'Обрати з галереї': 'Choisir dans la galerie',
    'Фото Google': 'Photo Google',
    'Ім’я *': 'Nom *',
    'Нікнейм': 'Pseudo',
    'Якщо заповнений, використовуватиметься як основне ім’я гравця під час гри.': 'S’il est renseigné, il sera utilisé comme nom principal du joueur pendant la partie.',
    'Вкажіть ім’я': 'Saisissez le nom',
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

Object.assign(COPY.it, {
  'Як дістатися': 'Indicazioni', 'Місто': 'Città', 'Каталог недоступний': 'Directory non disponibileble',
  'Синхронізовано': 'Sincronizzato', 'Офлайн-кеш': 'Cache offline', 'Синхронізація…': 'Sincronizzazione…', 'Помилка': 'Errore',
  'НАСТУПНА ГРА': 'PROSSIMA partita', 'без опису': 'nessuna descrizione', 'Очікує Google': 'In attesa di Google',
  'ПРОМОВА, СЕК': 'DISCORSO, SEC', 'ПОПІЛ, СЕК': 'DISCORSO DI TIE, SEZ', 'ОСТАННЄ СЛОВО, СЕК': 'ULTIMA PAROLA, SEC',
  'НІЧНА ДІЯ, СЕК': 'AZIONE NOTTURNA, SEC', 'СИСТЕМА ФОЛІВ': 'SISTEMA FALLOSO', 'Турнірна': 'Torneo', 'Клубна': 'Club',
  'Інші випадкові 10': 'Un altro 10 a caso', 'Тимчасовий гравець': 'Giocatore temporaneo',
  'Шериф': 'Sceriffo', 'Дон': 'Assistente', 'Мафія': 'Mafia', 'Мирний житель': 'Cittadino',
  'Червона команда': 'Squadra rossa', 'Чорна команда': 'Squadra nera',
  'Передайте телефон особисто': 'Consegnami il telefono di persona', 'Сховати й передати далі': 'Nascondi e trasmetti', 'Показати мою роль': 'Mostra il mio ruolo',
  'Створити гру': 'Crea corrispondenza', 'Немає гри': 'Nessuna corrispondenza',
  'Роздача ролей': 'Rivelazione del ruolo', 'Нульова ніч': 'Notte zero', 'Голосування': 'Voto',
  'Попіл · промови': 'Cravatta · discorsi', 'Попіл · голосування': 'Pareggio · voto',
  'Вихід усіх кандидатів': 'Elimina tutti i candidati', 'Останнє слово': 'L\'ultima parola', 'Гру завершено': 'partita finita',
  'Місто засинає': 'La città si addormenta', 'Мафія стріляє': 'Mafia spara', 'Дон шукає Шерифа': 'Don cerca lo sceriffo',
  'Шериф перевіряє місто': 'Lo sceriffo controlla la città', 'Місто прокидається': 'La città si sveglia', 'Чорна команда знайомиться': 'La squadra nera si incontra',
  'Публічний екран': 'Esposizione pubblica', 'Мафія прокидається': 'Mafia si sveglia', 'Почати день 1': 'Inizio giorno 1',
  'Пауза': 'Pausa', 'Старт': 'Inizio', 'Скинути': 'Reset', 'Коло завершено': 'Giro completato', 'Кандидатур немає': 'Nessun candidato',
  'Назад': 'Indietro', 'До голосування': 'Procedi alla votazione', 'Перейти до ночі': 'Procedi fino alla notte', 'Поточна промова': 'Discorso attuale',
  'Завершити коло': 'Finisci il giro', 'Наступний →': 'Avanti →', 'Повторне голосування': 'Rivotare',
  'Залишок останньому': 'Assegna il resto all\'ultimo', 'Підсумувати': 'Finalizzare', 'Голосувати': 'Votare', 'ПРОТИ': 'CONTRO',
  'Наступне слово →': 'Prossimo intervento →', 'Наступний день →': 'Il giorno dopo →', 'Ранок': 'Mattina', 'Далі: стрільба мафії': 'Successivo: tiro Mafia',
  'Промах': 'Mancare', 'Зафіксувати': 'Confermare', 'Продовжити': 'Continuare', 'Показати результат': 'Mostra risultato',
  'Далі': 'Prossimo', 'Змінити ціль': 'Cambia obiettivo', 'Сховати й далі': 'Nascondi e continua', 'Панель ведучого': 'Pannello ospite',
  'Сховати': 'Nascondere', 'Ролі': 'Ruoli', 'Таймери': 'Temporizzatori', 'Копіювати протокол': 'Copia il registro delle partite', 'Оглядач': 'Osservatore',
  'Подій ще немає': 'Nessun evento ancora', 'Публічна інформація': 'Informazioni pubbliche',
  'Немає кандидатів': 'Nessun candidato', 'Перемога мирного міста': 'La città vince',
  'Перемога чорної команди': 'Vince la squadra nera', 'Реванш': 'Rivincita', 'На головну': 'Casa',
  'Профіль гравця': 'Profilo del giocatore', 'Новий гравець': 'Nuovo giocatore', 'Зберегти': 'Salva'
});

Object.assign(COPY.en, {
  'Як дістатися': 'Directions', 'Місто': 'City', 'Каталог недоступний': 'Directory unavailable',
  'Синхронізовано': 'Synchronized', 'Офлайн-кеш': 'Offline cache', 'Синхронізація…': 'Synchronizing…', 'Помилка': 'Error',
  'НАСТУПНА ГРА': 'NEXT GAME', 'без опису': 'no description', 'Очікує Google': 'Awaiting Google',
  'ПРОМОВА, СЕК': 'SPEECH, SEC', 'ПОПІЛ, СЕК': 'TIE SPEECH, SEC', 'ОСТАННЄ СЛОВО, СЕК': 'LAST WORD, SEC',
  'НІЧНА ДІЯ, СЕК': 'NIGHT ACTION, SEC', 'СИСТЕМА ФОЛІВ': 'FOUL SYSTEM', 'Турнірна': 'Tournament', 'Клубна': 'Club',
  'Інші випадкові 10': 'Another random 10', 'Тимчасовий гравець': 'Temporary player',
  'Шериф': 'Sheriff', 'Дон': 'Don', 'Мафія': 'Mafia', 'Мирний житель': 'Citizen',
  'Червона команда': 'Red team', 'Чорна команда': 'Black team',
  'Передайте телефон особисто': 'Hand the phone over in person', 'Сховати й передати далі': 'Hide and pass on', 'Показати мою роль': 'Show my role',
  'Створити гру': 'Create game', 'Немає гри': 'No game',
  'Роздача ролей': 'Role reveal', 'Нульова ніч': 'Zero night', 'Голосування': 'Voting',
  'Попіл · промови': 'Tie · speeches', 'Попіл · голосування': 'Tie · voting',
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
  'ПРОМОВА, СЕК': 'DISCOURS, S', 'ПОПІЛ, СЕК': 'ÉGALITÉ, S', 'ОСТАННЄ СЛОВО, СЕК': 'DERNIER MOT, S',
  'НІЧНА ДІЯ, СЕК': 'ACTION DE NUIT, S', 'СИСТЕМА ФОЛІВ': 'SYSTÈME DE FAUTES', 'Турнірна': 'Tournoi', 'Клубна': 'Club',
  'Інші випадкові 10': '10 autres au hasard', 'Тимчасовий гравець': 'Joueur temporaire',
  'Шериф': 'Shérif', 'Дон': 'Don', 'Мафія': 'Mafia', 'Мирний житель': 'Citoyen',
  'Червона команда': 'Équipe rouge', 'Чорна команда': 'Équipe noire',
  'Передайте телефон особисто': 'Remettez le téléphone en main propre', 'Сховати й передати далі': 'Masquer et transmettre', 'Показати мою роль': 'Afficher mon rôle',
  'Створити гру': 'Créer une partie', 'Немає гри': 'Aucune partie',
  'Роздача ролей': 'Révélation des rôles', 'Нульова ніч': 'Nuit zéro', 'Голосування': 'Vote',
  'Попіл · промови': 'Égalité · discours', 'Попіл · голосування': 'Égalité · vote',
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

Object.assign(COPY.it, {
  'Навігація активної гри': 'Navigazione partita attiva', 'Активна гра': 'Partita attiva',
  'Активні ігри': 'Partite dal vivo', 'Триває зараз': 'Vivi adesso', 'Спостерігати': 'Orologio',
  'Створити гру': 'Crea corrispondenza', 'Незавершена гра': 'Partita incompiuta', 'Останні ігри': 'Partite recenti',
  'завершених ігор': 'partite completate', 'Гра': 'incontro', 'ігор': 'partite', 'Спільний архів ігор': 'Archivio condiviso delle partite',
  'Ігор ще немає': 'Nessuna corrispondenza ancora', 'Нікого не знайдено': 'Nessun giocatore trovato', 'Рейтинг ще порожній': 'La classifica è vuota',
  'Архів ігор порожній': 'L\'archivio delle partite è vuoto', 'Активну гру не знайдено': 'Nessuna corrispondenza attiva trovata', 'Номінацій ще немає': 'Nessuna nomination ancora',
  'Завершити гру': 'Fine della partita', 'Фінал гри': 'risultato della partita', 'Протокол гри': 'registro delle partite', 'Налаштування гри': 'impostazioni della partita',
  'Bluetooth і музика': 'Bluetooth e musica', 'Відтворити музику': 'Riproduci musica', 'Призупинити музику': 'Metti in pausa la musica',
  'Керування звуком для гри': 'abbinare i controlli audio', 'Як працює Bluetooth': 'Come funziona Bluetooth', 'Як працює керування музикою': 'Come funzionano i controlli della musica',
  'Bluetooth недоступний': 'Bluetooth non disponibileble', 'Можна вибрати BLE-пристрій': 'È possibile selezionare un dispositivo BLE', 'Web Bluetooth не підтримується': 'Web Bluetooth non è supportato',
  'Вибрати BLE-пристрій': 'Scegli il dispositivo BLE', 'Відкриваємо список…': 'Apertura dell\'elenco dei dispositivi…', 'Музика в Mafia': 'Musica in Mafia',
  'Аудіофайл не обрано': 'Nessun file audio selezionato', 'Готово до відтворення.': 'Pronto per giocare.', 'Оберіть інший файл.': 'Scegli un altro file.',
  'Обрати аудіофайл': 'Scegli il file audio', 'Прибрати': 'Rimuovere', 'Цей гравець уже має місце за столом': 'Questo giocatore ha già un posto', 'Файл відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.': 'Il file viene riprodotto localmente, non viene mai caricato e rimane disponibileble finché questa scheda non viene chiusa. L\'audio utilizzerà un altoparlante già collegato al telefono.'
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

Object.assign(COPY.it, {
  'Місце': 'Posto a sedere', 'Після перегляду роль автоматично сховається перед передачею телефона наступному гравцеві.': 'Dopo la visualizzazione, il ruolo viene nascosto automaticamente prima che il telefono venga passato al giocatore successivo.',
  'Потрібне підтвердження': 'È necessaria la conferma', 'Завершення гри': 'Termina la partita', 'Оберіть команду-переможця. Результат одразу потрапить до протоколу та статистики.': 'Scegli la squadra vincente. Il risultato viene aggiunto immediatamente al registro della partita e alle statistiche.',
  'Мирне місто': 'Città', 'Історія подій': 'Storia degli eventi'
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

Object.assign(COPY.it, {
  'Кращий хід': 'La mossa migliore', 'Кращий хід, сек': 'La mossa migliore, sez',
  'Знайомство мафії': 'Introduzione Mafia', 'Знайомство мафії, сек': 'Mafia introduzione, sez',
  'Позначення Шерифа': 'Identificazione dello sceriffo', 'Позначення Шерифа, сек': 'Identificazione dello sceriffo, sez',
  'Вільна посадка': 'Posti a sedere gratuiti', 'Вільна посадка, сек': 'Posti a sedere liberi, sez',
  'Мафія засинає': 'Mafia si addormenta', 'Показати сигнал ведучого': 'Mostra il segnale dell\'host',
  'Записати КХ': 'Salva la mossa migliore', 'Без КХ': 'Nessuna mossa migliore', 'Завершити паузу': 'Fine della pausa',
  'Результат гри': 'risultato della partita', 'Нічия': 'Disegno', 'Без переможця': 'Nessun vincitore',
  'Скасувати результат': 'Annulla risultato', 'Гру завершено нічиєю': 'la partita finì in pareggio'
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

Object.assign(COPY.it, {
  'Аватар гравця': 'Avatar del giocatore', 'Змінити аватар': 'Cambia avatar',
  'Оберіть один із базових аватарів. Зміна збережеться у ручному профілі та буде видима іншим ведучим.': 'Scegli uno degli avatar integrati. La modifica viene salvata nel profilo manuale e visible su altri host.',
  'Єнот': 'Procione', 'Кішка': 'Gatto', 'Капібара': 'Capibara', 'Мопс': 'Carlino', 'Лисиця': 'Volpe',
  'Сова': 'Gufo', 'Хом’як': 'Criceto', 'Лев': 'Leone', 'Жабка': 'Rana', 'Кабанчик': 'Cinghiale'
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

Object.assign(COPY.it, {
  'Замовити напій': 'Ordina un drink', 'Замовлення': 'Ordine',
  'Кав’ярня Enjoy': 'Caffetteria Enjoy',
  'Оберіть категорію — потім потрібну позицію.': 'Scegli una categoria e poi l’articolo desiderato.',
  'Оберіть позицію — повідомлення відразу піде в Telegram.': 'Scegli un articolo: il messaggio verrà inviato subito a Telegram.',
  'До категорій': 'Torna alle categorie',
  'Оберіть напій — повідомлення відразу піде в Telegram.': 'Scegli una bevanda: il messaggio verrà inviato immediatamente a Telegram.',
  'Кава': 'Caffè', 'Чай': 'Tè', 'Капучино': 'Cappuccino', 'Лате': 'Latte macchiato',
  'Замовлення не надіслано': 'Ordine non inviato', 'Замовлення надіслано': 'Ordine inviato',
  '«Кава» — замовлення надіслано': 'Caffè: ordine inviato', '«Чай» — замовлення надіслано': 'Tè: ordine inviato',
  '«Капучино» — замовлення надіслано': 'Cappuccino: ordine inviato', '«Лате» — замовлення надіслано': 'Latte: ordine inviato',
  'Повідомлення передано в Telegram.': 'Il messaggio è stato inviato su Telegram.',
  'Не вдалося надіслати замовлення': 'Impossibile inviare l\'ordine'
});
Object.assign(COPY.en, {
  'Замовити напій': 'Order a drink', 'Замовлення': 'Order',
  'Кав’ярня Enjoy': 'Enjoy coffee shop',
  'Оберіть категорію — потім потрібну позицію.': 'Choose a category, then the item you want.',
  'Оберіть позицію — повідомлення відразу піде в Telegram.': 'Choose an item — the message will be sent to Telegram immediately.',
  'До категорій': 'Back to categories',
  'Оберіть напій — повідомлення відразу піде в Telegram.': 'Choose a drink — the message will be sent to Telegram immediately.',
  'Кава': 'Coffee', 'Чай': 'Tea', 'Капучино': 'Cappuccino', 'Лате': 'Latte',
  'Замовлення не надіслано': 'Order not sent', 'Замовлення надіслано': 'Order sent',
  '«Кава» — замовлення надіслано': 'Coffee — order sent', '«Чай» — замовлення надіслано': 'Tea — order sent',
  '«Капучино» — замовлення надіслано': 'Cappuccino — order sent', '«Лате» — замовлення надіслано': 'Latte — order sent',
  'Повідомлення передано в Telegram.': 'The message was sent to Telegram.',
  'Не вдалося надіслати замовлення': 'Could not send the order'
});
Object.assign(COPY.fr, {
  'Замовити напій': 'Commander une boisson', 'Замовлення': 'Commande',
  'Кав’ярня Enjoy': 'Café Enjoy',
  'Оберіть категорію — потім потрібну позицію.': 'Choisissez une catégorie, puis l’article souhaité.',
  'Оберіть позицію — повідомлення відразу піде в Telegram.': 'Choisissez un article — le message sera immédiatement envoyé sur Telegram.',
  'До категорій': 'Retour aux catégories',
  'Оберіть напій — повідомлення відразу піде в Telegram.': 'Choisissez une boisson — le message sera immédiatement envoyé sur Telegram.',
  'Кава': 'Café', 'Чай': 'Thé', 'Капучино': 'Cappuccino', 'Лате': 'Latte',
  'Замовлення не надіслано': 'Commande non envoyée', 'Замовлення надіслано': 'Commande envoyée',
  '«Кава» — замовлення надіслано': 'Café — commande envoyée', '«Чай» — замовлення надіслано': 'Thé — commande envoyée',
  '«Капучино» — замовлення надіслано': 'Cappuccino — commande envoyée', '«Лате» — замовлення надіслано': 'Latte — commande envoyée',
  'Повідомлення передано в Telegram.': 'Le message a été envoyé sur Telegram.',
  'Не вдалося надіслати замовлення': 'Impossible d’envoyer la commande'
});

Object.assign(COPY.it, {
  'Фото синхронізовано': 'Foto sincronizzata',
  'Синхронізація фото…': 'Sincronizzazione foto...',
  'Фото ще не синхронізовано': 'Foto non ancora sincronizzata',
  'Фото очікує синхронізації': 'Foto in attesa di sincronizzazione'
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

Object.assign(COPY.it, {
  'Онлайн': 'In linea', 'Офлайн': 'Non in linea',
  'Активність протягом останніх двох хвилин': 'Attivo negli ultimi due minuti',
  'Активності не було понад дві хвилини': 'Nessuna attività per più di due minuti'
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

Object.assign(COPY.it, {
  'Скасувати гру': 'Annulla la partita', 'Скасувати гру?': 'Annullare la partita?',
  'Активну гру буде видалено без переможця. Вона не потрапить до статистики й протоколів. Якщо склад збережений на цьому пристрої, його гравці повернуться до наступної гри.': 'La partita attiva verrà eliminata senza un vincitore. Non verrà aggiunto alle statistiche o ai registri delle partite. Se la formazione è memorizzata su questo dispositivo, i suoi giocatori torneranno alla partita successiva.'
});
Object.assign(COPY.en, {
  'Скасувати гру': 'Cancel game', 'Скасувати гру?': 'Cancel the game?',
  'Активну гру буде видалено без переможця. Вона не потрапить до статистики й протоколів. Якщо склад збережений на цьому пристрої, його гравці повернуться до наступної гри.': 'The active game will be deleted without a winner. It will not be added to statistics or game logs. If the lineup is stored on this device, its players will return to the next game.'
});
Object.assign(COPY.fr, {
  'Скасувати гру': 'Annuler la partie', 'Скасувати гру?': 'Annuler la partie ?',
  'Активну гру буде видалено без переможця. Вона не потрапить до статистики й протоколів. Якщо склад збережений на цьому пристрої, його гравці повернуться до наступної гри.': 'La partie active sera supprimée sans vainqueur. Elle ne figurera ni dans les statistiques ni dans les comptes rendus. Si la composition est enregistrée sur cet appareil, ses joueurs reviendront pour la prochaine partie.'
});

Object.assign(COPY.it, {
  'Оберіть дію': 'Scegli un\'azione', 'Підключити Bluetooth-пристрій': 'Collega un dispositivo Bluetooth',
  'Відкрити музику з пристрою': 'Apri la musica da questo dispositivo', 'Відкрити системний список пристроїв': 'Apri l\'elenco dei dispositivi di sistema',
  'Показати інструкцію для iPhone': 'Mostra le istruzioni dell\'iPhone', 'Вибрати доступний BLE-пристрій': 'Scegli un dispositivo ble BLE disponibile',
  'Показати системну інструкцію': 'Mostra le istruzioni del sistema', 'Підключення Bluetooth': 'Collegamento Bluetooth',
  'Відкрити Bluetooth': 'Apri Bluetooth', 'MP3, M4A, WAV та інші аудіофайли': 'MP3, M4A, WAV e altri file audio',
  'Музика відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.': 'La musica viene riprodotta localmente, non viene mai caricata e rimane disponibileble finché questa scheda non viene chiusa. L\'audio utilizzerà un altoparlante già collegato al telefono.'
});
Object.assign(COPY.en, {
  'Оберіть дію': 'Choose an action', 'Підключити Bluetooth-пристрій': 'Connect a Bluetooth device',
  'Відкрити музику з пристрою': 'Open music from this device', 'Відкрити системний список пристроїв': 'Open the system device list',
  'Показати інструкцію для iPhone': 'Show iPhone instructions', 'Вибрати доступний BLE-пристрій': 'Choose an available BLE device',
  'Показати системну інструкцію': 'Show system instructions', 'Підключення Bluetooth': 'Bluetooth connection',
  'Відкрити Bluetooth': 'Open Bluetooth', 'MP3, M4A, WAV та інші аудіофайли': 'MP3, M4A, WAV, and other audio files',
  'Музика відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.': 'Music plays locally, is never uploaded, and remains available until this tab is closed. Audio will use a speaker already connected to the phone.'
});
Object.assign(COPY.fr, {
  'Оберіть дію': 'Choisissez une action', 'Підключити Bluetooth-пристрій': 'Connecter un appareil Bluetooth',
  'Відкрити музику з пристрою': 'Ouvrir la musique depuis l’appareil', 'Відкрити системний список пристроїв': 'Ouvrir la liste système des appareils',
  'Показати інструкцію для iPhone': 'Afficher les instructions pour iPhone', 'Вибрати доступний BLE-пристрій': 'Choisir un appareil BLE disponible',
  'Показати системну інструкцію': 'Afficher les instructions système', 'Підключення Bluetooth': 'Connexion Bluetooth',
  'Відкрити Bluetooth': 'Ouvrir Bluetooth', 'MP3, M4A, WAV та інші аудіофайли': 'MP3, M4A, WAV et autres fichiers audio',
  'Музика відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.': 'La musique est lue localement, n’est jamais téléversée et reste disponible jusqu’à la fermeture de l’onglet. Le son utilisera une enceinte déjà connectée au téléphone.'
});

// Curated Mafia terminology and primary interface actions.
Object.assign(COPY.it, {
  'Ще': 'Altro', 'Mafia — головна': 'Mafia — pagina principale', 'Профіль ведучого': 'Profilo del conduttore',
  'Продовжити': 'Continua', 'Усі': 'Tutti', 'середній час гри': 'durata media della partita',
  'До розсадки': 'Vai alla disposizione', 'Очистити': 'Svuota', 'Додано ведучим': 'Aggiunto dal conduttore',
  'Розсадка': 'Disposizione', 'Перемішати місця': 'Mescola i posti', 'Роздати ролі': 'Distribuisci i ruoli',
  'Правила iMafia українською': 'Regole iMafia in ucraino', 'Міжнародний регламент ФІІМ': 'Regolamento internazionale FIIM',
  'Протокол': 'Registro della partita', 'Видалити': 'Elimina', 'Редагувати': 'Modifica', 'Вийти': 'Esci',
  'Резервна копія Google Drive': 'Copia di sicurezza Google Drive',
  'Темна': 'Scuro', 'Світла': 'Chiaro', 'Звукові сигнали таймера': 'Suoni del timer',
  'Увімкнути резервну копію': 'Attiva la copia di sicurezza', 'Відкрити публічний екран': 'Apri lo schermo pubblico',
  'Google-акаунт': 'Account Google', 'Скасувати': 'Annulla', 'Закрити': 'Chiudi',
  'Каталог недоступний': 'Directory non disponibile', 'НАСТУПНА ГРА': 'PROSSIMA PARTITA',
  'ПОПІЛ, СЕК': 'PAREGGIO, SEC', 'СИСТЕМА ФОЛІВ': 'SISTEMA DEI FALLI',
  'Дон': 'Don', 'Передайте телефон особисто': 'Passa il telefono di persona',
  'Сховати й передати далі': 'Nascondi e passa oltre', 'Створити гру': 'Crea partita', 'Немає гри': 'Nessuna partita',
  'Роздача ролей': 'Distribuzione dei ruoli', 'Попіл · промови': 'Pareggio · interventi',
  'Попіл · голосування': 'Pareggio · votazione', 'Гру завершено': 'Partita terminata',
  'Старт': 'Avvia', 'Коло завершено': 'Turno completato', 'Перейти до ночі': 'Passa alla notte',
  'Поточна промова': 'Intervento attuale', 'Завершити коло': 'Termina il turno',
  'Повторне голосування': 'Nuova votazione', 'Підсумувати': 'Conferma il risultato', 'Голосувати': 'Vota',
  'Наступне слово →': 'Intervento successivo →', 'Наступний день →': 'Giorno successivo →',
  'Промах': 'Mancato', 'Зафіксувати': 'Conferma', 'Далі': 'Avanti', 'Сховати й далі': 'Nascondi e continua',
  'Панель ведучого': 'Pannello del conduttore', 'Показати сигнал ведучого': 'Mostra il segnale del conduttore',
  'Сховати': 'Nascondi', 'Таймери': 'Timer', 'Копіювати протокол': 'Copia il registro della partita',
  'На головну': 'Pagina principale',
  'Навігація активної гри': 'Navigazione della partita attiva', 'Активні ігри': 'Partite attive',
  'Триває зараз': 'In corso', 'Спостерігати': 'Osserva', 'Незавершена гра': 'Partita incompleta',
  'Гра': 'Partita', 'Ігор ще немає': 'Nessuna partita', 'Активну гру не знайдено': 'Nessuna partita attiva trovata',
  'Завершити гру': 'Termina la partita', 'Фінал гри': 'Risultato della partita',
  'Протокол гри': 'Registro della partita', 'Налаштування гри': 'Impostazioni della partita',
  'Керування звуком для гри': 'Controlli audio della partita', 'Bluetooth недоступний': 'Bluetooth non disponibile',
  'Готово до відтворення.': 'Pronto per la riproduzione.',
  'Оберіть один із базових аватарів. Зміна збережеться у ручному профілі та буде видима іншим ведучим.': 'Scegli uno degli avatar disponibili. La modifica verrà salvata nel profilo manuale e sarà visibile agli altri conduttori.',
  'Вибрати доступний BLE-пристрій': 'Scegli un dispositivo BLE disponibile',
  'Музика відтворюється локально, не завантажується в мережу й діє до закриття вкладки. Звук піде на колонку, якщо вона вже підключена до телефона.': 'La musica viene riprodotta localmente, non viene caricata online e resta disponibile fino alla chiusura della scheda. L’audio verrà riprodotto dall’altoparlante già collegato al telefono.'
});

Object.assign(COPY.it, {
  'Персональна статистика': 'Statistiche personali', 'Моя статистика': 'Le mie statistiche', 'Історія ігор': 'Cronologia partite',
  'перемог': 'vittorie', 'результативність': 'percentuale di vittorie', 'часта роль': 'ruolo più frequente',
  'Ігор у профілі ще немає': 'Nessuna partita in questo profilo', 'Зайшла': 'Mi è piaciuta', 'Гірчить': 'Non mi è piaciuta',
  'Мозок закипів': 'Cervello in fiamme', 'Оскар за брехню': 'Oscar per la bugia', 'Стіл палав': 'Tavolo in fiamme',
  'Цирк Enjoy': 'Circo Enjoy', 'Винесли красиво': 'Eliminato con stile', 'Оцінку збережено анонімно': 'Valutazione salvata in forma anonima',
  'Зберігаємо анонімно…': 'Salvataggio anonimo…', 'Ваш вибір бачите тільки ви. Іншим учасникам доступне лише спільне зведення після трьох оцінок.': 'Solo tu puoi vedere la tua scelta. Gli altri partecipanti vedono soltanto il riepilogo dopo tre valutazioni.'
});
Object.assign(COPY.en, {
  'Персональна статистика': 'Personal statistics', 'Моя статистика': 'My statistics', 'Історія ігор': 'Game history',
  'перемог': 'wins', 'результативність': 'win rate', 'часта роль': 'most frequent role',
  'Ігор у профілі ще немає': 'No games in this profile yet', 'Зайшла': 'Loved it', 'Гірчить': 'Not for me',
  'Мозок закипів': 'Brain overheated', 'Оскар за брехню': 'Oscar-worthy lie', 'Стіл палав': 'Table on fire',
  'Цирк Enjoy': 'Enjoy circus', 'Винесли красиво': 'Eliminated in style', 'Оцінку збережено анонімно': 'Rating saved anonymously',
  'Зберігаємо анонімно…': 'Saving anonymously…', 'Ваш вибір бачите тільки ви. Іншим учасникам доступне лише спільне зведення після трьох оцінок.': 'Only you can see your choice. Other participants see only the summary after three ratings.'
});
Object.assign(COPY.fr, {
  'Персональна статистика': 'Statistiques personnelles', 'Моя статистика': 'Mes statistiques', 'Історія ігор': 'Historique des parties',
  'перемог': 'victoires', 'результативність': 'taux de victoire', 'часта роль': 'rôle le plus fréquent',
  'Ігор у профілі ще немає': 'Aucune partie dans ce profil', 'Зайшла': 'J’ai adoré', 'Гірчить': 'Pas pour moi',
  'Мозок закипів': 'Cerveau en surchauffe', 'Оскар за брехню': 'Oscar du mensonge', 'Стіл палав': 'Table en feu',
  'Цирк Enjoy': 'Cirque Enjoy', 'Винесли красиво': 'Éliminé avec style', 'Оцінку збережено анонімно': 'Note enregistrée anonymement',
  'Зберігаємо анонімно…': 'Enregistrement anonyme…', 'Ваш вибір бачите тільки ви. Іншим учасникам доступне лише спільне зведення після трьох оцінок.': 'Vous seul voyez votre choix. Les autres participants ne voient que le résumé après trois évaluations.'
});

Object.assign(COPY.it, {
  'Спосіб роздачі ролей': 'Modalità di distribuzione dei ruoli',
  'За обраною цифрою': 'Per numero scelto',
  'Автоматично': 'Automaticamente',
  'Активні ігри недоступні': 'Partite attive non disponibili',
  'Шукаємо активні ігри…': 'Ricerca delle partite attive…',
  'Активних ігор зараз немає': 'Nessuna partita attiva al momento',
  'Коли ведучий почне гру, тут з’явиться кнопка «Спостерігати».': 'Quando il conduttore avvia una partita, qui apparirà il pulsante «Osserva».'
});
Object.assign(COPY.en, {
  'Спосіб роздачі ролей': 'Role dealing method',
  'За обраною цифрою': 'By chosen number',
  'Автоматично': 'Automatically',
  'Активні ігри недоступні': 'Live games are unavailable',
  'Шукаємо активні ігри…': 'Looking for live games…',
  'Активних ігор зараз немає': 'There are no live games right now',
  'Коли ведучий почне гру, тут з’явиться кнопка «Спостерігати».': 'When the host starts a game, the «Watch» button will appear here.'
});
Object.assign(COPY.fr, {
  'Спосіб роздачі ролей': 'Mode de distribution des rôles',
  'За обраною цифрою': 'Par numéro choisi',
  'Автоматично': 'Automatiquement',
  'Активні ігри недоступні': 'Parties en cours indisponibles',
  'Шукаємо активні ігри…': 'Recherche des parties en cours…',
  'Активних ігор зараз немає': 'Aucune partie en cours actuellement',
  'Коли ведучий почне гру, тут з’явиться кнопка «Спостерігати».': 'Lorsque l’animateur démarre une partie, le bouton «Regarder» apparaît ici.'
});

Object.assign(COPY.it, {
  'Анонімна оцінка': 'Valutazione anonima', 'сподобалась': 'piaciuta', 'не сподобалась': 'non piaciuta',
  'Завантажуємо анонімні оцінки…': 'Caricamento delle valutazioni anonime…', 'Оцінки тимчасово недоступні': 'Valutazioni temporaneamente non disponibili'
});
Object.assign(COPY.en, {
  'Анонімна оцінка': 'Anonymous rating', 'сподобалась': 'liked it', 'не сподобалась': 'did not like it',
  'Завантажуємо анонімні оцінки…': 'Loading anonymous ratings…', 'Оцінки тимчасово недоступні': 'Ratings are temporarily unavailable'
});
Object.assign(COPY.fr, {
  'Анонімна оцінка': 'Évaluation anonyme', 'сподобалась': 'aimée', 'не сподобалась': 'pas aimée',
  'Завантажуємо анонімні оцінки…': 'Chargement des évaluations anonymes…', 'Оцінки тимчасово недоступні': 'Évaluations temporairement indisponibles'
});

Object.assign(COPY.it, {
  'Встановити на iPhone': 'Installa su iPhone',
  'Встановлення на iPhone': 'Installazione su iPhone',
  'Додайте Mafia Enjoy на головний екран — застосунок відкриватиметься без панелей браузера.': 'Aggiungi Mafia Enjoy alla schermata Home: l’app si aprirà senza le barre del browser.',
  'Натисніть «Поділитися»': 'Tocca «Condividi»',
  'У Safari це квадрат зі стрілкою вгору.': 'In Safari è il quadrato con una freccia verso l’alto.',
  'Оберіть «На екран “Домівка”»': 'Scegli «Aggiungi alla schermata Home»',
  'Якщо пункту немає, відкрийте цю сторінку в Safari.': 'Se l’opzione non è presente, apri questa pagina in Safari.',
  'Натисніть «Додати»': 'Tocca «Aggiungi»',
  'Після цього запускайте Mafia Enjoy з нової іконки на екрані iPhone.': 'Quindi avvia Mafia Enjoy dalla nuova icona sullo schermo dell’iPhone.',
  'Відкрийте основну адресу': 'Apri l’indirizzo principale',
  'Для надійного Google-входу на iPhone встановлюйте застосунок із mafia-cafe.web.app.': 'Per un accesso Google affidabile su iPhone, installa l’app da mafia-cafe.web.app.',
  'Відкрити адресу для iPhone': 'Apri l’indirizzo per iPhone',
  'Готово': 'Fatto',
  'Mafia Enjoy встановлено': 'Mafia Enjoy è stata installata'
});
Object.assign(COPY.en, {
  'Встановити на iPhone': 'Install on iPhone',
  'Встановлення на iPhone': 'Install on iPhone',
  'Додайте Mafia Enjoy на головний екран — застосунок відкриватиметься без панелей браузера.': 'Add Mafia Enjoy to your Home Screen so it opens without browser bars.',
  'Натисніть «Поділитися»': 'Tap Share',
  'У Safari це квадрат зі стрілкою вгору.': 'In Safari, it is the square with an upward arrow.',
  'Оберіть «На екран “Домівка”»': 'Choose “Add to Home Screen”',
  'Якщо пункту немає, відкрийте цю сторінку в Safari.': 'If the option is missing, open this page in Safari.',
  'Натисніть «Додати»': 'Tap Add',
  'Після цього запускайте Mafia Enjoy з нової іконки на екрані iPhone.': 'Then launch Mafia Enjoy from its new icon on your iPhone.',
  'Відкрийте основну адресу': 'Open the primary address',
  'Для надійного Google-входу на iPhone встановлюйте застосунок із mafia-cafe.web.app.': 'For reliable Google sign-in on iPhone, install the app from mafia-cafe.web.app.',
  'Відкрити адресу для iPhone': 'Open the iPhone address',
  'Готово': 'Done',
  'Mafia Enjoy встановлено': 'Mafia Enjoy is installed'
});
Object.assign(COPY.fr, {
  'Встановити на iPhone': 'Installer sur iPhone',
  'Встановлення на iPhone': 'Installation sur iPhone',
  'Додайте Mafia Enjoy на головний екран — застосунок відкриватиметься без панелей браузера.': 'Ajoutez Mafia Enjoy à l’écran d’accueil pour l’ouvrir sans les barres du navigateur.',
  'Натисніть «Поділитися»': 'Touchez «Partager»',
  'У Safari це квадрат зі стрілкою вгору.': 'Dans Safari, c’est le carré avec une flèche vers le haut.',
  'Оберіть «На екран “Домівка”»': 'Choisissez «Sur l’écran d’accueil»',
  'Якщо пункту немає, відкрийте цю сторінку в Safari.': 'Si l’option n’apparaît pas, ouvrez cette page dans Safari.',
  'Натисніть «Додати»': 'Touchez «Ajouter»',
  'Після цього запускайте Mafia Enjoy з нової іконки на екрані iPhone.': 'Lancez ensuite Mafia Enjoy depuis sa nouvelle icône sur l’iPhone.',
  'Відкрийте основну адресу': 'Ouvrez l’adresse principale',
  'Для надійного Google-входу на iPhone встановлюйте застосунок із mafia-cafe.web.app.': 'Pour une connexion Google fiable sur iPhone, installez l’app depuis mafia-cafe.web.app.',
  'Відкрити адресу для iPhone': 'Ouvrir l’adresse pour iPhone',
  'Готово': 'Terminé',
  'Mafia Enjoy встановлено': 'Mafia Enjoy est installée'
});

Object.assign(COPY.it, {
  'Місце / клуб': 'Luogo / club', 'Пошук місця або клубу': 'Cerca luogo o club', '+ Додати': '+ Aggiungi',
  'Нове місце / клуб': 'Nuovo luogo / club', 'Спільний каталог': 'Catalogo condiviso', 'Назва *': 'Nome *',
  'Адреса': 'Indirizzo', 'Телефон': 'Telefono', 'Сайт': 'Sito web', 'Підставити': 'Compila',
  'Можна ввести вручну': 'Puoi inserirlo manualmente', 'Зберегти місце': 'Salva luogo', 'Зберігаємо…': 'Salvataggio…',
  'Місць не знайдено': 'Nessun luogo trovato', 'Лише для цієї гри, без збереження в каталозі': 'Solo per questa partita, senza salvarlo nel catalogo', 'Зберегти назву лише у профілі': 'Salva il nome solo nel profilo',
  'Після збереження місце зможуть знайти й обрати всі авторизовані користувачі.': 'Dopo il salvataggio, tutti gli utenti autorizzati potranno trovare e scegliere questo luogo.'
});
Object.assign(COPY.en, {
  'Місце / клуб': 'Venue / club', 'Пошук місця або клубу': 'Search venues or clubs', '+ Додати': '+ Add',
  'Нове місце / клуб': 'New venue / club', 'Спільний каталог': 'Shared directory', 'Назва *': 'Name *',
  'Адреса': 'Address', 'Телефон': 'Phone', 'Сайт': 'Website', 'Підставити': 'Fill in',
  'Можна ввести вручну': 'You can enter it manually', 'Зберегти місце': 'Save venue', 'Зберігаємо…': 'Saving…',
  'Місць не знайдено': 'No venues found', 'Лише для цієї гри, без збереження в каталозі': 'For this game only, without saving to the directory', 'Зберегти назву лише у профілі': 'Save the name only in the profile',
  'Після збереження місце зможуть знайти й обрати всі авторизовані користувачі.': 'After saving, every authorized user can find and select this venue.'
});
Object.assign(COPY.fr, {
  'Місце / клуб': 'Lieu / club', 'Пошук місця або клубу': 'Rechercher un lieu ou un club', '+ Додати': '+ Ajouter',
  'Нове місце / клуб': 'Nouveau lieu / club', 'Спільний каталог': 'Catalogue partagé', 'Назва *': 'Nom *',
  'Адреса': 'Adresse', 'Телефон': 'Téléphone', 'Сайт': 'Site web', 'Підставити': 'Préremplir',
  'Можна ввести вручну': 'Vous pouvez la saisir manuellement', 'Зберегти місце': 'Enregistrer le lieu', 'Зберігаємо…': 'Enregistrement…',
  'Місць не знайдено': 'Aucun lieu trouvé', 'Лише для цієї гри, без збереження в каталозі': 'Pour cette partie uniquement, sans l’enregistrer dans le catalogue', 'Зберегти назву лише у профілі': 'Enregistrer le nom uniquement dans le profil',
  'Після збереження місце зможуть знайти й обрати всі авторизовані користувачі.': 'Après l’enregistrement, tous les utilisateurs autorisés pourront trouver et choisir ce lieu.'
});

Object.assign(COPY.it, {
  'Місця та клуби': 'Luoghi e club', 'Спільний каталог місць': 'Catalogo condiviso dei luoghi', '+ Додати місце / клуб': '+ Aggiungi luogo / club',
  'Новий запис додається окремо й не замінює вже створені клуби.': 'Ogni nuovo elemento viene aggiunto separatamente e non sostituisce i club esistenti.',
  'Основне': 'Principale', 'Контакти не вказано': 'Contatti non indicati', 'Видалити місце': 'Elimina luogo',
  'Каталог порожній': 'Il catalogo è vuoto', 'Додайте перше місце або клуб.': 'Aggiungi il primo luogo o club.',
  'Каталог тимчасово недоступний': 'Il catalogo non è temporaneamente disponibile'
});
Object.assign(COPY.en, {
  'Місця та клуби': 'Venues and clubs', 'Спільний каталог місць': 'Shared venue directory', '+ Додати місце / клуб': '+ Add venue / club',
  'Новий запис додається окремо й не замінює вже створені клуби.': 'Each new entry is added separately and does not replace existing clubs.',
  'Основне': 'Primary', 'Контакти не вказано': 'No contact details', 'Видалити місце': 'Delete venue',
  'Каталог порожній': 'The directory is empty', 'Додайте перше місце або клуб.': 'Add the first venue or club.',
  'Каталог тимчасово недоступний': 'The directory is temporarily unavailable'
});
Object.assign(COPY.fr, {
  'Місця та клуби': 'Lieux et clubs', 'Спільний каталог місць': 'Catalogue partagé des lieux', '+ Додати місце / клуб': '+ Ajouter un lieu / club',
  'Новий запис додається окремо й не замінює вже створені клуби.': 'Chaque nouvelle entrée est ajoutée séparément et ne remplace pas les clubs existants.',
  'Основне': 'Principal', 'Контакти не вказано': 'Coordonnées non indiquées', 'Видалити місце': 'Supprimer le lieu',
  'Каталог порожній': 'Le catalogue est vide', 'Додайте перше місце або клуб.': 'Ajoutez le premier lieu ou club.',
  'Каталог тимчасово недоступний': 'Le catalogue est temporairement indisponible'
});

Object.assign(COPY.it, { 'Поділитися застосунком': 'Condividi l’app', 'Очистити розсадку': 'Svuota i posti' });
Object.assign(COPY.en, { 'Поділитися застосунком': 'Share app', 'Очистити розсадку': 'Clear seating' });
Object.assign(COPY.fr, { 'Поділитися застосунком': 'Partager l’application', 'Очистити розсадку': 'Vider le placement' });

Object.assign(COPY.it, {
  'Обговорення ігор': 'Discussioni sulle partite', 'Обговорити гру': 'Discuti la partita', 'Де обговорити гру?': 'Dove discutere la partita?',
  'Чат у Mafia Enjoy': 'Chat in Mafia Enjoy', 'Група в Telegram': 'Gruppo Telegram', 'Окремий чат': 'Chat separata',
  'Відкрити чат': 'Apri chat', 'Спробувати ще раз': 'Riprova', 'Готуємо чат…': 'Preparazione della chat…',
  'Створити групу в Telegram': 'Crea un gruppo Telegram', 'Надіслати посилання через Telegram': 'Invia il link tramite Telegram',
  'Завантажуємо чати…': 'Caricamento delle chat…', 'Чати тимчасово недоступні': 'Le chat non sono disponibili', 'Обговорень ще немає': 'Nessuna discussione',
  'Обговорення гри': 'Discussione della partita', 'Відкриваємо розмову…': 'Apertura della conversazione…', 'Повідомлення недоступні': 'Messaggi non disponibili',
  'Розмова ще порожня': 'La conversazione è vuota', 'Напишіть перше повідомлення про цю гру.': 'Scrivi il primo messaggio su questa partita.',
  'Повідомлення': 'Messaggio', 'Напишіть повідомлення…': 'Scrivi un messaggio…', 'Надіслати': 'Invia', 'Надсилаємо…': 'Invio…', 'Емоції для повідомлення': 'Emozioni per il messaggio',
  'Створюється автоматично. Ведучий і всі авторизовані учасники цього столу вже мають доступ.': 'Viene creata automaticamente. L’host e tutti i giocatori autenticati al tavolo hanno già accesso.',
  'Telegram відкриє створення нової групи. З міркувань приватності застосунок не може сам додати Google-профілі як Telegram-контакти — ведучий обирає їх у Telegram.': 'Telegram aprirà la creazione di un nuovo gruppo. Per motivi di privacy, l’app non può aggiungere i profili Google come contatti Telegram: l’host li seleziona in Telegram.'
});
Object.assign(COPY.en, {
  'Обговорення ігор': 'Game discussions', 'Обговорити гру': 'Discuss game', 'Де обговорити гру?': 'Where do you want to discuss?',
  'Чат у Mafia Enjoy': 'Chat in Mafia Enjoy', 'Група в Telegram': 'Telegram group', 'Окремий чат': 'Separate chat',
  'Відкрити чат': 'Open chat', 'Спробувати ще раз': 'Try again', 'Готуємо чат…': 'Preparing chat…',
  'Створити групу в Telegram': 'Create Telegram group', 'Надіслати посилання через Telegram': 'Send link via Telegram',
  'Завантажуємо чати…': 'Loading chats…', 'Чати тимчасово недоступні': 'Chats are temporarily unavailable', 'Обговорень ще немає': 'No discussions yet',
  'Обговорення гри': 'Game discussion', 'Відкриваємо розмову…': 'Opening conversation…', 'Повідомлення недоступні': 'Messages are unavailable',
  'Розмова ще порожня': 'The conversation is empty', 'Напишіть перше повідомлення про цю гру.': 'Write the first message about this game.',
  'Повідомлення': 'Message', 'Напишіть повідомлення…': 'Write a message…', 'Надіслати': 'Send', 'Надсилаємо…': 'Sending…', 'Емоції для повідомлення': 'Message emotions',
  'Створюється автоматично. Ведучий і всі авторизовані учасники цього столу вже мають доступ.': 'It is created automatically. The host and every signed-in player at the table already have access.',
  'Telegram відкриє створення нової групи. З міркувань приватності застосунок не може сам додати Google-профілі як Telegram-контакти — ведучий обирає їх у Telegram.': 'Telegram will open the new-group flow. For privacy, the app cannot add Google profiles as Telegram contacts; the host selects them in Telegram.'
});
Object.assign(COPY.fr, {
  'Обговорення ігор': 'Discussions des parties', 'Обговорити гру': 'Discuter de la partie', 'Де обговорити гру?': 'Où discuter de la partie ?',
  'Чат у Mafia Enjoy': 'Chat dans Mafia Enjoy', 'Група в Telegram': 'Groupe Telegram', 'Окремий чат': 'Chat séparé',
  'Відкрити чат': 'Ouvrir le chat', 'Спробувати ще раз': 'Réessayer', 'Готуємо чат…': 'Préparation du chat…',
  'Створити групу в Telegram': 'Créer un groupe Telegram', 'Надіслати посилання через Telegram': 'Envoyer le lien via Telegram',
  'Завантажуємо чати…': 'Chargement des chats…', 'Чати тимчасово недоступні': 'Les chats sont indisponibles', 'Обговорень ще немає': 'Aucune discussion',
  'Обговорення гри': 'Discussion de la partie', 'Відкриваємо розмову…': 'Ouverture de la conversation…', 'Повідомлення недоступні': 'Messages indisponibles',
  'Розмова ще порожня': 'La conversation est vide', 'Напишіть перше повідомлення про цю гру.': 'Écrivez le premier message sur cette partie.',
  'Повідомлення': 'Message', 'Напишіть повідомлення…': 'Écrivez un message…', 'Надіслати': 'Envoyer', 'Надсилаємо…': 'Envoi…', 'Емоції для повідомлення': 'Émotions du message',
  'Створюється автоматично. Ведучий і всі авторизовані учасники цього столу вже мають доступ.': 'Il est créé automatiquement. L’animateur et tous les joueurs connectés à la table y ont déjà accès.',
  'Telegram відкриє створення нової групи. З міркувань приватності застосунок не може сам додати Google-профілі як Telegram-контакти — ведучий обирає їх у Telegram.': 'Telegram ouvrira la création d’un groupe. Pour des raisons de confidentialité, l’app ne peut pas ajouter les profils Google comme contacts Telegram : l’animateur les sélectionne dans Telegram.'
});

Object.assign(COPY.it, {
  'Telegram': 'Telegram', 'Введено вручну': 'Inserito manualmente', 'Telegram підключено': 'Telegram collegato',
  'Синхронізувати з Telegram': 'Sincronizza con Telegram', 'Підготувати підключення Telegram': 'Prepara il collegamento Telegram',
  'Готуємо Telegram Login…': 'Preparazione di Telegram Login…', 'Підключаємо Telegram…': 'Collegamento a Telegram…',
  'Готуємо безпечне підключення…': 'Preparazione del collegamento sicuro…', 'Натисніть іконку Telegram, щоб підтвердити профіль.': 'Tocca l’icona Telegram per verificare il profilo.',
  'Від’єднати Telegram': 'Scollega Telegram', 'Очистити Telegram': 'Cancella Telegram', 'Фото Telegram': 'Foto Telegram',
  'Username не вказано в Telegram': 'Username non indicato in Telegram', '@username або t.me/username': '@username o t.me/username'
});
Object.assign(COPY.en, {
  'Telegram': 'Telegram', 'Введено вручну': 'Entered manually', 'Telegram підключено': 'Telegram connected',
  'Синхронізувати з Telegram': 'Sync with Telegram', 'Підготувати підключення Telegram': 'Prepare Telegram connection',
  'Готуємо Telegram Login…': 'Preparing Telegram Login…', 'Підключаємо Telegram…': 'Connecting Telegram…',
  'Готуємо безпечне підключення…': 'Preparing a secure connection…', 'Натисніть іконку Telegram, щоб підтвердити профіль.': 'Tap the Telegram icon to verify your profile.',
  'Від’єднати Telegram': 'Disconnect Telegram', 'Очистити Telegram': 'Clear Telegram', 'Фото Telegram': 'Telegram photo',
  'Username не вказано в Telegram': 'No username is set in Telegram', '@username або t.me/username': '@username or t.me/username'
});
Object.assign(COPY.fr, {
  'Telegram': 'Telegram', 'Введено вручну': 'Saisi manuellement', 'Telegram підключено': 'Telegram connecté',
  'Синхронізувати з Telegram': 'Synchroniser avec Telegram', 'Підготувати підключення Telegram': 'Préparer la connexion Telegram',
  'Готуємо Telegram Login…': 'Préparation de Telegram Login…', 'Підключаємо Telegram…': 'Connexion à Telegram…',
  'Готуємо безпечне підключення…': 'Préparation de la connexion sécurisée…', 'Натисніть іконку Telegram, щоб підтвердити профіль.': 'Touchez l’icône Telegram pour vérifier le profil.',
  'Від’єднати Telegram': 'Déconnecter Telegram', 'Очистити Telegram': 'Effacer Telegram', 'Фото Telegram': 'Photo Telegram',
  'Username не вказано в Telegram': 'Aucun nom d’utilisateur Telegram', '@username або t.me/username': '@username ou t.me/username'
});

Object.assign(COPY.it, {
  'Рейтинг гравців': 'Classifica giocatori', 'балів': 'punti', 'Методика FIIM/MWT ↗': 'Metodo FIIM/MWT ↗',
  'Автоматична частина системи FIIM/MWT: 1,3 бала за перемогу, 0,3 за поразку, 0 за нічию; +0,5/+0,7 за Кращий хід 2/3 або 3/3; −0,8 за дискваліфікацію через 4-й фол. КР — сума балів останніх 100 ігор, поділена на 100.': 'Parte automatica del sistema FIIM/MWT: 1,3 punti per una vittoria, 0,3 per una sconfitta, 0 per un pareggio; +0,5/+0,7 per una miglior mossa 2/3 o 3/3; −0,8 per la squalifica al quarto fallo. CR è la somma dei punti delle ultime 100 partite divisa per 100.'
});
Object.assign(COPY.en, {
  'Рейтинг гравців': 'Player ranking', 'балів': 'points', 'Методика FIIM/MWT ↗': 'FIIM/MWT method ↗',
  'Автоматична частина системи FIIM/MWT: 1,3 бала за перемогу, 0,3 за поразку, 0 за нічию; +0,5/+0,7 за Кращий хід 2/3 або 3/3; −0,8 за дискваліфікацію через 4-й фол. КР — сума балів останніх 100 ігор, поділена на 100.': 'Automated part of the FIIM/MWT system: 1.3 points for a win, 0.3 for a loss, 0 for a draw; +0.5/+0.7 for a 2/3 or 3/3 Best Move; −0.8 for disqualification on the fourth foul. PC is the sum of points from the last 100 games divided by 100.'
});
Object.assign(COPY.fr, {
  'Рейтинг гравців': 'Classement des joueurs', 'балів': 'points', 'Методика FIIM/MWT ↗': 'Méthode FIIM/MWT ↗',
  'Автоматична частина системи FIIM/MWT: 1,3 бала за перемогу, 0,3 за поразку, 0 за нічию; +0,5/+0,7 за Кращий хід 2/3 або 3/3; −0,8 за дискваліфікацію через 4-й фол. КР — сума балів останніх 100 ігор, поділена на 100.': 'Partie automatique du système FIIM/MWT : 1,3 point pour une victoire, 0,3 pour une défaite, 0 pour un nul ; +0,5/+0,7 pour un meilleur coup 2/3 ou 3/3 ; −0,8 pour une disqualification au quatrième avertissement. CR est la somme des points des 100 dernières parties divisée par 100.'
});

Object.assign(COPY.it, {
  'Період аналізу': 'Periodo di analisi', 'Період статистики': 'Periodo delle statistiche', 'Увесь час': 'Tutto il periodo',
  '30 днів': '30 giorni', '90 днів': '90 giorni', '12 місяців': '12 mesi', 'Ключові показники': 'Indicatori chiave',
  'нічиїх': 'pareggi', 'максимальний ігровий день': 'giornata massima di gioco', 'унікальних гравців': 'giocatori unici',
  'Час і темп гри': 'Durata e ritmo', 'медіанний час': 'durata mediana', 'найкоротша гра': 'partita più breve',
  'найдовша гра': 'partita più lunga', 'середній інтервал між стартами': 'intervallo medio tra gli inizi',
  'Фази за протоколом': 'Fasi dal registro', 'Ураховано лише відрізки з повними часовими мітками': 'Sono inclusi solo gli intervalli con marcatori temporali completi',
  'Підготовка столу': 'Preparazione del tavolo', 'від створення гри до першого дня': 'dalla creazione al primo giorno',
  'Ігровий день': 'Giorno di gioco', 'від початку дня до оголошення ночі': 'dall’inizio del giorno all’annuncio della notte',
  'Ніч': 'Notte', 'від оголошення ночі до наступного дня або фінішу': 'dall’annuncio della notte al giorno successivo o alla fine',
  'Активність і динаміка': 'Attività e andamento', 'Останні 7 днів': 'Ultimi 7 giorni', 'Останні 30 днів': 'Ultimi 30 giorni',
  'без змін': 'nessuna variazione', 'Середній фінальний день': 'Giorno finale medio', 'Найдовша пауза між стартами': 'Pausa più lunga tra gli inizi',
  'Динаміка за 6 місяців': 'Andamento su 6 mesi', 'кількість завершених ігор': 'partite concluse',
  'Місця, розклад і дисципліна': 'Luoghi, orari e disciplina', 'найактивніший день тижня': 'giorno più attivo',
  'найчастіший час старту': 'fascia di inizio più frequente', 'місць / клубів': 'luoghi / club',
  'фолів у середньому за гру': 'falli medi per partita', 'дискваліфікацій за 4-й фол': 'squalifiche al quarto fallo',
  'Результати за місцями': 'Risultati per luogo', 'перші 5 за кількістю ігор': 'primi 5 per numero di partite'
});
Object.assign(COPY.en, {
  'Період аналізу': 'Analysis period', 'Період статистики': 'Statistics period', 'Увесь час': 'All time',
  '30 днів': '30 days', '90 днів': '90 days', '12 місяців': '12 months', 'Ключові показники': 'Key indicators',
  'нічиїх': 'draws', 'максимальний ігровий день': 'latest game day', 'унікальних гравців': 'unique players',
  'Час і темп гри': 'Game time and pace', 'медіанний час': 'median duration', 'найкоротша гра': 'shortest game',
  'найдовша гра': 'longest game', 'середній інтервал між стартами': 'average gap between starts',
  'Фази за протоколом': 'Phases from the game log', 'Ураховано лише відрізки з повними часовими мітками': 'Only intervals with complete timestamps are included',
  'Підготовка столу': 'Table setup', 'від створення гри до першого дня': 'from game creation to day one',
  'Ігровий день': 'Game day', 'від початку дня до оголошення ночі': 'from the start of the day to the night announcement',
  'Ніч': 'Night', 'від оголошення ночі до наступного дня або фінішу': 'from the night announcement to the next day or finish',
  'Активність і динаміка': 'Activity and trends', 'Останні 7 днів': 'Last 7 days', 'Останні 30 днів': 'Last 30 days',
  'без змін': 'no change', 'Середній фінальний день': 'Average final day', 'Найдовша пауза між стартами': 'Longest gap between starts',
  'Динаміка за 6 місяців': 'Six-month trend', 'кількість завершених ігор': 'completed games',
  'Місця, розклад і дисципліна': 'Venues, schedule and discipline', 'найактивніший день тижня': 'most active weekday',
  'найчастіший час старту': 'most common start window', 'місць / клубів': 'venues / clubs',
  'фолів у середньому за гру': 'average fouls per game', 'дискваліфікацій за 4-й фол': 'fourth-foul disqualifications',
  'Результати за місцями': 'Results by venue', 'перші 5 за кількістю ігор': 'top 5 by game count'
});
Object.assign(COPY.fr, {
  'Період аналізу': 'Période d’analyse', 'Період статистики': 'Période des statistiques', 'Увесь час': 'Toute la période',
  '30 днів': '30 jours', '90 днів': '90 jours', '12 місяців': '12 mois', 'Ключові показники': 'Indicateurs clés',
  'нічиїх': 'matchs nuls', 'максимальний ігровий день': 'jour de jeu maximal', 'унікальних гравців': 'joueurs uniques',
  'Час і темп гри': 'Durée et rythme', 'медіанний час': 'durée médiane', 'найкоротша гра': 'partie la plus courte',
  'найдовша гра': 'partie la plus longue', 'середній інтервал між стартами': 'intervalle moyen entre les débuts',
  'Фази за протоколом': 'Phases du compte rendu', 'Ураховано лише відрізки з повними часовими мітками': 'Seuls les intervalles avec horodatage complet sont inclus',
  'Підготовка столу': 'Préparation de la table', 'від створення гри до першого дня': 'de la création au premier jour',
  'Ігровий день': 'Jour de jeu', 'від початку дня до оголошення ночі': 'du début du jour à l’annonce de la nuit',
  'Ніч': 'Nuit', 'від оголошення ночі до наступного дня або фінішу': 'de l’annonce de la nuit au jour suivant ou à la fin',
  'Активність і динаміка': 'Activité et tendances', 'Останні 7 днів': '7 derniers jours', 'Останні 30 днів': '30 derniers jours',
  'без змін': 'sans changement', 'Середній фінальний день': 'Jour final moyen', 'Найдовша пауза між стартами': 'Plus longue pause entre les débuts',
  'Динаміка за 6 місяців': 'Tendance sur 6 mois', 'кількість завершених ігор': 'parties terminées',
  'Місця, розклад і дисципліна': 'Lieux, horaires et discipline', 'найактивніший день тижня': 'jour le plus actif',
  'найчастіший час старту': 'plage de départ la plus fréquente', 'місць / клубів': 'lieux / clubs',
  'фолів у середньому за гру': 'fautes moyennes par partie', 'дискваліфікацій за 4-й фол': 'disqualifications à la quatrième faute',
  'Результати за місцями': 'Résultats par lieu', 'перші 5 за кількістю ігор': 'top 5 par nombre de parties'
});

Object.assign(COPY.en, {
  'Календар ігор': 'Game calendar', 'Попередній місяць': 'Previous month', 'Наступний місяць': 'Next month',
  'Поточна версія: PWA v194.': 'Current version: PWA v194.',
  'Для швидкого запуску кешуються оболонка застосунку, стилі, іконки та вбудована музика.': 'The app shell, styles, icons, and built-in music are cached for a fast start.',
  'Google-сесія зберігається на цьому пристрої. Профілі та спільні архіви синхронізуються після входу, а локальні дані допомагають продовжити роботу під час короткої втрати мережі.': 'The Google session is stored on this device. Profiles and shared archives synchronize after sign-in, while local data helps the app keep working during a brief network outage.'
});
Object.assign(COPY.fr, {
  'Календар ігор': 'Calendrier des parties', 'Попередній місяць': 'Mois précédent', 'Наступний місяць': 'Mois suivant',
  'Поточна версія: PWA v194.': 'Version actuelle : PWA v194.',
  'Для швидкого запуску кешуються оболонка застосунку, стилі, іконки та вбудована музика.': 'La structure de l’application, les styles, les icônes et la musique intégrée sont mis en cache pour un démarrage rapide.',
  'Google-сесія зберігається на цьому пристрої. Профілі та спільні архіви синхронізуються після входу, а локальні дані допомагають продовжити роботу під час короткої втрати мережі.': 'La session Google est conservée sur cet appareil. Les profils et les archives partagées se synchronisent après la connexion, tandis que les données locales permettent de continuer lors d’une brève coupure réseau.'
});
Object.assign(COPY.it, {
  'Календар ігор': 'Calendario delle partite', 'Попередній місяць': 'Mese precedente', 'Наступний місяць': 'Mese successivo',
  'Поточна версія: PWA v194.': 'Versione attuale: PWA v194.',
  'Для швидкого запуску кешуються оболонка застосунку, стилі, іконки та вбудована музика.': 'La struttura dell’app, gli stili, le icone e la musica integrata vengono memorizzati nella cache per un avvio rapido.',
  'Google-сесія зберігається на цьому пристрої. Профілі та спільні архіви синхронізуються після входу, а локальні дані допомагають продовжити роботу під час короткої втрати мережі.': 'La sessione Google viene conservata su questo dispositivo. I profili e gli archivi condivisi si sincronizzano dopo l’accesso, mentre i dati locali consentono di continuare durante una breve interruzione della rete.'
});

const PATTERNS = {
  it: [[/(\d+) хв/g, '$1 min'], [/(\d+) год/g, '$1 h'], [/(\d+) ігор/g, '$1 partite'], [/(\d+) оцінок/g, '$1 valutazioni'], [/(\d+)% перемог/g, '$1% vittorie'], [/(\d+) учасн\./g, '$1 partecipanti'], [/(\d+) авторизованих профілів/g, '$1 profili autenticati'], [/(\d+) гостей без доступу/g, '$1 ospiti senza accesso'], [/тимчасових (\d+)/g, '$1 temporanei'], [/черга (\d+)/g, 'coda $1'], [/ · ведучий /g, ' · conduttore '], [/(\d+) гравців за столом/g, '$1 giocatori al tavolo'], [/(\d+)\/10 живих/g, '$1/10 vivi'], [/Ранг (\d+)/g, 'Posizione $1'], [/(\d+(?:[,.]\d+)?) балів/g, '$1 punti'], [/Екран бачить лише гравець №(\d+)/g, 'Solo il giocatore n. $1 può vedere lo schermo'], [/Змінити аватар/g, 'Cambia avatar']],
  en: [[/(\d+) хв/g, '$1 min'], [/(\d+) год/g, '$1 hr'], [/(\d+) ігор/g, '$1 games'], [/(\d+) оцінок/g, '$1 ratings'], [/(\d+)% перемог/g, '$1% wins'], [/(\d+) учасн\./g, '$1 participants'], [/(\d+) авторизованих профілів/g, '$1 signed-in profiles'], [/(\d+) гостей без доступу/g, '$1 guests without access'], [/тимчасових (\d+)/g, '$1 temporary'], [/черга (\d+)/g, 'queue $1'], [/ · ведучий /g, ' · host '], [/(\d+) гравців за столом/g, '$1 players at the table'], [/(\d+)\/10 живих/g, '$1/10 alive'], [/Ранг (\d+)/g, 'Rank $1'], [/(\d+(?:[,.]\d+)?) балів/g, '$1 points'], [/Екран бачить лише гравець №(\d+)/g, 'Only player #$1 can see the screen'], [/Змінити аватар/g, 'Change avatar']],
  fr: [[/(\d+) хв/g, '$1 min'], [/(\d+) год/g, '$1 h'], [/(\d+) ігор/g, '$1 parties'], [/(\d+) оцінок/g, '$1 évaluations'], [/(\d+)% перемог/g, '$1 % de victoires'], [/(\d+) учасн\./g, '$1 participants'], [/(\d+) авторизованих профілів/g, '$1 profils connectés'], [/(\d+) гостей без доступу/g, '$1 invités sans accès'], [/тимчасових (\d+)/g, '$1 temporaires'], [/черга (\d+)/g, 'file $1'], [/ · ведучий /g, ' · animateur '], [/(\d+) гравців за столом/g, '$1 joueurs à table'], [/(\d+)\/10 живих/g, '$1/10 en vie'], [/Ранг (\d+)/g, 'Rang $1'], [/(\d+(?:[,.]\d+)?) балів/g, '$1 points'], [/Екран бачить лише гравець №(\d+)/g, 'Seul le joueur n°$1 voit l’écran'], [/Змінити аватар/g, 'Changer l’avatar']]
};

export function normalizeLanguage(value) {
  if (value === 'ru') return 'it';
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
