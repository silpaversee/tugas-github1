const USERNAME_KEY = "cLearnUsername"; // kunci buat simpan username
const HISTORY_KEY = "cLearnQuizHistory"; // kunci buat simpan array riwayat kuiz

let formSection;
let dashboardSection;
let userForm;
let usernameInput;

// fungsi ganti user
// Konfirmasi dialog -> Hapus Username & History di LocalStorage -> Tampilkan form input nama
function handleGantiUser() {
  const yakin = confirm(
    "Apakah Anda yakin ingin mengganti user?\n\n" +
      "Username dan seluruh riwayat progres kuis akan dihapus.",
  );

  if (!yakin) return;

  // Hapus seluruh data di localStorage
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(HISTORY_KEY);

  // Sembunyikan dashboard dan munculkan kembali form input username
  if (dashboardSection) {
    dashboardSection.style.display = "none";
    dashboardSection.textContent = "";
  }
  if (formSection) {
    formSection.style.display = "block";
  }
  if (usernameInput) {
    usernameInput.value = "";
    usernameInput.focus();
  }
}

// fungsi reset progress
// Konfirmasi dialog -> Hapus History kuis saja -> Username tetap ada
function handleResetProgress(username) {
  const yakin = confirm(
    "Apakah Anda yakin ingin mereset progress kuis?\n\n" +
      "Seluruh riwayat kuis akan dihapus, tetapi username (" +
      username +
      ") tetap tersimpan.",
  );

  if (!yakin) return;

  // Hanya hapus riwayat kuis
  localStorage.removeItem(HISTORY_KEY);

  // Render ulang dashboard untuk user yang sama dengan progres bersih
  showDashboard(username);
}

// FUNGSI UTAMA MENAMPILKAN DASHBOARD
function showDashboard(username) {
  if (!dashboardSection) return;

  //  reset kontainer dashboard
  dashboardSection.textContent = "";
  dashboardSection.style.display = "block";

  //  ambil riwayat kuis dari localStorage dengan proteksi try-catch
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (e) {
    history = [];
  }

  // sapa usernya
  const greet = document.createElement("div");
  greet.className = "pd-header-row";

  const leftCol = document.createElement("div");

  const nameEl = document.createElement("p");
  nameEl.className = "pd-greet";
  nameEl.textContent = "Halo, " + username + "!";

  const subEl = document.createElement("p");
  subEl.className = "pd-subtitle";
  subEl.textContent =
    history.length === 0
      ? "Kamu belum mengerjakan quiz apapun. Yuk mulai!"
      : "Berikut progres belajarmu.";

  leftCol.appendChild(nameEl);
  leftCol.appendChild(subEl);
  greet.appendChild(leftCol);

  // container buat tombol ganti user sama reset
  const actionButtons = document.createElement("div");
  actionButtons.className = "pd-action-buttons";

  // Tombol Ganti User
  const changeBtn = document.createElement("button");
  changeBtn.type = "button";
  changeBtn.className = "pd-change-btn";
  changeBtn.textContent = "Ganti User";
  changeBtn.addEventListener("click", handleGantiUser);

  // Tombol Reset Progress
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "pd-reset-btn";
  resetBtn.textContent = "Reset Progress";
  resetBtn.addEventListener("click", function () {
    handleResetProgress(username);
  });

  actionButtons.appendChild(changeBtn);
  actionButtons.appendChild(resetBtn);
  greet.appendChild(actionButtons);

  dashboardSection.appendChild(greet);

  // perhitungan statistik
  const total = history.length;
  let avgScore = 0;
  let bestScore = 0;
  let mastered = 0;

  if (total > 0) {
    let sum = 0;
    // Hitung total skor keseluruhan untuk rata-rata
    history.forEach(function (r) {
      const p = r.percentage !== undefined ? r.percentage : r.persentase || 0;
      sum += p;
    });
    avgScore = Math.round(sum / total);

    // Cari skor tertinggi dari seluruh pengerjaan
    history.forEach(function (r) {
      const p = r.percentage !== undefined ? r.percentage : r.persentase || 0;
      if (p > bestScore) bestScore = p;
    });

    // hitung jumlah level yang sudah mahir (skor terbaik per chapter + level >= 80%)
    const best = {};
    history.forEach(function (r) {
      const k = r.chapterId + "_" + r.level;
      const p = r.percentage !== undefined ? r.percentage : r.persentase || 0;
      if (!best[k] || p > best[k]) best[k] = p;
    });
    Object.keys(best).forEach(function (k) {
      if (best[k] >= 80) mastered++;
    });
  }

  // tampilkan stat card
  const statGrid = document.createElement("div");
  statGrid.className = "pd-stat-grid";

  const stats = [
    { label: "Quiz Dikerjakan", value: total },
    { label: "Rata-rata Skor", value: total > 0 ? avgScore + "%" : "—" },
    { label: "Skor Terbaik", value: total > 0 ? bestScore + "%" : "—" },
    { label: "Level Dikuasai", value: mastered },
  ];

  stats.forEach(function (s) {
    const card = document.createElement("div");
    card.className = "pd-stat-card";

    const val = document.createElement("span");
    val.className = "pd-stat-value";
    val.textContent = s.value;

    const lbl = document.createElement("span");
    lbl.className = "pd-stat-label";
    lbl.textContent = s.label;

    card.appendChild(val);
    card.appendChild(lbl);
    statGrid.appendChild(card);
  });

  dashboardSection.appendChild(statGrid);

  // State Kosong kalau belum ada history kuis 
  if (history.length === 0) {
    const link = document.createElement("a");
    link.href = "quiz.html";
    link.className = "pd-cta-btn";
    link.textContent = "Mulai Quiz Sekarang";
    dashboardSection.appendChild(link);
    return; // Berhenti di sini jika data kuis kosong
  }

  // hitung dan kelompokan progress per bab
  const title = document.createElement("h3");
  title.className = "pd-section-title";
  title.textContent = "Progres per Bab";
  dashboardSection.appendChild(title);

  // Simpan skor terbaik & jumlah percobaan per kombinasi (chapterId + level)
  const chapMap = {};
  history.forEach(function (r) {
    const k = r.chapterId + "_" + r.level;
    const pct = r.percentage !== undefined ? r.percentage : r.persentase || 0;
    const chapTitle = r.chapterTitle || r.judul || "Bab " + r.chapterId;
    if (!chapMap[k]) {
      chapMap[k] = {
        chapterId: r.chapterId,
        title: chapTitle,
        level: r.level,
        best: pct,
        attempts: 1,
      };
    } else {
      if (pct > chapMap[k].best) chapMap[k].best = pct;
      chapMap[k].attempts++;
    }
  });

  // tampilkan daftar progress per bab ke html
  const list = document.createElement("div");
  list.className = "pd-progress-list";

  Object.keys(chapMap)
    .sort()
    .forEach(function (k) {
      const item = chapMap[k];

      // Tentukan kategori status berdasarkan skor terbaik:
      // >= 80%: mahir (Hijau)
      // >= 60%: berkembang (Kuning)
      // < 60%:  perlu Latihan (Merah)
      const statusClass =
        item.best >= 80
          ? "mastered"
          : item.best >= 60
            ? "progress"
            : "needs-work";
      const statusText =
        item.best >= 80
          ? "Mahir"
          : item.best >= 60
            ? "Berkembang"
            : "Perlu Latihan";

      const row = document.createElement("div");
      row.className = "pd-progress-row";

      // Kolom Kiri: Judul Bab, Tingkat Level, & Jumlah Percobaan
      const left = document.createElement("div");
      left.className = "pd-progress-info";

      const chapLbl = document.createElement("span");
      chapLbl.className = "pd-chap-label";
      chapLbl.textContent = "Bab " + item.chapterId + " — " + item.title;

      const lvlBadge = document.createElement("span");
      lvlBadge.className = "pd-level-badge " + item.level;
      lvlBadge.textContent =
        item.level.toUpperCase() + " · " + item.attempts + "x";

      left.appendChild(chapLbl);
      left.appendChild(lvlBadge);

      // Kolom Kanan: Persentase Skor, Status Badge, & Progress Bar
      const right = document.createElement("div");
      right.className = "pd-score-wrap";

      const pctEl = document.createElement("span");
      pctEl.className = "pd-pct";
      pctEl.textContent = item.best + "%";

      const badge = document.createElement("span");
      badge.className = "pd-status-badge " + statusClass;
      badge.textContent = statusText;

      const barTrack = document.createElement("div");
      barTrack.className = "pd-bar-track";

      const barFill = document.createElement("div");
      barFill.className = "pd-bar-fill " + statusClass;
      barFill.style.width = item.best + "%";

      barTrack.appendChild(barFill);

      const scoreLine = document.createElement("div");
      scoreLine.className = "pd-score-line";
      scoreLine.appendChild(pctEl);
      scoreLine.appendChild(badge);

      right.appendChild(scoreLine);
      right.appendChild(barTrack);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });

  dashboardSection.appendChild(list);

  // tombol navigasi lanjut kuiz
  const link = document.createElement("a");
  link.href = "quiz.html";
  link.className = "pd-cta-btn";
  link.textContent = "Lanjut Quiz";
  dashboardSection.appendChild(link);
}


// FUNGSI INIT
// Hubungkan elemen DOM.
// Pasang event listener form pendaftaran nama.
// Cek apakah ada username tersimpan di LocalStorage.
//       JIKA ADA: Sembunyikan form pendaftaran, tampilkan dashboard.
//       JIKA BELUM ADA: Sembunyikan dashboard, tampilkan form input nama.
function init() {
  formSection = document.getElementById("join-form-section");
  dashboardSection = document.getElementById("progress-dashboard");
  userForm = document.getElementById("user-form");
  usernameInput = document.getElementById("username-input");

  // event listener submit form
  if (userForm) {
    userForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = usernameInput ? usernameInput.value.trim() : "";
      if (!name) return;

      // Simpan username baru
      localStorage.setItem(USERNAME_KEY, name);

      // Bersihkan riwayat lama dari user sebelumnya
      localStorage.removeItem(HISTORY_KEY);

      if (usernameInput) usernameInput.value = "";
      if (formSection) formSection.style.display = "none";
      showDashboard(name);
    });
  }

  // Cek status user tersimpan
  const savedUser = localStorage.getItem(USERNAME_KEY);

  if (savedUser) {
    if (formSection) formSection.style.display = "none";
    showDashboard(savedUser);
  } else {
    if (dashboardSection) {
      dashboardSection.style.display = "none";
      dashboardSection.textContent = "";
    }
    if (formSection) formSection.style.display = "block";
  }
}

// baru jalankan pas dom siap
document.addEventListener("DOMContentLoaded", init());