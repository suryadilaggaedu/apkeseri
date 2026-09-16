/* =========================================================
   APKESERI — App Shell logic
   Foundation sahaja. Aktiviti 1-4 akan ditambah kemudian.
   ========================================================= */

(function () {
  "use strict";

  // Kunci lama (versi satu-pengguna). Dikekalkan HANYA untuk bacaan
  // migrasi sekali sahaja — tidak dipadam, tidak ditulis lagi selepas
  // migrasi berjaya.
  var STORAGE_KEY_USER = "APKESERI_USER";
  var STORAGE_KEY_PROGRESS = "APKESERI_PROGRESS";

  // Kunci baharu (Phase 4 — multi-user ringan).
  var STORAGE_KEY_USERS = "APKESERI_USERS";
  var STORAGE_KEY_ACTIVE_USER = "APKESERI_ACTIVE_USER";

  // Kunci baharu (Fasa 5C — counter global Supabase). Terasing
  // sepenuhnya daripada storan pengguna/progress sedia ada di atas.
  var STORAGE_KEY_GLOBAL_COUNT = "APKESERI_GLOBAL_COMPLETION_COUNT";
  var STORAGE_KEY_COMPLETION_KEY = "APKESERI_COMPLETION_KEY";
  var STORAGE_KEY_INTRO_SEEN = "APKESERI_INTRO_SEEN";

  // Kunci baharu (Fasa 5D — pendaftaran completion global).
  var STORAGE_KEY_PENDING_COMPLETION = "APKESERI_PENDING_COMPLETION";

  var CHIP_CIRCUMFERENCE = 97.4;
  var RING_CIRCUMFERENCE = 326.7;

  var ACTIVITY_DEFS = [
    { id: "aktiviti-1", title: "Jom Kenali Emosi", icon: "🙂" },
    { id: "aktiviti-2", title: "Termometer Emosi", icon: "🌡️" },
    { id: "aktiviti-3", title: "Chici Chaca Emosiku", icon: "🧸" },
    { id: "aktiviti-4", title: "Teknik Daun Luruh", icon: "🍃" }
  ];

  var STATUS_LABEL = {
    "locked": "🔒 Belum mula",
    "available": "Belum mula",
    "in-progress": "Sedang buat",
    "completed": "Selesai"
  };

  /* ---------------------------------------------------------
     Storage helpers
  --------------------------------------------------------- */

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------------------------------------------------------
     Multi-user store (Phase 4)

     APKESERI_USERS = {
       "AP-XXXXXX": { userId, name, createdAt, progress },
       "AP-YYYYYY": { userId, name, createdAt, progress },
       ...
     }
     APKESERI_ACTIVE_USER = "AP-XXXXXX" (userId string sahaja)

     getUser() / saveUser() / getProgress() / saveProgress() KEKAL
     nama dan bentuk pulangan yang sama seperti sebelum ini — semua
     ~36 tempat panggilan sedia ada di seluruh Aktiviti 1-4, review,
     sijil dsb. terus berfungsi tanpa diubah. Hanya IMPLEMENTASI
     dalaman fungsi ini yang bertukar kepada beroperasi terhadap
     pengguna AKTIF dalam APKESERI_USERS.
  --------------------------------------------------------- */

  function getUsersStore() {
    return readJSON(STORAGE_KEY_USERS) || {};
  }

  function saveUsersStore(store) {
    return writeJSON(STORAGE_KEY_USERS, store);
  }

  function getActiveUserId() {
    return readJSON(STORAGE_KEY_ACTIVE_USER);
  }

  function setActiveUserId(userId) {
    return writeJSON(STORAGE_KEY_ACTIVE_USER, userId);
  }

  // Senarai pengguna tersimpan pada peranti ini, untuk paparan
  // "PILIH PENGGUNA" (nama sahaja — userId TIDAK dipaparkan kepada
  // murid di mana-mana bahagian UI).
  function listStoredUsers() {
    var store = getUsersStore();
    return Object.keys(store).map(function (id) {
      return { userId: store[id].userId, name: store[id].name };
    });
  }

  // Migrasi data lama (versi satu-pengguna) kepada struktur
  // multi-user — dijalankan SEKALI sahaja, secara automatik, pada
  // permulaan aplikasi. Tidak memadam APKESERI_USER/APKESERI_PROGRESS
  // asal (backward compatibility + keselamatan data), hanya
  // menyalinnya ke dalam APKESERI_USERS jika APKESERI_USERS belum
  // wujud lagi.
  function migrateLegacyUserIfNeeded() {
    var existingStore = readJSON(STORAGE_KEY_USERS);
    if (existingStore) return; // sudah dimigrasi — jangan buat apa-apa

    var legacyUser = readJSON(STORAGE_KEY_USER);
    if (!legacyUser || !legacyUser.userId) return; // tiada data lama untuk dimigrasi

    var legacyProgress = readJSON(STORAGE_KEY_PROGRESS);

    var newStore = {};
    newStore[legacyUser.userId] = {
      userId: legacyUser.userId,
      name: legacyUser.name,
      createdAt: legacyUser.createdAt,
      progress: legacyProgress || createDefaultProgress()
    };

    saveUsersStore(newStore);
    setActiveUserId(legacyUser.userId);
  }

  function getUser() {
    var activeId = getActiveUserId();
    if (!activeId) return null;
    var record = getUsersStore()[activeId];
    if (!record) return null;
    return { userId: record.userId, name: record.name, createdAt: record.createdAt };
  }

  function saveUser(user) {
    var store = getUsersStore();
    var existing = store[user.userId];
    store[user.userId] = {
      userId: user.userId,
      name: user.name,
      createdAt: user.createdAt,
      progress: existing && existing.progress ? existing.progress : createDefaultProgress()
    };
    var ok = saveUsersStore(store);
    setActiveUserId(user.userId);
    return ok;
  }

  function getProgress() {
    var activeId = getActiveUserId();
    if (!activeId) return createDefaultProgress();

    var store = getUsersStore();
    var record = store[activeId];
    if (!record) return createDefaultProgress();

    if (!record.progress) {
      record.progress = createDefaultProgress();
      saveUsersStore(store);
    }
    return record.progress;
  }

  function saveProgress(progress) {
    var activeId = getActiveUserId();
    if (!activeId) return false;

    var store = getUsersStore();
    if (!store[activeId]) return false;

    store[activeId].progress = progress;
    return saveUsersStore(store);
  }

  function createDefaultProgress() {
    return {
      overallPercent: 0,
      activities: {
        "aktiviti-1": { status: "available" },
        "aktiviti-2": { status: "locked" },
        "aktiviti-3": { status: "locked" },
        "aktiviti-4": { status: "locked" }
      }
    };
  }

  /* ---------------------------------------------------------
     ID generation — format AP-XXXXXX
  --------------------------------------------------------- */

  function generateUserId() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
    var id = "AP-";
    for (var i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /* ---------------------------------------------------------
     DOM refs
  --------------------------------------------------------- */

  var el = {
    header: document.getElementById("appHeader"),
    headerGreeting: document.getElementById("headerGreeting"),
    headerProgressLabel: document.getElementById("headerProgressLabel"),
    headerProgressRing: document.getElementById("headerProgressRing"),
    nav: document.getElementById("appNav"),
    footer: document.getElementById("appFooter"),

    onboardingForm: document.getElementById("onboardingForm"),
    nameInput: document.getElementById("nameInput"),
    nameError: document.getElementById("nameError"),

    welcomeName: document.getElementById("welcomeName"),

    btnStart: document.getElementById("btnStart"),
    btnGoDashboard: document.getElementById("btnGoDashboard"),

    dashGreeting: document.getElementById("dashGreeting"),
    dashSubline: document.getElementById("dashSubline"),
    progressPercent: document.getElementById("progressPercent"),
    progressRingValue: document.getElementById("progressRingValue"),
    progressDesc: document.getElementById("progressDesc"),
    activityList: document.getElementById("activityList"),
    dashCertReminder: document.getElementById("dashCertReminder"),
    btnDashCertReminder: document.getElementById("btnDashCertReminder"),
    btnSwitchUserHint: document.getElementById("btnSwitchUserHint"),

    switchUserModal: document.getElementById("switchUserModal"),
    btnSwitchUserCancel: document.getElementById("btnSwitchUserCancel"),
    btnSwitchUserConfirm: document.getElementById("btnSwitchUserConfirm"),

    btnPickUserToggle: document.getElementById("btnPickUserToggle"),
    pickUserPanel: document.getElementById("pickUserPanel"),
    pickUserList: document.getElementById("pickUserList"),

    toast: document.getElementById("toast")
  };

  var toastTimer = null;

  /* ---------------------------------------------------------
     Screen routing
  --------------------------------------------------------- */

  function showScreen(name) {
    var currentScreenEl = document.querySelector(".screen.is-active");
    var currentName = currentScreenEl ? currentScreenEl.getAttribute("data-screen") : null;

    if (currentName === "activity-3" && name !== "activity-3") {
      stopA3Video();
    }

    var screens = document.querySelectorAll(".screen");
    screens.forEach(function (screen) {
      screen.classList.toggle("is-active", screen.getAttribute("data-screen") === name);
    });

    if (name === "activity-3") {
      restoreA3Video();
    }

    var isAppScreen = name === "dashboard" || name === "activity-1" || name === "activity-2" || name === "activity-3" || name === "activity-4" || name === "review";
    el.header.hidden = !isAppScreen;
    el.nav.hidden = !isAppScreen;
    el.footer.hidden = !isAppScreen;
  }

  /* ---------------------------------------------------------
     Toast
  --------------------------------------------------------- */

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove("is-visible");
    }, 2600);
  }

  /* ---------------------------------------------------------
     Onboarding flow
  --------------------------------------------------------- */

  function handleOnboardingSubmit(e) {
    e.preventDefault();
    var name = el.nameInput.value.trim();

    if (!name) {
      el.nameError.hidden = false;
      el.nameInput.classList.add("is-invalid");
      el.nameInput.focus();
      return;
    }

    el.nameError.hidden = true;
    el.nameInput.classList.remove("is-invalid");

    createProfile(name);
  }

  function clearNameError() {
    if (!el.nameError.hidden) {
      el.nameError.hidden = true;
      el.nameInput.classList.remove("is-invalid");
    }
  }

  function createProfile(name) {
    var usersStore = getUsersStore();
    var userId = generateUserId();
    while (usersStore[userId]) {
      userId = generateUserId();
    }
    var user = {
      userId: userId,
      name: name,
      createdAt: new Date().toISOString()
    };

    saveUser(user);
    getProgress();

    el.welcomeName.textContent = name;

    showScreen("profile-created");
  }

  /* ---------------------------------------------------------
     Dashboard rendering
  --------------------------------------------------------- */

  function renderDashboard() {
    var user = getUser();
    var progress = getProgress();

    clearA4Timer();

    if (!user) {
      showScreen("welcome");
      return;
    }

    el.dashGreeting.textContent = "Hai, " + user.name + "! \uD83D\uDC4B";
    el.headerGreeting.textContent = user.name;
    el.dashSubline.textContent = "Jom kenali diri awak.";

    updateProgressUI(progress);
    renderActivityList(progress);

    var a4Entry = progress.activities["aktiviti-4"];
    el.dashCertReminder.hidden = !(a4Entry && a4Entry.status === "completed");

    showScreen("dashboard");
  }

  function computeOverallPercent(progress) {
    var total = ACTIVITY_DEFS.length;
    var completed = 0;
    ACTIVITY_DEFS.forEach(function (def) {
      var entry = progress.activities[def.id];
      if (entry && entry.status === "completed") completed++;
    });
    return Math.round((completed / total) * 100);
  }

  // Fasa 5E-2 — semakan eksplisit tambahan (defence-in-depth) supaya
  // Kad Penyertaan tidak pernah bergantung semata-mata pada andaian
  // rantaian locking. Tidak mengubah computeOverallPercent()/logik
  // progress sedia ada — hanya membaca hasilnya.
  function hasFullProgress() {
    return computeOverallPercent(getProgress()) === 100;
  }

  function updateProgressUI(progress) {
    var percent = computeOverallPercent(progress);
    progress.overallPercent = percent;
    saveProgress(progress);

    el.progressPercent.textContent = percent + "%";
    el.headerProgressLabel.textContent = percent + "%";

    var ringOffset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * percent) / 100;
    var chipOffset = CHIP_CIRCUMFERENCE - (CHIP_CIRCUMFERENCE * percent) / 100;
    el.progressRingValue.style.strokeDashoffset = ringOffset;
    el.headerProgressRing.style.strokeDashoffset = chipOffset;

    if (percent === 0) {
      el.progressDesc.textContent = "Belum ada aktiviti selesai lagi. Jom mula yang pertama!";
    } else if (percent === 100) {
      el.progressDesc.textContent = "Tahniah! Awak dah selesaikan semua aktiviti kesedaran kendiri! \uD83C\uDF89";
    } else {
      el.progressDesc.textContent = "Bagus! Awak dah buat sikit progress. Jom teruskan!";
    }
  }

  function renderActivityList(progress) {
    el.activityList.innerHTML = "";

    ACTIVITY_DEFS.forEach(function (def) {
      var entry = progress.activities[def.id] || { status: "locked" };
      var status = entry.status || "locked";

      var card = document.createElement("button");
      card.type = "button";
      card.className = "activity-card" + (status === "locked" ? " is-locked" : "");
      card.setAttribute("data-activity-id", def.id);
      card.setAttribute("aria-label", def.title + " — " + STATUS_LABEL[status]);

      var icon = document.createElement("div");
      icon.className = "activity-card__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = def.icon;

      var body = document.createElement("div");
      body.className = "activity-card__body";

      var title = document.createElement("p");
      title.className = "activity-card__title";
      title.textContent = def.title;

      var statusEl = document.createElement("span");
      statusEl.className = "activity-card__status activity-card__status--" + status;
      statusEl.textContent = STATUS_LABEL[status];

      body.appendChild(title);
      body.appendChild(statusEl);

      var chevron = document.createElement("span");
      chevron.className = "activity-card__chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = status === "locked" ? "" : "›";

      card.appendChild(icon);
      card.appendChild(body);
      card.appendChild(chevron);

      card.addEventListener("click", function () {
        handleActivityClick(def, status);
      });

      el.activityList.appendChild(card);
    });
  }

  function handleActivityClick(def, status) {
    if (status === "locked") {
      showToast("\uD83D\uDD12 Lengkapkan aktiviti sebelumnya dahulu.");
      return;
    }

    if (def.id === "aktiviti-1") {
      if (status === "completed") {
        openActivityReview("aktiviti-1");
        return;
      }
      openActivity1();
      return;
    }

    if (def.id === "aktiviti-2") {
      if (status === "completed") {
        openActivityReview("aktiviti-2");
        return;
      }
      openActivity2();
      return;
    }

    if (def.id === "aktiviti-3") {
      if (status === "completed") {
        openActivityReview("aktiviti-3");
        return;
      }
      openActivity3();
      return;
    }

    if (def.id === "aktiviti-4") {
      if (status === "completed") {
        openActivityReview("aktiviti-4");
        return;
      }
      openActivity4();
      return;
    }

    if (status === "completed") {
      showToast("Tahniah, awak dah selesaikan aktiviti ini! \uD83C\uDF89");
      return;
    }
    showToast("Aktiviti ini akan datang \uD83D\uDE0A");
  }

  /* ---------------------------------------------------------
     AKTIVITI 1 — Jom Kenali Emosi
  --------------------------------------------------------- */

  var A1_STEP_ORDER = [
    "intro",
    "kenali-emosi-dahulu",
    "pilih-emoji",
    "konfirmasi-emoji",
    "kategori",
    "refleksi",
    "selesai"
  ];

  // 12 emosi (lampiran Aktiviti 1). Huraian mengekalkan kandungan
  // modul sebenar secara tepat (jangan tukar maksud) — ejaan
  // disemak mengikut teks modul yang diberikan.
  var A1_EMOTIONS = [
    { id: "gembira", emoji: "😀", label: "Gembira", desc: "Bergembira, sangat suka, sangat girang, besar hati", category: "positif" },
    { id: "bingung", emoji: "😕", label: "Bingung", desc: "Hilang pertimbangan akal, tidak tahu apa yang hendak dibuat, gugup", category: "negatif" },
    { id: "sedih", emoji: "😢", label: "Sedih", desc: "Sedan, sedu, tangis dan teresak-esak", category: "negatif" },
    { id: "bosan", emoji: "😑", label: "Bosan", desc: "Sudah tidak suka lagi, jemu", category: "negatif" },
    { id: "marah", emoji: "😡", label: "Marah", desc: "Perasaan panas hati, berang, gusar, murka", category: "negatif" },
    { id: "takut", emoji: "😨", label: "Takut", desc: "Gentar (gerun, ngeri), berasa bimbang (ragu-ragu, khuatir), tidak berani, kecut", category: "negatif" },
    { id: "bimbang", emoji: "😟", label: "Bimbang", desc: "Berasa gelisah atau tidak sedap hati kerana memikirkan sesuatu atau takut sesuatu yang tidak diingini berlaku, khuatir, risau", category: "negatif" },
    { id: "penat", emoji: "😩", label: "Penat", desc: "Tidak mempunyai kekuatan pada fikiran dan badan (terutamanya berehat selepas sesuatu kegiatan), jerih, letih, payah", category: "negatif" },
    { id: "semangat", emoji: "💪", label: "Semangat", desc: "Kemahuan yang tinggi melakukan sesuatu, bermotivasi", category: "positif" },
    { id: "derita", emoji: "😣", label: "Derita", desc: "Kesusahan (kesakitan, keseksaan) yang dialami", category: "negatif" },
    { id: "rindu", emoji: "🥺", label: "Rindu", desc: "Ingin benar akan sesuatu atau berjumpa dengan seseorang", category: "negatif" },
    { id: "rasa-dihargai", emoji: "🥰", label: "Rasa dihargai", desc: "Berasa diiktiraf, dipuji dan direstui", category: "positif" }
  ];

  var A1_REFLECTION_OPTIONS = [
    { id: "kenal-emosi", emoji: "🌱", label: "Saya boleh kenal pasti emosi saya." },
    { id: "fikir-rasa", emoji: "💭", label: "Saya boleh fikir tentang apa yang saya rasa." },
    { id: "semua-org", emoji: "😊", label: "Saya tahu semua orang boleh mengalami pelbagai emosi." }
  ];

  var a1El = {
    stepIndicator: document.getElementById("a1StepIndicator"),
    backBtn: document.getElementById("a1BackBtn"),
    introGreeting: document.getElementById("a1IntroGreeting"),
    btnIntroStart: document.getElementById("a1BtnIntroStart"),
    learnList: document.getElementById("emotionLearnList"),
    btnLearnNext: document.getElementById("a1BtnLearnNext"),
    emotionGrid: document.getElementById("emotionGrid"),
    confirmEmoji: document.getElementById("a1ConfirmEmoji"),
    confirmText: document.getElementById("a1ConfirmText"),
    btnConfirmNext: document.getElementById("a1BtnConfirmNext"),
    kategoriQuestion: document.getElementById("a1KategoriQuestion"),
    kategoriGrid: document.getElementById("a1KategoriGrid"),
    kategoriResult: document.getElementById("a1KategoriResult"),
    kategoriResultTitle: document.getElementById("a1KategoriResultTitle"),
    kategoriResultBody: document.getElementById("a1KategoriResultBody"),
    btnKategoriNext: document.getElementById("a1BtnKategoriNext"),
    reflectionGrid: document.getElementById("reflectionGrid"),
    btnFinish: document.getElementById("a1BtnFinish"),
    btnToActivity2: document.getElementById("a1BtnToActivity2")
  };

  var a1State = {
    stepIndex: 0,
    emotion: null,
    categoryChosen: null,
    reflection: []
  };

  function findEmotion(id) {
    for (var i = 0; i < A1_EMOTIONS.length; i++) {
      if (A1_EMOTIONS[i].id === id) return A1_EMOTIONS[i];
    }
    return null;
  }

  function openActivity1() {
    var user = getUser();

    a1State = {
      stepIndex: 0,
      emotion: null,
      categoryChosen: null,
      reflection: []
    };

    if (user) {
      a1El.introGreeting.textContent = "Hai, " + user.name + "! \uD83D\uDC4B";
    }

    buildEmotionLearnList();
    buildEmotionGrid();
    buildReflectionGrid();

    var progress = getProgress();
    var entry = progress.activities["aktiviti-1"];
    if (entry && entry.status === "available") {
      entry.status = "in-progress";
      saveProgress(progress);
      renderActivityList(progress);
    }

    goToA1Step(0);
    showScreen("activity-1");
  }

  function goToA1Step(index) {
    a1State.stepIndex = index;
    var stepName = A1_STEP_ORDER[index];

    var steps = document.querySelectorAll("#a1Steps .a1-step");
    steps.forEach(function (step) {
      step.classList.toggle("is-active", step.getAttribute("data-step") === stepName);
    });

    a1El.backBtn.hidden = (stepName === "intro" || stepName === "selesai");
    updateA1StepIndicator(stepName);
  }

  function updateA1StepIndicator(stepName) {
    var map = {
      "kenali-emosi-dahulu": "Langkah 1 daripada 4",
      "pilih-emoji": "Langkah 2 daripada 4",
      "konfirmasi-emoji": "Langkah 2 daripada 4",
      "kategori": "Langkah 3 daripada 4",
      "refleksi": "Langkah 4 daripada 4"
    };

    if (map[stepName]) {
      a1El.stepIndicator.hidden = false;
      a1El.stepIndicator.textContent = map[stepName];
    } else {
      a1El.stepIndicator.hidden = true;
    }
  }

  // Langkah 1 — terangkan 12 emosi dahulu, sebelum murid membuat pilihan.
  function buildEmotionLearnList() {
    a1El.learnList.innerHTML = "";
    A1_EMOTIONS.forEach(function (emotion) {
      var card = document.createElement("div");
      card.className = "emotion-learn-card";

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "emotion-learn-card__emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = emotion.emoji;

      var body = document.createElement("div");
      var name = document.createElement("p");
      name.className = "emotion-learn-card__name";
      name.textContent = emotion.label;
      var desc = document.createElement("p");
      desc.className = "emotion-learn-card__desc";
      desc.textContent = emotion.desc;
      body.appendChild(name);
      body.appendChild(desc);

      card.appendChild(emojiSpan);
      card.appendChild(body);
      a1El.learnList.appendChild(card);
    });
  }

  // Langkah 2 — pilih SATU emoji yang paling menggambarkan diri murid.
  function buildEmotionGrid() {
    a1El.emotionGrid.innerHTML = "";
    A1_EMOTIONS.forEach(function (emotion) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emotion-btn";
      btn.setAttribute("data-emotion-id", emotion.id);
      btn.setAttribute("aria-label", emotion.label);

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "emotion-btn__emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = emotion.emoji;

      var labelSpan = document.createElement("span");
      labelSpan.className = "emotion-btn__label";
      labelSpan.textContent = emotion.label;

      btn.appendChild(emojiSpan);
      btn.appendChild(labelSpan);

      btn.addEventListener("click", function () {
        selectEmotion(emotion.id);
      });

      a1El.emotionGrid.appendChild(btn);
    });
  }

  function selectEmotion(emotionId) {
    a1State.emotion = emotionId;

    var buttons = a1El.emotionGrid.querySelectorAll(".emotion-btn");
    buttons.forEach(function (btn) {
      btn.classList.toggle("is-selected", btn.getAttribute("data-emotion-id") === emotionId);
    });

    var emotion = findEmotion(emotionId);
    if (!emotion) return;

    a1El.confirmEmoji.textContent = emotion.emoji;
    a1El.confirmText.textContent = "Awak pilih: " + emotion.label;

    setTimeout(function () {
      goToA1Step(A1_STEP_ORDER.indexOf("konfirmasi-emoji"));
    }, 180);
  }

  // Langkah 3 — murid kategorikan sendiri (positif/negatif), APKESERI
  // semak dan bimbing dengan lembut jika tersilap.
  function buildKategoriGrid() {
    a1El.kategoriGrid.innerHTML = "";
    a1El.kategoriResult.hidden = true;

    [
      { id: "positif", label: "Positif" },
      { id: "negatif", label: "Negatif" }
    ].forEach(function (opt) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "choice-card a1-kategori-btn";
      card.setAttribute("data-kategori-id", opt.id);

      var labelSpan = document.createElement("span");
      labelSpan.className = "choice-card__label";
      labelSpan.textContent = opt.label;
      card.appendChild(labelSpan);

      card.addEventListener("click", function () {
        selectKategori(opt.id);
      });

      a1El.kategoriGrid.appendChild(card);
    });
  }

  function selectKategori(chosenId) {
    a1State.categoryChosen = chosenId;
    var emotion = findEmotion(a1State.emotion);
    if (!emotion) return;

    var cards = a1El.kategoriGrid.querySelectorAll(".a1-kategori-btn");
    cards.forEach(function (c) {
      c.classList.toggle("is-selected", c.getAttribute("data-kategori-id") === chosenId);
    });

    var isCorrect = chosenId === emotion.category;
    var chosenLabel = chosenId === "positif" ? "positif" : "negatif";
    var correctLabel = emotion.category === "positif" ? "positif" : "negatif";

    if (isCorrect) {
      a1El.kategoriResultTitle.textContent = "Betul! " + emotion.label + " ialah emosi " + correctLabel + ". \uD83D\uDE0A";
      a1El.kategoriResultBody.textContent = emotion.desc;
      a1El.btnKategoriNext.textContent = "JOM TERUSKAN";
    } else {
      a1El.kategoriResultTitle.textContent = "Awak pilih " + chosenLabel + ". Sebenarnya, " + emotion.label + " ialah emosi " + correctLabel + " \uD83D\uDE0A";
      a1El.kategoriResultBody.textContent = emotion.desc;
      a1El.btnKategoriNext.textContent = "FAHAM, TERUSKAN";
    }

    a1El.kategoriResult.hidden = false;
  }

  function buildReflectionGrid() {
    a1El.reflectionGrid.innerHTML = "";
    A1_REFLECTION_OPTIONS.forEach(function (option) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "choice-card";
      card.setAttribute("data-reflection-id", option.id);

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "choice-card__emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = option.emoji;

      var labelSpan = document.createElement("span");
      labelSpan.className = "choice-card__label";
      labelSpan.textContent = option.label;

      card.appendChild(emojiSpan);
      card.appendChild(labelSpan);

      card.addEventListener("click", function () {
        toggleReflectionChoice(option.id, card);
      });

      a1El.reflectionGrid.appendChild(card);
    });
  }

  function toggleReflectionChoice(optionId, card) {
    var index = a1State.reflection.indexOf(optionId);
    if (index === -1) {
      a1State.reflection.push(optionId);
      card.classList.add("is-selected");
    } else {
      a1State.reflection.splice(index, 1);
      card.classList.remove("is-selected");
    }
  }

  function finishActivity1() {
    if (a1State.reflection.length === 0) {
      showToast("Pilih sekurang-kurangnya satu perkara yang awak dah belajar.");
      return;
    }

    var progress = getProgress();
    var emotion = findEmotion(a1State.emotion);

    progress.activities["aktiviti-1"] = {
      status: "completed",
      emotion: a1State.emotion,
      categoryChosen: a1State.categoryChosen,
      categoryCorrect: emotion ? emotion.category : null,
      wasCorrect: !!emotion && a1State.categoryChosen === emotion.category,
      reflection: a1State.reflection.slice(),
      completedAt: new Date().toISOString()
    };

    if (progress.activities["aktiviti-2"] && progress.activities["aktiviti-2"].status === "locked") {
      progress.activities["aktiviti-2"].status = "available";
    }

    saveProgress(progress);
    updateProgressUI(progress);

    goToA1Step(A1_STEP_ORDER.indexOf("selesai"));
  }

  function initActivity1() {
    a1El.btnIntroStart.addEventListener("click", function () {
      goToA1Step(A1_STEP_ORDER.indexOf("kenali-emosi-dahulu"));
    });

    a1El.btnLearnNext.addEventListener("click", function () {
      goToA1Step(A1_STEP_ORDER.indexOf("pilih-emoji"));
    });

    a1El.btnConfirmNext.addEventListener("click", function () {
      buildKategoriGrid();
      a1El.kategoriQuestion.textContent = "Pada pendapat awak, emosi ini positif atau negatif?";
      goToA1Step(A1_STEP_ORDER.indexOf("kategori"));
    });

    a1El.btnKategoriNext.addEventListener("click", function () {
      goToA1Step(A1_STEP_ORDER.indexOf("refleksi"));
    });

    a1El.btnFinish.addEventListener("click", finishActivity1);

    a1El.btnToActivity2.addEventListener("click", function () {
      renderDashboard();
    });

    a1El.backBtn.addEventListener("click", function () {
      var prevIndex = a1State.stepIndex - 1;
      if (prevIndex < 0) return;
      goToA1Step(prevIndex);
    });
  }

  /* ---------------------------------------------------------
     AKTIVITI 2 — Termometer Emosi
  --------------------------------------------------------- */

  var A2_STEP_ORDER = ["intro", "termometer", "feedback", "punca", "ringkasan", "refleksi", "selesai"];

  // Pemetaan aras WAJIB mengikut modul — bukan skala keamatan generik.
  var A2_LEVEL_LABELS = {
    0: "TENANG",
    1: "GEMBIRA",
    2: "SEDIH",
    3: "RISAU",
    4: "MARAH",
    5: "TERTEKAN"
  };

  var A2_LEVEL_FEEDBACK = {
    0: "Tenang bermaksud awak rasa aman dan tak banyak fikir apa-apa sekarang.",
    1: "Gembira bermaksud awak rasa seronok dan senang hati sekarang.",
    2: "Sedih bermaksud hati awak rasa sayu atau kecewa sekarang.",
    3: "Risau bermaksud awak rasa bimbang tentang sesuatu sekarang.",
    4: "Marah bermaksud awak rasa tak puas hati atau tersinggung sekarang.",
    5: "Tertekan bermaksud awak rasa berat atau susah nak tanggung perasaan sekarang."
  };

  var A2_PUNCA_OPTIONS = [
    { id: "ibubapa-bergaduh", label: "Ibu bapa sering bergaduh di rumah" },
    { id: "kawan-rosak-barang", label: "Kawan merosakkan barang yang dipinjam" },
    { id: "tak-siap-kerja", label: "Tidak sempat menyiapkan kerja sekolah" },
    { id: "kehilangan-barang", label: "Kehilangan barang yang disayangi" },
    { id: "pujian-guru", label: "Terima pujian daripada guru" },
    { id: "disayangi-keluarga", label: "Saya disayangi oleh keluarga" },
    { id: "sendiri", label: "Saya nak tulis sendiri" }
  ];

  var A2_REFLECTION_OPTIONS = [
    { id: "okay", emoji: "🌱", label: "Saya rasa okay.", feedback: "Bagus 😊 Awak dah dapat kenal pasti keadaan diri awak." },
    { id: "sedikit-tak-selesa", emoji: "💭", label: "Saya rasa sedikit tidak selesa.", feedback: "Okay. Awak dah sedar yang emosi itu mula buat awak rasa kurang selesa." },
    { id: "sangat-tak-selesa", emoji: "🌊", label: "Saya rasa sangat tidak selesa.", feedback: "Terima kasih sebab cuba kenal pasti keadaan diri awak. Jom kita teruskan langkah seterusnya." },
    { id: "tak-pasti", emoji: "🤔", label: "Saya tak pasti.", feedback: "Tak apa 😊 Kadang-kadang kita memang perlukan masa untuk faham apa yang kita rasa." }
  ];

  var a2El = {
    backBtn: document.getElementById("a2BackBtn"),
    stepIndicator: document.getElementById("a2StepIndicator"),
    introGreeting: document.getElementById("a2IntroGreeting"),
    btnIntroStart: document.getElementById("a2BtnIntroStart"),
    thermoFill: document.getElementById("thermoFill"),
    thermoLevels: document.getElementById("thermoLevels"),
    thermoValue: document.getElementById("thermoValue"),
    thermoLabel: document.getElementById("thermoLabel"),
    btnTermometerNext: document.getElementById("a2BtnTermometerNext"),
    feedbackValue: document.getElementById("a2FeedbackValue"),
    feedbackText: document.getElementById("a2FeedbackText"),
    btnFeedbackNext: document.getElementById("a2BtnFeedbackNext"),
    puncaGrid: document.getElementById("a2PuncaGrid"),
    puncaCustomWrap: document.getElementById("a2PuncaCustomWrap"),
    puncaTextarea: document.getElementById("a2PuncaTextarea"),
    btnPuncaNext: document.getElementById("a2BtnPuncaNext"),
    ringkasanSummary: document.getElementById("a2RingkasanSummary"),
    btnRingkasanNext: document.getElementById("a2BtnRingkasanNext"),
    reflectionGrid: document.getElementById("a2ReflectionGrid"),
    reflectionFeedback: document.getElementById("a2ReflectionFeedback"),
    btnFinish: document.getElementById("a2BtnFinish"),
    summary: document.getElementById("a2Summary"),
    btnToActivity3: document.getElementById("a2BtnToActivity3")
  };

  var a2State = {
    stepIndex: 0,
    level: null,
    puncaChoiceId: null,
    puncaText: "",
    reflectionId: null
  };

  function goToA2Step(index) {
    a2State.stepIndex = index;
    var stepName = A2_STEP_ORDER[index];

    var steps = document.querySelectorAll("#a2Steps .a1-step");
    steps.forEach(function (step) {
      step.classList.toggle("is-active", step.getAttribute("data-step") === stepName);
    });

    a2El.backBtn.hidden = (stepName === "intro" || stepName === "selesai");
    updateA2StepIndicator(stepName);
  }

  function updateA2StepIndicator(stepName) {
    var map = {
      "termometer": "Langkah 1 daripada 4",
      "feedback": "Langkah 1 daripada 4",
      "punca": "Langkah 2 daripada 4",
      "ringkasan": "Langkah 3 daripada 4",
      "refleksi": "Langkah 4 daripada 4"
    };

    if (map[stepName]) {
      a2El.stepIndicator.hidden = false;
      a2El.stepIndicator.textContent = map[stepName];
    } else {
      a2El.stepIndicator.hidden = true;
    }
  }

  function openActivity2() {
    var user = getUser();
    var progress = getProgress();

    a2State = {
      stepIndex: 0,
      level: null,
      puncaChoiceId: null,
      puncaText: "",
      reflectionId: null
    };

    if (user) {
      a2El.introGreeting.textContent = "Hai, " + user.name + "! \uD83D\uDC4B";
    }

    resetThermometer();
    buildA2PuncaGrid();
    buildA2ReflectionGrid();

    var entry2 = progress.activities["aktiviti-2"];
    if (entry2 && entry2.status === "available") {
      entry2.status = "in-progress";
      saveProgress(progress);
      renderActivityList(progress);
    }

    goToA2Step(0);
    showScreen("activity-2");
  }

  function resetThermometer() {
    a2El.thermoLevels.innerHTML = "";
    a2El.thermoFill.style.height = "0%";
    a2El.thermoValue.textContent = "\u2013 / 5";
    a2El.thermoLabel.textContent = "Pilih aras di bawah \uD83D\uDC47";

    for (var level = 0; level <= 5; level++) {
      (function (lvl) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "thermo-level-btn";
        btn.setAttribute("data-level", String(lvl));
        btn.setAttribute("aria-label", lvl + " — " + A2_LEVEL_LABELS[lvl]);

        var num = document.createElement("span");
        num.className = "thermo-level-btn__num";
        num.textContent = String(lvl);

        var labelSpan = document.createElement("span");
        labelSpan.className = "thermo-level-btn__label";
        labelSpan.textContent = A2_LEVEL_LABELS[lvl];

        btn.appendChild(num);
        btn.appendChild(labelSpan);

        btn.addEventListener("click", function () {
          selectThermoLevel(lvl);
        });

        a2El.thermoLevels.appendChild(btn);
      })(level);
    }
  }

  function selectThermoLevel(level) {
    a2State.level = level;

    var buttons = a2El.thermoLevels.querySelectorAll(".thermo-level-btn");
    buttons.forEach(function (btn) {
      btn.classList.toggle("is-selected", Number(btn.getAttribute("data-level")) === level);
    });

    a2El.thermoFill.style.height = (level / 5) * 100 + "%";
    a2El.thermoValue.textContent = level + " / 5";
    a2El.thermoLabel.textContent = A2_LEVEL_LABELS[level];
  }

  function buildA2PuncaGrid() {
    a2El.puncaGrid.innerHTML = "";
    a2El.puncaCustomWrap.hidden = true;
    a2El.puncaTextarea.value = "";

    A2_PUNCA_OPTIONS.forEach(function (option) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "choice-card";
      card.setAttribute("data-punca-id", option.id);

      var labelSpan = document.createElement("span");
      labelSpan.className = "choice-card__label";
      labelSpan.textContent = option.label;
      card.appendChild(labelSpan);

      card.addEventListener("click", function () {
        a2State.puncaChoiceId = option.id;
        a2State.puncaText = option.id === "sendiri" ? a2El.puncaTextarea.value.trim() : option.label;

        var cards = a2El.puncaGrid.querySelectorAll(".choice-card");
        cards.forEach(function (c) {
          c.classList.toggle("is-selected", c === card);
        });

        a2El.puncaCustomWrap.hidden = option.id !== "sendiri";
        if (option.id === "sendiri") {
          a2El.puncaTextarea.focus();
        }
      });

      a2El.puncaGrid.appendChild(card);
    });

    a2El.puncaTextarea.addEventListener("input", function () {
      if (a2State.puncaChoiceId === "sendiri") {
        a2State.puncaText = a2El.puncaTextarea.value.trim();
      }
    });
  }

  function buildA2ReflectionGrid() {
    a2El.reflectionGrid.innerHTML = "";
    a2El.reflectionFeedback.hidden = true;
    a2El.reflectionFeedback.textContent = "";

    A2_REFLECTION_OPTIONS.forEach(function (option) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "choice-card";
      card.setAttribute("data-reflection-id", option.id);

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "choice-card__emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = option.emoji;

      var labelSpan = document.createElement("span");
      labelSpan.className = "choice-card__label";
      labelSpan.textContent = option.label;

      card.appendChild(emojiSpan);
      card.appendChild(labelSpan);

      card.addEventListener("click", function () {
        selectA2Reflection(option.id);
      });

      a2El.reflectionGrid.appendChild(card);
    });
  }

  function selectA2Reflection(optionId) {
    a2State.reflectionId = optionId;

    var cards = a2El.reflectionGrid.querySelectorAll(".choice-card");
    cards.forEach(function (card) {
      card.classList.toggle("is-selected", card.getAttribute("data-reflection-id") === optionId);
    });

    var option = A2_REFLECTION_OPTIONS.filter(function (o) { return o.id === optionId; })[0];
    if (option) {
      a2El.reflectionFeedback.hidden = false;
      a2El.reflectionFeedback.textContent = option.feedback;
    }
  }

  function finishActivity2() {
    if (a2State.reflectionId === null) {
      showToast("Awak belum pilih jawapan lagi \uD83D\uDE0A Cuba pilih dulu.");
      return;
    }

    var progress = getProgress();
    var option = A2_REFLECTION_OPTIONS.filter(function (o) { return o.id === a2State.reflectionId; })[0];

    progress.activities["aktiviti-2"] = {
      status: "completed",
      emotionLevel: a2State.level,
      emotionLevelLabel: A2_LEVEL_LABELS[a2State.level],
      puncaChoiceId: a2State.puncaChoiceId,
      puncaText: a2State.puncaText,
      reflection: a2State.reflectionId,
      completedAt: new Date().toISOString()
    };

    if (progress.activities["aktiviti-3"] && progress.activities["aktiviti-3"].status === "locked") {
      progress.activities["aktiviti-3"].status = "available";
    }

    saveProgress(progress);
    updateProgressUI(progress);

    a2El.summary.innerHTML = "";
    a2El.summary.appendChild(buildA2SummaryRow("Aras:", a2State.level + " — " + A2_LEVEL_LABELS[a2State.level]));
    a2El.summary.appendChild(buildA2SummaryRow("Punca:", a2State.puncaText || "-"));
    a2El.summary.appendChild(buildA2SummaryRow("Keadaan:", option ? option.label : ""));

    goToA2Step(A2_STEP_ORDER.indexOf("selesai"));
  }

  function buildA2SummaryRow(labelText, valueText) {
    var row = document.createElement("div");
    row.className = "a2-summary__row";

    var label = document.createElement("span");
    label.className = "a2-summary__row-label";
    label.textContent = labelText;

    var value = document.createElement("span");
    value.className = "a2-summary__row-value";
    value.textContent = valueText;

    row.appendChild(label);
    row.appendChild(value);
    return row;
  }

  function initActivity2() {
    a2El.btnIntroStart.addEventListener("click", function () {
      goToA2Step(A2_STEP_ORDER.indexOf("termometer"));
    });

    a2El.btnTermometerNext.addEventListener("click", function () {
      if (a2State.level === null) {
        showToast("Awak belum pilih aras lagi \uD83D\uDE0A Cuba pilih dulu.");
        return;
      }
      a2El.feedbackValue.textContent = a2State.level + " — " + A2_LEVEL_LABELS[a2State.level];
      a2El.feedbackText.textContent = A2_LEVEL_FEEDBACK[a2State.level];
      goToA2Step(A2_STEP_ORDER.indexOf("feedback"));
    });

    a2El.btnFeedbackNext.addEventListener("click", function () {
      goToA2Step(A2_STEP_ORDER.indexOf("punca"));
    });

    a2El.btnPuncaNext.addEventListener("click", function () {
      if (a2State.puncaChoiceId === null) {
        showToast("Awak belum pilih punca/sebab lagi \uD83D\uDE0A Cuba pilih dulu.");
        return;
      }
      if (a2State.puncaChoiceId === "sendiri") {
        a2State.puncaText = a2El.puncaTextarea.value.trim();
      }

      a2El.ringkasanSummary.innerHTML = "";
      a2El.ringkasanSummary.appendChild(buildA2SummaryRow("Aras emosi:", a2State.level + " — " + A2_LEVEL_LABELS[a2State.level]));
      a2El.ringkasanSummary.appendChild(buildA2SummaryRow("Punca/sebab:", a2State.puncaText || "-"));

      goToA2Step(A2_STEP_ORDER.indexOf("ringkasan"));
    });

    a2El.btnRingkasanNext.addEventListener("click", function () {
      goToA2Step(A2_STEP_ORDER.indexOf("refleksi"));
    });

    a2El.btnFinish.addEventListener("click", finishActivity2);

    a2El.btnToActivity3.addEventListener("click", function () {
      renderDashboard();
    });

    a2El.backBtn.addEventListener("click", function () {
      var prevIndex = a2State.stepIndex - 1;
      if (prevIndex < 0) return;
      goToA2Step(prevIndex);
    });
  }

  /* ---------------------------------------------------------
     AKTIVITI 3 — Chici Chaca Emosiku
  --------------------------------------------------------- */

  var A3_STEP_ORDER = [
    "intro",
    "persediaan",
    "video",
    "refleksi-emosi",
    "ketenangan",
    "refleksi-akhir",
    "selesai"
  ];

  var A3_EMOTIONS_AFTER = [
    { id: "gembira", emoji: "😀", label: "Gembira", feedback: "Seronok dengar tu! 😊 Nampaknya aktiviti tadi buat awak rasa gembira." },
    { id: "tenang", emoji: "😌", label: "Tenang", feedback: "Bagus. 🌱 Awak rasa lebih tenang selepas aktiviti tadi." },
    { id: "seronok", emoji: "😄", label: "Seronok", feedback: "Yay! 🎵 Nampaknya awak menikmati aktiviti tadi." },
    { id: "biasa", emoji: "😐", label: "Biasa sahaja", feedback: "Tak apa 😊 Setiap orang boleh rasa berbeza." },
    { id: "kurang-selesa", emoji: "😕", label: "Kurang selesa", feedback: "Tak apa. Terima kasih sebab jujur tentang apa yang awak rasa." },
    { id: "risau", emoji: "😟", label: "Risau", feedback: "Tak apa 😊 Awak dah cuba kenal pasti apa yang awak rasa. Itu pun satu langkah yang baik." }
  ];

  var A3_CALMNESS_LEVELS = [
    { id: "sangat-tenang", emoji: "😌", label: "SANGAT TENANG", feedback: "Bagus! 🌱 Awak rasa sangat tenang selepas aktiviti." },
    { id: "tenang", emoji: "🙂", label: "TENANG", feedback: "Bagus 😊 Awak rasa lebih tenang selepas aktiviti." },
    { id: "tidak-tenang", emoji: "😐", label: "TIDAK TENANG", feedback: "Tak apa. Terima kasih sebab beritahu apa yang awak rasa. Kadang-kadang satu aktiviti mungkin memberi kesan yang berbeza kepada setiap orang." }
  ];

  var A3_FINAL_REFLECTION = [
    { id: "lebih-tenang", emoji: "🌱", label: "Saya rasa lebih tenang." },
    { id: "lebih-ceria", emoji: "😊", label: "Saya rasa lebih ceria." },
    { id: "seronok-bergerak", emoji: "🎵", label: "Saya seronok menyanyi dan bergerak." },
    { id: "belum-pasti", emoji: "🤔", label: "Saya belum pasti." }
  ];

  var a3El = {
    backBtn: document.getElementById("a3BackBtn"),
    stepIndicator: document.getElementById("a3StepIndicator"),
    introGreeting: document.getElementById("a3IntroGreeting"),
    btnIntroStart: document.getElementById("a3BtnIntroStart"),
    btnReady: document.getElementById("a3BtnReady"),
    btnVideoDone: document.getElementById("a3BtnVideoDone"),
    videoFrame: document.getElementById("a3VideoFrame"),
    emotionGrid: document.getElementById("a3EmotionGrid"),
    emotionFeedback: document.getElementById("a3EmotionFeedback"),
    btnEmotionNext: document.getElementById("a3BtnEmotionNext"),
    calmnessGrid: document.getElementById("a3CalmnessGrid"),
    calmnessFeedback: document.getElementById("a3CalmnessFeedback"),
    btnCalmnessNext: document.getElementById("a3BtnCalmnessNext"),
    finalReflectionGrid: document.getElementById("a3FinalReflectionGrid"),
    btnFinish: document.getElementById("a3BtnFinish"),
    summary: document.getElementById("a3Summary"),
    btnToActivity4: document.getElementById("a3BtnToActivity4")
  };

  var a3State = {
    stepIndex: 0,
    videoCompleted: false,
    emotionAfterActivity: null,
    calmnessLevel: null,
    finalReflection: null
  };

  // Simpan URL video asal SEKALI (daripada HTML asal, tidak diubah)
  // supaya iframe boleh "dihentikan" (src dikosongkan — cara paling
  // mudah & stabil untuk hentikan video+audio YouTube tanpa YouTube
  // API) apabila murid tinggalkan Aktiviti 3, dan dipulihkan semula
  // apabila Aktiviti 3 dibuka semula.
  var a3VideoSrc = a3El.videoFrame ? a3El.videoFrame.getAttribute("src") : "";

  function stopA3Video() {
    if (a3El.videoFrame) {
      a3El.videoFrame.setAttribute("src", "");
    }
  }

  function restoreA3Video() {
    if (a3El.videoFrame && a3El.videoFrame.getAttribute("src") !== a3VideoSrc) {
      a3El.videoFrame.setAttribute("src", a3VideoSrc);
    }
  }

  function goToA3Step(index) {
    a3State.stepIndex = index;
    var stepName = A3_STEP_ORDER[index];

    // Video hanya sepatutnya boleh dimainkan semasa langkah "video".
    // Beralih ke mana-mana langkah lain (termasuk teruskan atau
    // kembali) mesti hentikan video serta-merta, tanpa perlu murid
    // tekan pause dahulu.
    if (stepName === "video") {
      restoreA3Video();
    } else {
      stopA3Video();
    }

    var steps = document.querySelectorAll("#a3Steps .a3-step");
    steps.forEach(function (step) {
      step.classList.toggle("is-active", step.getAttribute("data-step") === stepName);
    });

    a3El.backBtn.hidden = (stepName === "intro" || stepName === "selesai");
    updateA3StepIndicator(stepName);
  }

  function updateA3StepIndicator(stepName) {
    var map = {
      "persediaan": "Langkah 1 daripada 4",
      "video": "Langkah 2 daripada 4",
      "refleksi-emosi": "Langkah 3 daripada 4",
      "ketenangan": "Langkah 4 daripada 4"
    };

    if (map[stepName]) {
      a3El.stepIndicator.hidden = false;
      a3El.stepIndicator.textContent = map[stepName];
    } else {
      a3El.stepIndicator.hidden = true;
    }
  }

  function openActivity3() {
    var user = getUser();
    var progress = getProgress();

    a3State = {
      stepIndex: 0,
      videoCompleted: false,
      emotionAfterActivity: null,
      calmnessLevel: null,
      finalReflection: null
    };

    if (user) {
      a3El.introGreeting.textContent = "Hai, " + user.name + "! \uD83D\uDC4B";
    }

    buildA3EmotionGrid();
    buildA3CalmnessGrid();
    buildA3FinalReflectionGrid();

    var entry3 = progress.activities["aktiviti-3"];
    if (entry3 && entry3.status === "available") {
      entry3.status = "in-progress";
      saveProgress(progress);
      renderActivityList(progress);
    }

    goToA3Step(0);
    showScreen("activity-3");
  }

  function buildA3SingleSelectGrid(container, options, onSelect, dataAttr) {
    container.innerHTML = "";
    options.forEach(function (option) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "choice-card";
      card.setAttribute(dataAttr, option.id);

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "choice-card__emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = option.emoji;

      var labelSpan = document.createElement("span");
      labelSpan.className = "choice-card__label";
      labelSpan.textContent = option.label;

      card.appendChild(emojiSpan);
      card.appendChild(labelSpan);

      card.addEventListener("click", function () {
        onSelect(option, card);
      });

      container.appendChild(card);
    });
  }

  function buildA3EmotionGrid() {
    a3El.emotionFeedback.hidden = true;
    a3El.emotionFeedback.textContent = "";

    a3El.emotionGrid.innerHTML = "";
    A3_EMOTIONS_AFTER.forEach(function (emotion) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emotion-btn";
      btn.setAttribute("data-a3-emotion-id", emotion.id);
      btn.setAttribute("aria-label", emotion.label);

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "emotion-btn__emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = emotion.emoji;

      var labelSpan = document.createElement("span");
      labelSpan.className = "emotion-btn__label";
      labelSpan.textContent = emotion.label;

      btn.appendChild(emojiSpan);
      btn.appendChild(labelSpan);

      btn.addEventListener("click", function () {
        a3State.emotionAfterActivity = emotion.id;

        var buttons = a3El.emotionGrid.querySelectorAll(".emotion-btn");
        buttons.forEach(function (b) {
          b.classList.toggle("is-selected", b.getAttribute("data-a3-emotion-id") === emotion.id);
        });

        a3El.emotionFeedback.hidden = false;
        a3El.emotionFeedback.textContent = emotion.feedback;
      });

      a3El.emotionGrid.appendChild(btn);
    });
  }

  function buildA3CalmnessGrid() {
    a3El.calmnessFeedback.hidden = true;
    a3El.calmnessFeedback.textContent = "";

    buildA3SingleSelectGrid(a3El.calmnessGrid, A3_CALMNESS_LEVELS, function (option, card) {
      a3State.calmnessLevel = option.id;

      var cards = a3El.calmnessGrid.querySelectorAll(".choice-card");
      cards.forEach(function (c) {
        c.classList.toggle("is-selected", c === card);
      });

      a3El.calmnessFeedback.hidden = false;
      a3El.calmnessFeedback.textContent = option.feedback;
    }, "data-calmness-id");
  }

  function buildA3FinalReflectionGrid() {
    buildA3SingleSelectGrid(a3El.finalReflectionGrid, A3_FINAL_REFLECTION, function (option, card) {
      a3State.finalReflection = option.id;

      var cards = a3El.finalReflectionGrid.querySelectorAll(".choice-card");
      cards.forEach(function (c) {
        c.classList.toggle("is-selected", c === card);
      });
    }, "data-final-reflection-id");
  }

  function finishActivity3() {
    if (a3State.finalReflection === null) {
      showToast("Awak belum pilih jawapan lagi \uD83D\uDE0A Cuba pilih dulu.");
      return;
    }

    var progress = getProgress();
    var emotionOption = A3_EMOTIONS_AFTER.filter(function (o) { return o.id === a3State.emotionAfterActivity; })[0];
    var calmnessOption = A3_CALMNESS_LEVELS.filter(function (o) { return o.id === a3State.calmnessLevel; })[0];
    var reflectionOption = A3_FINAL_REFLECTION.filter(function (o) { return o.id === a3State.finalReflection; })[0];

    progress.activities["aktiviti-3"] = {
      status: "completed",
      videoCompleted: a3State.videoCompleted,
      emotionAfterActivity: a3State.emotionAfterActivity,
      calmnessLevel: a3State.calmnessLevel,
      finalReflection: a3State.finalReflection,
      completedAt: new Date().toISOString()
    };

    if (progress.activities["aktiviti-4"] && progress.activities["aktiviti-4"].status === "locked") {
      progress.activities["aktiviti-4"].status = "available";
    }

    saveProgress(progress);
    updateProgressUI(progress);

    a3El.summary.innerHTML = "";
    a3El.summary.appendChild(buildA2SummaryRow("Emosi:", emotionOption ? emotionOption.emoji + " " + emotionOption.label : ""));
    a3El.summary.appendChild(buildA2SummaryRow("Tenang:", calmnessOption ? calmnessOption.emoji + " " + calmnessOption.label : ""));
    a3El.summary.appendChild(buildA2SummaryRow("Perasan:", reflectionOption ? reflectionOption.label : ""));

    goToA3Step(A3_STEP_ORDER.indexOf("selesai"));
  }

  function initActivity3() {
    a3El.btnIntroStart.addEventListener("click", function () {
      goToA3Step(A3_STEP_ORDER.indexOf("persediaan"));
    });

    a3El.btnReady.addEventListener("click", function () {
      goToA3Step(A3_STEP_ORDER.indexOf("video"));
    });

    a3El.btnVideoDone.addEventListener("click", function () {
      a3State.videoCompleted = true;
      goToA3Step(A3_STEP_ORDER.indexOf("refleksi-emosi"));
    });

    a3El.btnEmotionNext.addEventListener("click", function () {
      if (a3State.emotionAfterActivity === null) {
        showToast("Awak belum pilih jawapan lagi \uD83D\uDE0A Cuba pilih dulu.");
        return;
      }
      goToA3Step(A3_STEP_ORDER.indexOf("ketenangan"));
    });

    a3El.btnCalmnessNext.addEventListener("click", function () {
      if (a3State.calmnessLevel === null) {
        showToast("Awak belum pilih jawapan lagi \uD83D\uDE0A Cuba pilih dulu.");
        return;
      }
      goToA3Step(A3_STEP_ORDER.indexOf("refleksi-akhir"));
    });

    a3El.btnFinish.addEventListener("click", finishActivity3);

    a3El.btnToActivity4.addEventListener("click", function () {
      renderDashboard();
    });

    a3El.backBtn.addEventListener("click", function () {
      var prevIndex = a3State.stepIndex - 1;
      if (prevIndex < 0) return;
      goToA3Step(prevIndex);
    });
  }

  /* ---------------------------------------------------------
     AKTIVITI 4 — Teknik Daun Luruh
  --------------------------------------------------------- */

  var A4_STEP_ORDER = [
    "intro",
    "sediakan-diri",
    "kenali-teknik",
    "kitaran",
    "refleksi-ketenangan",
    "refleksi-akhir",
    "selesai"
  ];

  var A4_PHASE_SECONDS = { tarik: 5, tahan: 3, hembus: 5 };

  var A4_PHASE_INFO = {
    tarik: { label: "🌬️ Tarik nafas", instruction: "Tarik nafas perlahan-lahan melalui hidung.", leafClass: "a4-leaf-visual--rise" },
    tahan: { label: "⏸️ Tahan", instruction: "Tahan sekejap...", leafClass: "a4-leaf-visual--hold" },
    hembus: { label: "💨 Hembus perlahan", instruction: "Hembus perlahan-lahan melalui mulut.", leafClass: "a4-leaf-visual--fall" }
  };

  var A4_CALMNESS_LEVELS = [
    { id: "sangat-tenang", emoji: "😌", label: "Sangat tenang", feedback: "Bagus 😊 Nampaknya awak rasa sangat tenang selepas buat latihan tadi." },
    { id: "tenang", emoji: "🙂", label: "Tenang", feedback: "Bagus 😊 Awak rasa lebih tenang selepas latihan tadi." },
    { id: "tidak-tenang", emoji: "😐", label: "Tidak tenang", feedback: "Tak apa. Terima kasih sebab jujur tentang apa yang awak rasa. Setiap orang boleh rasa berbeza." }
  ];

  var A4_FINAL_REFLECTION = [
    { id: "cara-bernafas", emoji: "🌬️", label: "Saya belajar cara bernafas dengan perlahan." },
    { id: "boleh-cuba-lagi", emoji: "😌", label: "Saya boleh cuba teknik ini apabila saya perlukan masa untuk bertenang." },
    { id: "membantu", emoji: "😊", label: "Saya rasa aktiviti ini membantu saya." },
    { id: "belum-pasti", emoji: "🤔", label: "Saya masih belum pasti." }
  ];

  var a4El = {
    backBtn: document.getElementById("a4BackBtn"),
    stepIndicator: document.getElementById("a4StepIndicator"),
    introGreeting: document.getElementById("a4IntroGreeting"),
    btnIntroStart: document.getElementById("a4BtnIntroStart"),
    btnSediaReady: document.getElementById("a4BtnSediaReady"),
    btnTryOnce: document.getElementById("a4BtnTryOnce"),

    kitaranTitle: document.getElementById("a4KitaranTitle"),
    leafTracker: document.getElementById("a4LeafTracker"),
    breathingLive: document.getElementById("a4BreathingLive"),
    leafVisual: document.getElementById("a4LeafVisual"),
    phaseLabel: document.getElementById("a4PhaseLabel"),
    phaseInstruction: document.getElementById("a4PhaseInstruction"),
    countdown: document.getElementById("a4Countdown"),
    btnPause: document.getElementById("a4BtnPause"),

    pausedPanel: document.getElementById("a4PausedPanel"),
    btnResume: document.getElementById("a4BtnResume"),

    completePanel: document.getElementById("a4CompletePanel"),
    completeTitle: document.getElementById("a4CompleteTitle"),
    completeLead: document.getElementById("a4CompleteLead"),
    completeWhisper: document.getElementById("a4CompleteWhisper"),
    completeBody2: document.getElementById("a4CompleteBody2"),
    btnAfterCycle: document.getElementById("a4BtnAfterCycle"),

    calmnessGrid: document.getElementById("a4CalmnessGrid"),
    calmnessFeedback: document.getElementById("a4CalmnessFeedback"),
    btnCalmnessNext: document.getElementById("a4BtnCalmnessNext"),

    finalReflectionGrid: document.getElementById("a4FinalReflectionGrid"),
    btnFinish: document.getElementById("a4BtnFinish"),

    selesaiGreeting: document.getElementById("a4SelesaiGreeting"),
    btnToDashboard: document.getElementById("a4BtnToDashboard")
  };

  var a4State = {
    stepIndex: 0,
    cycleIndex: 0,
    leavesDown: 0,
    calmnessLevel: null,
    finalReflection: null
  };

  var a4Runtime = {
    phase: "tarik",
    secondsLeft: 5,
    paused: false,
    isDemo: true,
    intervalId: null
  };

  function goToA4Step(index) {
    a4State.stepIndex = index;
    var stepName = A4_STEP_ORDER[index];

    var steps = document.querySelectorAll("#a4Steps .a4-step");
    steps.forEach(function (step) {
      step.classList.toggle("is-active", step.getAttribute("data-step") === stepName);
    });

    a4El.backBtn.hidden = (stepName === "intro" || stepName === "selesai" || stepName === "kitaran");
    updateA4StepIndicator(stepName);
  }

  function updateA4StepIndicator(stepName) {
    var map = {
      "sediakan-diri": "Langkah 1 daripada 4",
      "kenali-teknik": "Langkah 2 daripada 4",
      "kitaran": "Langkah 3 daripada 4",
      "refleksi-ketenangan": "Langkah 4 daripada 4"
    };

    if (map[stepName]) {
      a4El.stepIndicator.hidden = false;
      a4El.stepIndicator.textContent = map[stepName];
    } else {
      a4El.stepIndicator.hidden = true;
    }
  }

  function openActivity4() {
    var user = getUser();
    var progress = getProgress();

    clearA4Timer();

    a4State = {
      stepIndex: 0,
      cycleIndex: 0,
      leavesDown: 0,
      calmnessLevel: null,
      finalReflection: null
    };

    if (user) {
      a4El.introGreeting.textContent = "Hai, " + user.name + "! \uD83D\uDC4B";
      a4El.selesaiGreeting.textContent = "Tahniah, " + user.name + "!";
    }

    buildA4CalmnessGrid();
    buildA4FinalReflectionGrid();
    renderA4LeafTracker();

    var entry4 = progress.activities["aktiviti-4"];
    if (entry4 && entry4.status === "available") {
      entry4.status = "in-progress";
      saveProgress(progress);
      renderActivityList(progress);
    }

    goToA4Step(0);
    showScreen("activity-4");
  }

  /* --- Breathing engine (shared by demo + 3 real kitaran) --- */

  function clearA4Timer() {
    if (a4Runtime.intervalId) {
      clearInterval(a4Runtime.intervalId);
      a4Runtime.intervalId = null;
    }
  }

  function startBreathingRun(isDemo) {
    clearA4Timer();

    a4Runtime = {
      phase: "tarik",
      secondsLeft: A4_PHASE_SECONDS.tarik,
      paused: false,
      isDemo: isDemo,
      intervalId: null
    };

    a4El.completePanel.hidden = true;
    a4El.pausedPanel.hidden = true;
    a4El.breathingLive.hidden = false;

    a4El.leafTracker.hidden = isDemo;
    a4El.kitaranTitle.textContent = isDemo
      ? "Jom cuba sekali dahulu \uD83D\uDC40"
      : "Kitaran " + a4State.cycleIndex + " daripada 3";

    updateA4BreathingUI();
    a4Runtime.intervalId = setInterval(tickA4Breathing, 1000);
  }

  function tickA4Breathing() {
    if (a4Runtime.paused) return;

    a4Runtime.secondsLeft--;
    if (a4Runtime.secondsLeft <= 0) {
      advanceA4Phase();
    } else {
      updateA4BreathingUI();
    }
  }

  function advanceA4Phase() {
    if (a4Runtime.phase === "tarik") {
      a4Runtime.phase = "tahan";
      a4Runtime.secondsLeft = A4_PHASE_SECONDS.tahan;
      updateA4BreathingUI();
    } else if (a4Runtime.phase === "tahan") {
      a4Runtime.phase = "hembus";
      a4Runtime.secondsLeft = A4_PHASE_SECONDS.hembus;
      updateA4BreathingUI();
    } else {
      clearA4Timer();
      onA4BreathingComplete();
    }
  }

  function updateA4BreathingUI() {
    var info = A4_PHASE_INFO[a4Runtime.phase];
    a4El.phaseLabel.textContent = info.label;
    a4El.phaseInstruction.textContent = info.instruction;
    a4El.countdown.textContent = String(a4Runtime.secondsLeft);

    a4El.leafVisual.style.transitionDuration = A4_PHASE_SECONDS[a4Runtime.phase] + "s";
    a4El.leafVisual.className = "a4-leaf-visual " + info.leafClass;
  }

  function onA4BreathingComplete() {
    a4El.breathingLive.hidden = true;
    a4El.pausedPanel.hidden = true;

    if (a4Runtime.isDemo) {
      a4El.completeTitle.textContent = "Bagus! Itu satu pusingan pernafasan 5-3-5. \uD83D\uDE0A";
      a4El.completeLead.hidden = true;
      a4El.completeWhisper.hidden = true;
      a4El.completeBody2.hidden = true;
      a4El.btnAfterCycle.textContent = "JOM BUAT 3 KITARAN";
    } else {
      a4State.leavesDown++;
      renderA4LeafTracker();

      a4El.completeTitle.textContent = "\uD83C\uDF43 Satu daun telah luruh";
      a4El.completeLead.hidden = false;
      a4El.completeLead.textContent = "Bisik atau sebut perlahan-lahan...";
      a4El.completeWhisper.hidden = false;
      a4El.completeWhisper.textContent = "\u201CRelakslah.\u201D";
      a4El.completeBody2.hidden = false;
      a4El.completeBody2.textContent = "Kalau selesa, tepuk-tepuk bahu awak perlahan-lahan.";
      a4El.btnAfterCycle.textContent = "TERUSKAN";
    }

    a4El.completePanel.hidden = false;
  }

  function renderA4LeafTracker() {
    a4El.leafTracker.innerHTML = "";
    for (var i = 1; i <= 3; i++) {
      var slot = document.createElement("span");
      slot.className = "a4-leaf-tracker__slot" + (i <= a4State.leavesDown ? " is-filled" : "");
      slot.textContent = "\uD83C\uDF43";
      a4El.leafTracker.appendChild(slot);
    }
  }

  function handleA4AfterCyclePanel() {
    if (a4Runtime.isDemo) {
      a4State.cycleIndex = 1;
      startBreathingRun(false);
      return;
    }

    if (a4State.cycleIndex < 3) {
      a4State.cycleIndex++;
      startBreathingRun(false);
    } else {
      goToA4Step(A4_STEP_ORDER.indexOf("refleksi-ketenangan"));
    }
  }

  /* --- Calmness + final reflection --- */

  function buildA4CalmnessGrid() {
    a4El.calmnessFeedback.hidden = true;
    a4El.calmnessFeedback.textContent = "";
    a4El.calmnessGrid.innerHTML = "";

    A4_CALMNESS_LEVELS.forEach(function (option) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "choice-card";
      card.setAttribute("data-a4-calmness-id", option.id);

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "choice-card__emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = option.emoji;

      var labelSpan = document.createElement("span");
      labelSpan.className = "choice-card__label";
      labelSpan.textContent = option.label;

      card.appendChild(emojiSpan);
      card.appendChild(labelSpan);

      card.addEventListener("click", function () {
        a4State.calmnessLevel = option.id;

        var cards = a4El.calmnessGrid.querySelectorAll(".choice-card");
        cards.forEach(function (c) {
          c.classList.toggle("is-selected", c === card);
        });

        a4El.calmnessFeedback.hidden = false;
        a4El.calmnessFeedback.textContent = option.feedback;
      });

      a4El.calmnessGrid.appendChild(card);
    });
  }

  function buildA4FinalReflectionGrid() {
    a4El.finalReflectionGrid.innerHTML = "";

    A4_FINAL_REFLECTION.forEach(function (option) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "choice-card";
      card.setAttribute("data-a4-reflection-id", option.id);

      var emojiSpan = document.createElement("span");
      emojiSpan.className = "choice-card__emoji";
      emojiSpan.setAttribute("aria-hidden", "true");
      emojiSpan.textContent = option.emoji;

      var labelSpan = document.createElement("span");
      labelSpan.className = "choice-card__label";
      labelSpan.textContent = option.label;

      card.appendChild(emojiSpan);
      card.appendChild(labelSpan);

      card.addEventListener("click", function () {
        a4State.finalReflection = option.id;

        var cards = a4El.finalReflectionGrid.querySelectorAll(".choice-card");
        cards.forEach(function (c) {
          c.classList.toggle("is-selected", c === card);
        });
      });

      a4El.finalReflectionGrid.appendChild(card);
    });
  }

  function finishActivity4() {
    if (a4State.finalReflection === null) {
      showToast("Awak belum pilih jawapan lagi \uD83D\uDE0A Cuba pilih dulu.");
      return;
    }

    var progress = getProgress();

    progress.activities["aktiviti-4"] = {
      status: "completed",
      breathingCycles: 3,
      calmnessLevel: a4State.calmnessLevel,
      reflection: a4State.finalReflection,
      completedAt: new Date().toISOString()
    };

    saveProgress(progress);
    updateProgressUI(progress);

    registerGlobalCompletion();

    resetCertFlow();
    goToA4Step(A4_STEP_ORDER.indexOf("selesai"));
  }

  function initActivity4() {
    a4El.btnIntroStart.addEventListener("click", function () {
      goToA4Step(A4_STEP_ORDER.indexOf("sediakan-diri"));
    });

    a4El.btnSediaReady.addEventListener("click", function () {
      goToA4Step(A4_STEP_ORDER.indexOf("kenali-teknik"));
    });

    a4El.btnTryOnce.addEventListener("click", function () {
      goToA4Step(A4_STEP_ORDER.indexOf("kitaran"));
      startBreathingRun(true);
    });

    a4El.btnPause.addEventListener("click", function () {
      a4Runtime.paused = true;
      a4El.breathingLive.hidden = true;
      a4El.pausedPanel.hidden = false;
    });

    a4El.btnResume.addEventListener("click", function () {
      a4Runtime.paused = false;
      a4El.pausedPanel.hidden = true;
      a4El.breathingLive.hidden = false;
    });

    a4El.btnAfterCycle.addEventListener("click", handleA4AfterCyclePanel);

    a4El.btnCalmnessNext.addEventListener("click", function () {
      if (a4State.calmnessLevel === null) {
        showToast("Awak belum pilih jawapan lagi \uD83D\uDE0A Cuba pilih dulu.");
        return;
      }
      goToA4Step(A4_STEP_ORDER.indexOf("refleksi-akhir"));
    });

    a4El.btnFinish.addEventListener("click", finishActivity4);

    a4El.btnToDashboard.addEventListener("click", function () {
      renderDashboard();
    });

    a4El.backBtn.addEventListener("click", function () {
      var prevIndex = a4State.stepIndex - 1;
      if (prevIndex < 0) return;
      goToA4Step(prevIndex);
    });
  }

  /* ---------------------------------------------------------
     KAD PENYERTAAN — Certificate of Participation
     Dipaparkan hanya pada skrin tamat kelompok Aktiviti 4
     (selepas Aktiviti 1-4 kesemuanya completed).

     Templat rasmi (assets/template-kad-penyertaan-apkeseri.png) digunakan
     sepenuhnya sebagai latar belakang — reka bentuknya TIDAK
     diubah. Hanya dua ruang teks dinamik dilukis di atasnya:
     nama murid dan tarikh selesai Aktiviti 4. Jadual aktiviti
     sudah statik dalam templat, jadi tidak dilukis semula.

     Rendering guna Canvas 2D (asal, tanpa library luar).
     JPEG: canvas.toBlob terus. PDF: jsPDF (CDN, lazy-load hanya
     bila murid pilih PDF — supaya APKESERI kekal ringan/offline
     untuk semua fungsi lain).
  --------------------------------------------------------- */

  var MALAY_MONTHS = [
    "Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember"
  ];

  var CERT_ACTIVITY_NAMES = [
    "Jom Kenali Emosi",
    "Termometer Emosi",
    "Chici Chaca Emosiku",
    "Teknik Daun Luruh"
  ];

  var CERT_TEMPLATE_SRC = "assets/template-kad-penyertaan-apkeseri.png";
  var CERT_TEMPLATE_W = 1492;
  var CERT_TEMPLATE_H = 1054;
  var CERT_SCALE = 2; // render at 2x template res for crisper overlaid text

  // Ruang teks dinamik, dikenal pasti daripada templat rasmi
  // (koordinat dalam piksel templat asal 1492x1054). Disemak semula
  // dan diperbetulkan menerusi analisis piksel baris-demi-baris
  // supaya meliputi SEPENUHNYA teks+bayang placeholder asal
  // (termasuk pinggir anti-alias huruf), tanpa menyentuh elemen
  // hiasan/bingkai jiran. Disahkan semula terus terhadap templat
  // "Kad Penyertaan" baharu (bukan andaian daripada templat lama) —
  // ruang NAMA kekal sama (sepadan dalam 1-2px), ruang TARIKH
  // dikecilkan sedikit kerana bingkai pil pada templat baharu
  // bermula ~4px lebih rapat berbanding templat lama.
  var CERT_NAME_BOX = { x: 336, y: 408, w: 868, h: 114 };
  var CERT_DATE_BOX = { x: 618, y: 887, w: 258, h: 38 };

  // Jalur bersih (tiada teks) diambil TERUS daripada templat asal,
  // berhampiran setiap ruang dinamik, untuk "clone" latar belakang
  // sebenar ke atas placeholder — bukan rectangle warna rata. Ini
  // mengekalkan gradient/tona sebenar templat tanpa kesan tampalan.
  var CERT_NAME_CLEAN_SRC = { x: 336, y: 392, w: 868, h: 14 };
  var CERT_DATE_CLEAN_SRC = { x: 618, y: 888, w: 258, h: 7 };

  var JSPDF_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

  var certEl = {
    card: document.getElementById("certCard"),
    stepIntro: document.getElementById("certStepIntro"),
    btnStart: document.getElementById("btnCertStart"),
    stepName: document.getElementById("certStepName"),
    nameInput: document.getElementById("certNameInput"),
    nameError: document.getElementById("certNameError"),
    btnNameNext: document.getElementById("btnCertNameNext"),
    stepPreview: document.getElementById("certStepPreview"),
    previewCanvas: document.getElementById("certPreviewCanvas"),
    btnEditName: document.getElementById("btnCertEditName"),
    statusMsg: document.getElementById("certStatusMsg"),
    btnPdf: document.getElementById("btnCertPdf"),
    btnJpeg: document.getElementById("btnCertJpeg")
  };

  var certState = {
    name: ""
  };

  var certTemplateImage = null;
  var certTemplateLoadPromise = null;
  var jsPdfLoadPromise = null;

  function formatMalayDate(isoString) {
    if (!isoString) return "";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.getDate() + " " + MALAY_MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function getActivity4CompletedAt() {
    var progress = getProgress();
    var entry = progress.activities["aktiviti-4"];
    return (entry && entry.completedAt) || null;
  }

  // Struktur data kad, sedia untuk generator (nama kad ialah
  // salinan sementara sahaja — tidak disimpan ke APKESERI_USER).
  function buildCertificateData(name, format) {
    var completedAt = getActivity4CompletedAt();
    return {
      name: name,
      completedAt: completedAt,
      completedAtDisplay: formatMalayDate(completedAt),
      activities: CERT_ACTIVITY_NAMES.slice(),
      format: format || null,
      logo: "assets/logo-apkeseri.png"
    };
  }

  function loadCertTemplate() {
    if (certTemplateImage) return Promise.resolve(certTemplateImage);
    if (certTemplateLoadPromise) return certTemplateLoadPromise;

    certTemplateLoadPromise = new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        certTemplateImage = img;
        resolve(img);
      };
      img.onerror = function () {
        certTemplateLoadPromise = null;
        reject(new Error("Templat kad tidak dapat dimuatkan"));
      };
      img.src = CERT_TEMPLATE_SRC;
    });

    return certTemplateLoadPromise;
  }

  function waitForFonts() {
    if (document.fonts && document.fonts.ready) {
      return document.fonts.ready.catch(function () {});
    }
    return Promise.resolve();
  }

  // Lukis teks satu baris, tengah dalam `box`, saiz font mengecil
  // secara automatik supaya sentiasa muat dalam SATU BARIS.
  function drawCertFittedText(ctx, text, box, opts) {
    var maxWidth = box.w * CERT_SCALE * 0.92;
    var maxFontPx = opts.maxFontPx * CERT_SCALE;
    var minFontPx = opts.minFontPx * CERT_SCALE;
    var fontSize = maxFontPx;

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    while (fontSize > minFontPx) {
      ctx.font = opts.weight + " " + fontSize + "px " + opts.family;
      if (ctx.measureText(text).width <= maxWidth) break;
      fontSize -= 2;
    }
    ctx.font = opts.weight + " " + fontSize + "px " + opts.family;

    var centerX = (box.x + box.w / 2) * CERT_SCALE;
    var centerY = (box.y + box.h / 2) * CERT_SCALE;

    if (opts.gradientTop && opts.gradientBottom) {
      var grad = ctx.createLinearGradient(0, centerY - fontSize / 2, 0, centerY + fontSize / 2);
      grad.addColorStop(0, opts.gradientTop);
      grad.addColorStop(1, opts.gradientBottom);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = opts.solidColor;
    }

    if (opts.strokeColor) {
      ctx.lineWidth = Math.max(1, fontSize * (opts.strokeWidthRatio || 0.025));
      ctx.strokeStyle = opts.strokeColor;
      ctx.strokeText(text, centerX, centerY);
    }

    ctx.fillText(text, centerX, centerY);
  }

  // Bina semula latar belakang di ruang placeholder dengan meng-
  // "klon" jalur bersih (tiada teks) daripada templat asal itu
  // sendiri — diregangkan menegak untuk menutup ruang sasaran.
  // Ini mengekalkan gradient/tekstur SEBENAR templat pada setiap
  // kedudukan x, tanpa meneka satu warna rata — jadi tiada sempadan
  // atau kesan tampalan kelihatan di sekeliling nama/tarikh.
  function cloneCleanBackground(ctx, img, srcBox, destBox) {
    ctx.drawImage(
      img,
      srcBox.x, srcBox.y, srcBox.w, srcBox.h,
      destBox.x * CERT_SCALE, destBox.y * CERT_SCALE,
      destBox.w * CERT_SCALE, destBox.h * CERT_SCALE
    );
  }

  // Lukis templat rasmi + teks dinamik ke atas `canvas`. Templat
  // itu sendiri TIDAK diubah — placeholder asal dibersihkan dengan
  // clone latar belakang sebenar (lihat cloneCleanBackground), bukan
  // rectangle warna rata, sebelum teks sebenar dilukis di ruang yang sama.
  function renderCertificateToCanvas(canvas, name, dateDisplay) {
    return loadCertTemplate().then(function (img) {
      return waitForFonts().then(function () {
        canvas.width = CERT_TEMPLATE_W * CERT_SCALE;
        canvas.height = CERT_TEMPLATE_H * CERT_SCALE;
        var ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Bersihkan placeholder dengan "clone" jalur latar belakang
        // BERSIH sebenar (diambil terus daripada templat asal,
        // berhampiran ruang dinamik) — diregangkan untuk menutup
        // sepenuhnya teks+bayang placeholder. Ini mengekalkan
        // gradient/tona sebenar templat, bukan rectangle warna rata,
        // supaya tiada kesan "tampalan" atau sempadan yang kelihatan.
        cloneCleanBackground(ctx, img, CERT_NAME_CLEAN_SRC, CERT_NAME_BOX);
        cloneCleanBackground(ctx, img, CERT_DATE_CLEAN_SRC, CERT_DATE_BOX);

        drawCertFittedText(ctx, name, CERT_NAME_BOX, {
          maxFontPx: 100,
          minFontPx: 26,
          weight: 800,
          family: '"Baloo 2", sans-serif',
          gradientTop: "#3fae6e",
          gradientBottom: "#2f8fd6",
          strokeColor: "rgba(23, 74, 66, 0.32)",
          strokeWidthRatio: 0.03
        });

        drawCertFittedText(ctx, dateDisplay || "", CERT_DATE_BOX, {
          maxFontPx: 27,
          minFontPx: 14,
          weight: 700,
          family: '"Nunito", sans-serif',
          solidColor: "#132c72"
        });

        return canvas;
      });
    });
  }

  function sanitizeCertFilenamePart(str) {
    var cleaned = String(str || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "");
    return cleaned || "Murid";
  }

  function buildCertFilename(name, ext) {
    return "Kad-Penyertaan-APKESERI-" + sanitizeCertFilenamePart(name) + "." + ext;
  }

  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
  }

  function downloadCertificateJpeg(canvas, filename) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error("Gagal menjana JPEG"));
          return;
        }
        triggerBlobDownload(blob, filename);
        resolve();
      }, "image/jpeg", 0.92);
    });
  }

  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) {
      return Promise.resolve(window.jspdf.jsPDF);
    }
    if (jsPdfLoadPromise) return jsPdfLoadPromise;

    jsPdfLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = JSPDF_CDN_URL;
      script.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) {
          resolve(window.jspdf.jsPDF);
        } else {
          jsPdfLoadPromise = null;
          reject(new Error("jsPDF tidak tersedia selepas dimuatkan"));
        }
      };
      script.onerror = function () {
        jsPdfLoadPromise = null;
        reject(new Error("Gagal memuatkan jsPDF"));
      };
      document.head.appendChild(script);
    });

    return jsPdfLoadPromise;
  }

  // PDF A4 landskap (297mm x 210mm), templat sebagai imej penuh
  // halaman — bukan screenshot pelayar.
  function downloadCertificatePdf(canvas, filename) {
    return loadJsPdf().then(function (JsPdfCtor) {
      var pdf = new JsPdfCtor({ orientation: "landscape", unit: "mm", format: "a4" });
      var dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(dataUrl, "JPEG", 0, 0, 297, 210);
      pdf.save(filename);
    });
  }

  function setCertButtonsDisabled(disabled) {
    certEl.btnPdf.disabled = disabled;
    certEl.btnJpeg.disabled = disabled;
  }

  function showCertPreview() {
    certEl.stepName.hidden = true;
    certEl.stepPreview.hidden = false;
    certEl.statusMsg.textContent = "Sedang jana pratonton\u2026";
    setCertButtonsDisabled(true);

    var certData = buildCertificateData(certState.name);

    renderCertificateToCanvas(certEl.previewCanvas, certData.name, certData.completedAtDisplay)
      .then(function () {
        certEl.statusMsg.textContent = "";
        setCertButtonsDisabled(false);
      })
      .catch(function () {
        certEl.statusMsg.textContent = "Pratonton tak dapat dipaparkan buat masa ini. Cuba lagi ya.";
        setCertButtonsDisabled(false);
      });
  }

  function handleCertDownload(format) {
    var certData = buildCertificateData(certState.name, format);
    var filename = buildCertFilename(certData.name, format === "PDF" ? "pdf" : "jpeg");

    setCertButtonsDisabled(true);
    certEl.statusMsg.textContent = format === "PDF"
      ? "Sedang jana PDF\u2026"
      : "Sedang jana JPEG\u2026";

    var task = format === "PDF"
      ? downloadCertificatePdf(certEl.previewCanvas, filename)
      : downloadCertificateJpeg(certEl.previewCanvas, filename);

    task
      .then(function () {
        certEl.statusMsg.textContent = "Kad " + format + " awak dah dimuat turun! \uD83C\uDF89";
        setCertButtonsDisabled(false);
      })
      .catch(function () {
        certEl.statusMsg.textContent = format === "PDF"
          ? "Tak dapat jana PDF sekarang. Pastikan awak online buat kali pertama, atau cuba format JPEG."
          : "Tak dapat jana JPEG sekarang. Cuba lagi ya.";
        setCertButtonsDisabled(false);
      });
  }

  function resetCertFlow() {
    if (!hasFullProgress()) return;
    if (!certEl.card) return;

    var user = getUser();
    certState.name = user ? user.name : "";

    certEl.nameInput.value = certState.name;
    certEl.nameError.hidden = true;
    certEl.nameInput.classList.remove("is-invalid");

    certEl.stepIntro.hidden = false;
    certEl.stepName.hidden = true;
    certEl.stepPreview.hidden = true;
    certEl.statusMsg.textContent = "";
  }

  function initCertFlow() {
    if (!certEl.card) return;

    certEl.btnStart.addEventListener("click", function () {
      certEl.stepIntro.hidden = true;
      certEl.stepName.hidden = false;
      certEl.nameInput.focus();
    });

    certEl.nameInput.addEventListener("input", function () {
      if (!certEl.nameError.hidden) {
        certEl.nameError.hidden = true;
        certEl.nameInput.classList.remove("is-invalid");
      }
    });

    certEl.btnNameNext.addEventListener("click", function () {
      var name = certEl.nameInput.value.trim();
      if (!name) {
        certEl.nameError.hidden = false;
        certEl.nameInput.classList.add("is-invalid");
        certEl.nameInput.focus();
        return;
      }
      certState.name = name;
      showCertPreview();
    });

    certEl.btnEditName.addEventListener("click", function () {
      certEl.stepPreview.hidden = true;
      certEl.stepName.hidden = false;
      certEl.nameInput.focus();
    });

    certEl.btnPdf.addEventListener("click", function () {
      handleCertDownload("PDF");
    });

    certEl.btnJpeg.addEventListener("click", function () {
      handleCertDownload("JPEG");
    });
  }

  // Bawa murid terus ke skrin kad (skrin tamat Aktiviti 4) daripada
  // Dashboard — untuk pautan peringatan "MUAT TURUN KAD". Hanya
  // dipanggil apabila aktiviti-4 sudah completed (disahkan sebelum ini).
  function openCertFromDashboard() {
    if (!hasFullProgress()) return;

    var user = getUser();
    if (user) {
      a4El.selesaiGreeting.textContent = "Tahniah, " + user.name + "!";
    }
    resetCertFlow();
    goToA4Step(A4_STEP_ORDER.indexOf("selesai"));
    showScreen("activity-4");
  }

  /* ---------------------------------------------------------
     REVIEW AKTIVITI — lihat hasil aktiviti yang telah selesai,
     dengan pilihan KEMBALI atau ULANG AKTIVITI. Tidak memadam
     data aktiviti lain; hanya aktiviti yang diulang di-reset.
  --------------------------------------------------------- */

  var reviewEl = {
    title: document.getElementById("reviewTitle"),
    content: document.getElementById("reviewContent"),
    mainActions: document.getElementById("reviewMainActions"),
    btnBack: document.getElementById("btnReviewBack"),
    confirmRedo: document.getElementById("reviewConfirmRedo"),
    btnRedoYes: document.getElementById("btnReviewRedoYes")
  };

  var reviewState = { activityId: null };

  function lookupLabel(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i].label;
    }
    return "";
  }

  function reviewRow(label, value) {
    var row = document.createElement("div");
    row.className = "a2-summary__row";

    var l = document.createElement("span");
    l.className = "a2-summary__row-label";
    l.textContent = label;

    var v = document.createElement("span");
    v.className = "a2-summary__row-value";
    v.textContent = value || "—";

    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function buildReviewContentA1(entry) {
    var rows = [];
    var emotion = findEmotion(entry.emotion);
    rows.push(reviewRow("Emosi:", emotion ? emotion.emoji + " " + emotion.label : ""));
    rows.push(reviewRow("Pilihan awak:", entry.categoryChosen === "positif" ? "Positif" : entry.categoryChosen === "negatif" ? "Negatif" : ""));
    rows.push(reviewRow("Kategori sebenar:", entry.categoryCorrect === "positif" ? "Positif" : entry.categoryCorrect === "negatif" ? "Negatif" : ""));
    if (entry.reflection && entry.reflection.length) {
      var labels = entry.reflection.map(function (id) { return lookupLabel(A1_REFLECTION_OPTIONS, id); });
      rows.push(reviewRow("Refleksi:", labels.join(", ")));
    }
    rows.push(reviewRow("Tarikh selesai:", formatMalayDate(entry.completedAt)));
    return rows;
  }

  function buildReviewContentA2(entry) {
    var rows = [];
    rows.push(reviewRow("Aras emosi:", entry.emotionLevel + " — " + entry.emotionLevelLabel));
    rows.push(reviewRow("Punca/sebab:", entry.puncaText));
    rows.push(reviewRow("Refleksi:", lookupLabel(A2_REFLECTION_OPTIONS, entry.reflection)));
    rows.push(reviewRow("Tarikh selesai:", formatMalayDate(entry.completedAt)));
    return rows;
  }

  function buildReviewContentA3(entry) {
    var rows = [];
    rows.push(reviewRow("Emosi selepas aktiviti:", lookupLabel(A3_EMOTIONS_AFTER, entry.emotionAfterActivity)));
    rows.push(reviewRow("Tahap ketenangan:", lookupLabel(A3_CALMNESS_LEVELS, entry.calmnessLevel)));
    rows.push(reviewRow("Apa yang awak perasan:", lookupLabel(A3_FINAL_REFLECTION, entry.finalReflection)));
    rows.push(reviewRow("Tarikh selesai:", formatMalayDate(entry.completedAt)));
    return rows;
  }

  function buildReviewContentA4(entry) {
    var rows = [];
    rows.push(reviewRow("Kitaran selesai:", entry.breathingCycles + " daripada 3"));
    rows.push(reviewRow("Tahap ketenangan:", lookupLabel(A4_CALMNESS_LEVELS, entry.calmnessLevel)));
    rows.push(reviewRow("Apa yang awak belajar:", lookupLabel(A4_FINAL_REFLECTION, entry.reflection)));
    rows.push(reviewRow("Tarikh selesai:", formatMalayDate(entry.completedAt)));
    return rows;
  }

  function openActivityReview(activityId) {
    var progress = getProgress();
    var entry = progress.activities[activityId];
    if (!entry) return;

    var def = ACTIVITY_DEFS.filter(function (d) { return d.id === activityId; })[0];
    reviewState.activityId = activityId;
    reviewEl.title.textContent = (def ? def.title : "Aktiviti") + " — Hasil Awak";

    var rows = [];
    if (activityId === "aktiviti-1") rows = buildReviewContentA1(entry);
    else if (activityId === "aktiviti-2") rows = buildReviewContentA2(entry);
    else if (activityId === "aktiviti-3") rows = buildReviewContentA3(entry);
    else if (activityId === "aktiviti-4") rows = buildReviewContentA4(entry);

    reviewEl.content.innerHTML = "";
    rows.forEach(function (row) { reviewEl.content.appendChild(row); });

    reviewEl.mainActions.hidden = false;
    reviewEl.confirmRedo.hidden = true;

    showScreen("review");
  }

  // Reset HANYA aktiviti yang diulang — data aktiviti lain, progress
  // aktiviti lain dan sistem locking tidak disentuh. Progress
  // keseluruhan dikira semula secara dinamik (bukan hard-code) bila
  // aktiviti ini completed semula.
  function restartActivity(activityId) {
    var progress = getProgress();
    var entry = progress.activities[activityId];
    if (entry) {
      entry.status = "in-progress";
    }
    saveProgress(progress);
    updateProgressUI(progress);
    renderActivityList(progress);

    if (activityId === "aktiviti-1") openActivity1();
    else if (activityId === "aktiviti-2") openActivity2();
    else if (activityId === "aktiviti-3") openActivity3();
    else if (activityId === "aktiviti-4") openActivity4();
  }

  function initReviewFlow() {
    reviewEl.btnBack.addEventListener("click", renderDashboard);

    reviewEl.btnRedoYes.addEventListener("click", function () {
      var activityId = reviewState.activityId;
      if (activityId) restartActivity(activityId);
    });
  }

  /* ---------------------------------------------------------
     TUKAR PENGGUNA (Phase 4) — modal pengesahan pada Dashboard,
     dan senarai "pilih pengguna sedia ada" pada skrin onboarding.
     Tidak memadam atau menimpa data pengguna lain.
  --------------------------------------------------------- */

  // Sediakan & papar skrin onboarding kosong — digunakan semasa
  // pengguna pertama kali ("MULA" daripada Welcome) DAN semasa
  // menukar ke pengguna baharu (selepas sahkan modal Tukar Pengguna).
  function openOnboardingScreen() {
    el.nameInput.value = "";
    el.nameError.hidden = true;
    el.nameInput.classList.remove("is-invalid");

    el.pickUserPanel.hidden = true;
    el.pickUserList.innerHTML = "";

    var users = listStoredUsers();
    el.btnPickUserToggle.hidden = users.length === 0;

    showScreen("onboarding");
    setTimeout(function () { el.nameInput.focus(); }, 50);
  }

  function openSwitchUserModal() {
    el.switchUserModal.hidden = false;
  }

  function closeSwitchUserModal() {
    el.switchUserModal.hidden = true;
  }

  function buildPickUserList() {
    el.pickUserList.innerHTML = "";
    var users = listStoredUsers();

    users.forEach(function (user) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-card";

      var labelSpan = document.createElement("span");
      labelSpan.className = "choice-card__label";
      labelSpan.textContent = user.name;

      btn.appendChild(labelSpan);
      btn.addEventListener("click", function () {
        selectExistingUser(user.userId);
      });

      el.pickUserList.appendChild(btn);
    });
  }

  // Pengguna sedia ada memilih namanya sendiri — tetapkan sebagai
  // aktif dan pulihkan Dashboard mereka. Tidak mencipta pengguna
  // baharu, tidak mengubah progress sesiapa.
  function selectExistingUser(userId) {
    setActiveUserId(userId);
    renderDashboard();
  }

  function initSwitchUserFlow() {
    el.btnSwitchUserHint.addEventListener("click", openSwitchUserModal);

    el.btnSwitchUserCancel.addEventListener("click", closeSwitchUserModal);

    el.btnSwitchUserConfirm.addEventListener("click", function () {
      // Progress pengguna semasa sudah tersimpan secara berterusan
      // (setiap saveProgress() menulis terus ke rekod pengguna aktif
      // dalam APKESERI_USERS) — tiada tindakan "simpan" tambahan
      // diperlukan di sini. Kita hanya tutup modal dan buka
      // onboarding untuk pengguna baharu; pengguna semasa KEKAL
      // dalam APKESERI_USERS dan boleh dipilih semula kemudian.
      closeSwitchUserModal();
      openOnboardingScreen();
    });

    el.btnPickUserToggle.addEventListener("click", function () {
      var willShow = el.pickUserPanel.hidden;
      if (willShow) buildPickUserList();
      el.pickUserPanel.hidden = !willShow;
    });
  }

  /* ---------------------------------------------------------
     FASA 5C — Integrasi Supabase (counter completion global)

     Terasing sepenuhnya daripada sistem pengguna/progress sedia
     ada. Tiada nama murid, userId, jawapan aktiviti atau progress
     dihantar ke Supabase — hanya membaca satu nombor agregat
     (get_completion_count). register_completion() BELUM dipanggil
     dalam fasa ini (akan datang pada Fasa 5D).
  --------------------------------------------------------- */

  var SUPABASE_URL = "https://stghghafudrctskkcgcv.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wHkFjUXxS2qQyVtRvJNbGA_w7SKqSiM";

  // Client Supabase — dibina secara defensif. Jika skrip CDN gagal
  // dimuatkan (offline / disekat), supabaseClient kekal null dan
  // APKESERI terus berfungsi seperti biasa (lihat fallback di bawah).
  var supabaseClient = null;
  try {
    if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    }
  } catch (e) {
    supabaseClient = null;
  }

  function getCachedGlobalCount() {
    var cached = readJSON(STORAGE_KEY_GLOBAL_COUNT);
    return typeof cached === "number" ? cached : null;
  }

  function setCachedGlobalCount(count) {
    if (typeof count === "number") {
      writeJSON(STORAGE_KEY_GLOBAL_COUNT, count);
    }
  }

  // Cuba ekstrak nilai numerik daripada pelbagai bentuk pulangan RPC
  // yang mungkin (skalar terus, array baris, atau objek satu medan).
  function extractCountValue(data) {
    if (typeof data === "number") return data;
    if (Array.isArray(data) && data.length > 0) {
      var row = data[0];
      if (typeof row === "number") return row;
      if (row && typeof row === "object") {
        var keys = Object.keys(row);
        if (keys.length > 0 && typeof row[keys[0]] === "number") return row[keys[0]];
      }
    }
    if (data && typeof data === "object") {
      var k2 = Object.keys(data);
      if (k2.length > 0 && typeof data[k2[0]] === "number") return data[k2[0]];
    }
    return null;
  }

  // Dapatkan jumlah completion global. Jika Supabase tidak tersedia
  // atau permintaan gagal, guna nilai cache terakhir yang berjaya —
  // jangan sekali-kali pulangkan 0 sebagai andaian gagal, dan jangan
  // hentikan APKESERI.
  async function fetchGlobalCompletionCount() {
    if (!supabaseClient) {
      return getCachedGlobalCount();
    }

    try {
      var result = await supabaseClient.rpc("get_completion_count");
      if (result && result.error) {
        return getCachedGlobalCount();
      }
      var count = extractCountValue(result ? result.data : null);
      if (typeof count === "number") {
        setCachedGlobalCount(count);
        return count;
      }
      return getCachedGlobalCount();
    } catch (e) {
      return getCachedGlobalCount();
    }
  }

  // Completion key — dijana SEKALI sahaja, disimpan, TIDAK dikaitkan
  // dengan nama/userId murid. Belum dihantar ke Supabase dalam
  // Fasa 5C — hanya disediakan untuk Fasa 5D akan datang.
  function ensureCompletionKey() {
    var existing = readJSON(STORAGE_KEY_COMPLETION_KEY);
    if (existing) return existing;

    var uuid;
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      uuid = crypto.randomUUID();
    } else {
      uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    var key = "APKESERI-COMP-" + uuid;
    writeJSON(STORAGE_KEY_COMPLETION_KEY, key);
    return key;
  }

  function hasSeenIntro() {
    return readJSON(STORAGE_KEY_INTRO_SEEN) === true;
  }

  function markIntroSeen() {
    writeJSON(STORAGE_KEY_INTRO_SEEN, true);
  }

  function formatGlobalCount(count) {
    if (typeof count !== "number") return "\u2014";
    try {
      return count.toLocaleString("ms-MY");
    } catch (e) {
      return String(count);
    }
  }

  var counterEl = {
    number: document.getElementById("globalCompletionCount"),
    btnContinue: document.getElementById("btnCounterContinue")
  };

  function showCounterScreen() {
    ensureCompletionKey();

    counterEl.number.textContent = formatGlobalCount(getCachedGlobalCount());
    showScreen("counter");

    fetchGlobalCompletionCount().then(function (count) {
      counterEl.number.textContent = formatGlobalCount(count);
    });
  }

  function initCounterScreen() {
    counterEl.btnContinue.addEventListener("click", function () {
      markIntroSeen();
      showScreen("welcome");
    });
  }

  /* ---------------------------------------------------------
     FASA 5D — Pendaftaran completion global selepas Aktiviti 4

     Guna SEMULA completion key sedia ada daripada Fasa 5C
     (ensureCompletionKey() — tidak pernah jana key baharu untuk
     completion yang sama). Duplicate dikendalikan oleh unique
     constraint pada Supabase sendiri — client tidak cuba menghalang
     panggilan berulang, hanya sentiasa hantar key yang SAMA.
     Tiada nama/userId/jawapan/progress dihantar — hanya completionKey.
  --------------------------------------------------------- */

  function getPendingCompletion() {
    return readJSON(STORAGE_KEY_PENDING_COMPLETION) === true;
  }

  function setPendingCompletion(isPending) {
    if (isPending) {
      writeJSON(STORAGE_KEY_PENDING_COMPLETION, true);
    } else {
      writeJSON(STORAGE_KEY_PENDING_COMPLETION, false);
    }
  }

  // Daftar completion sebenar A4 dengan Supabase. Dipanggil "fire
  // and forget" (tidak menyekat UI) daripada finishActivity4() sahaja
  // — bukan daripada buka/review/render A4. Jika gagal/offline, tanda
  // pending supaya dicuba semula kemudian — tidak retry agresif.
  async function registerGlobalCompletion() {
    var completionKey = ensureCompletionKey();

    if (!supabaseClient) {
      setPendingCompletion(true);
      return;
    }

    try {
      var result = await supabaseClient.rpc("register_completion", {
        p_completion_key: completionKey
      });

      if (result && result.error) {
        setPendingCompletion(true);
        return;
      }

      var count = extractCountValue(result ? result.data : null);
      if (typeof count === "number") {
        setCachedGlobalCount(count);
      }
      setPendingCompletion(false);
    } catch (e) {
      setPendingCompletion(true);
    }
  }

  // Cuba semula pendaftaran yang tertunda — dipanggil sekali apabila
  // aplikasi dibuka semula, dan apabila peranti kembali online.
  // Bukan gelung/polling — hanya satu percubaan setiap peluang.
  function retryPendingCompletionIfNeeded() {
    if (getPendingCompletion()) {
      registerGlobalCompletion();
    }
  }

  /* ---------------------------------------------------------
     Init / resume session
  --------------------------------------------------------- */

  function init() {
    migrateLegacyUserIfNeeded();

    el.btnStart.addEventListener("click", openOnboardingScreen);

    el.onboardingForm.addEventListener("submit", handleOnboardingSubmit);
    el.nameInput.addEventListener("input", clearNameError);

    el.btnGoDashboard.addEventListener("click", renderDashboard);

    var navDashboardBtn = document.getElementById("navDashboard");
    if (navDashboardBtn) {
      navDashboardBtn.addEventListener("click", renderDashboard);
    }

    el.btnDashCertReminder.addEventListener("click", openCertFromDashboard);

    initActivity1();
    initActivity2();
    initActivity3();
    initActivity4();
    initCertFlow();
    initReviewFlow();
    initSwitchUserFlow();
    initCounterScreen();

    var existingUser = getUser();
    if (existingUser && existingUser.userId) {
      // Pengguna sedia ada (ada profil/progress) — jangan anggap
      // pengguna pertama, jangan paksa lalui counter/onboarding lagi.
      markIntroSeen();
      renderDashboard();
    } else if (!hasSeenIntro()) {
      showCounterScreen();
    } else {
      showScreen("welcome");
    }

    // Fasa 5D — cuba semula pendaftaran completion yang tertunda:
    // sekali apabila aplikasi dibuka semula, dan setiap kali peranti
    // kembali online. Tidak retry agresif/gelung.
    retryPendingCompletionIfNeeded();
    window.addEventListener("online", retryPendingCompletionIfNeeded);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* =========================================================
   PWA — Pendaftaran Service Worker
   Blok berasingan & selamat: hanya berjalan jika browser
   menyokong Service Worker; tidak menyebabkan sebarang ralat
   pada browser lama atau konteks bukan-HTTPS (cth. file://).
   Tidak menyentuh logik APKESERI di atas.
   ========================================================= */
(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(function () {
        // Diam-diam abaikan (cth. dibuka melalui file:// tanpa secure
        // context, atau service-worker.js tidak dapat dicapai) —
        // APKESERI tetap berfungsi seperti biasa tanpa PWA caching.
      });
  });
})();
