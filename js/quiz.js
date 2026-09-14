  // varibael global
  const API_URL = "https://api-quiz-silva-default-rtdb.firebaseio.com/.json";

  // var dom
  let quizMenu;
  let quizDynamicScreen;
  let chapterGrid;
  let chapterCountEl;
  let quizLoading;
  let quizError;
  let quizErrorMessage;
  let retryQuizBtn;
  let chaptersSection;

  // var buat quiz
  let quizData = [];          // Menyimpan seluruh data bab & soal
  let babAktif = null;        // Objek bab yang sedang dikerjakan
  let levelAktif = "pemula";  // Tingkat kesulitan aktif ("pemula" / "sulit")
  let daftarSoal = [];        // Kumpulan soal dari bab & level yang dipilih
  let indeksSoal = 0;         // Urutan nomor soal saat ini (0-indexed)
  let jawabanUser = {};       // Rekap pilihan jawaban user { [soalId]: "A" }
  let skor = 0;               // Total jawaban benar yang didapatkan
  let timer = null;           // Objek interval timer detik
  let detikBerjalan = 0;      // Total durasi waktu kuis dalam detik
  let isKuisAktif = false;    // Flag penanda apakah kuis sedang berlangsung


  // FUNGSI konversi detik int jadi string
  function formatWaktu(totalDetik) {
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    const formatMenit = menit < 10 ? "0" + menit : menit;
    const formatDetik = detik < 10 ? "0" + detik : detik;
    return formatMenit + ":" + formatDetik;
  }

  // ambil data soal
  async function ambilDataQuiz() {
    if (quizLoading) quizLoading.hidden = false;
    if (quizError) quizError.hidden = true;
    if (chaptersSection) chaptersSection.hidden = true;

    // Langkah 1: Coba baca dari Cache LocalStorage
    const localData = localStorage.getItem("cLearnQuizData");
    if (localData) {
      try {
        quizData = JSON.parse(localData);
        if (quizLoading) quizLoading.hidden = true;
        if (chaptersSection) chaptersSection.hidden = false;
        tampilkanDaftarBab();
      } catch (e) {
        console.warn("Data cache tidak valid, ambil data baru...", e);
      }
    }

    // Langkah 2: Ambil data terbaru dari api nya
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error("Gagal mengambil data dari server.");
      }
      const data = await response.json();

      if (data && data.bab) {
        quizData = data.bab;
        // Simpan ke cache untuk percepat muat berikutnya
        localStorage.setItem("cLearnQuizData", JSON.stringify(quizData));
        if (quizLoading) quizLoading.hidden = true;
        if (chaptersSection) chaptersSection.hidden = false;
        tampilkanDaftarBab();
      }
    } catch (error) {
      if (!quizData || quizData.length === 0) {
        if (quizLoading) quizLoading.hidden = true;
        if (quizError) quizError.hidden = false;
        if (quizErrorMessage) quizErrorMessage.textContent = error.message;
      }
    }
  }

  // TAMPILKAN MENU DAFTAR CARD QUIZ
  function tampilkanDaftarBab() {
    if (!chapterGrid || !chapterCountEl) return;

    chapterCountEl.textContent = quizData.length + " Chapter";
    chapterGrid.textContent = "";

    quizData.forEach(function (bab) {
      const jumlahPemula = bab.levels && bab.levels.pemula ? bab.levels.pemula.length : 0;
      const jumlahSulit = bab.levels && bab.levels.sulit ? bab.levels.sulit.length : 0;

      const card = document.createElement("article");
      card.className = "chapter-card-quiz";

      // Header kartu: Badge Nomor Bab
      const header = document.createElement("div");
      header.className = "card-quiz-header";
      const badgeBab = document.createElement("span");
      badgeBab.className = "chapter-num-badge";
      badgeBab.textContent = "Bab " + (bab.id < 10 ? "0" + bab.id : bab.id);
      header.appendChild(badgeBab);

      // Judul Bab
      const judul = document.createElement("h3");
      judul.className = "chapter-quiz-title";
      judul.textContent = bab.judul;

      // Badge info jumlah soal per tingkat
      const rowBadge = document.createElement("div");
      rowBadge.className = "level-badge-row";

      const badgePemula = document.createElement("span");
      badgePemula.className = "badge-level pemula";
      badgePemula.textContent = "Pemula: " + jumlahPemula + " Soal";

      const badgeSulit = document.createElement("span");
      badgeSulit.className = "badge-level sulit";
      badgeSulit.textContent = "Sulit: " + jumlahSulit + " Soal";

      rowBadge.appendChild(badgePemula);
      rowBadge.appendChild(badgeSulit);

      // Tombol aksi mulai kuis per level
      const actionGroup = document.createElement("div");
      actionGroup.className = "chapter-action-group";

      const btnPemula = document.createElement("button");
      btnPemula.type = "button";
      btnPemula.className = "btn-start-quiz btn-pemula";
      btnPemula.textContent = "Mulai Pemula";
      btnPemula.addEventListener("click", function () {
        mulaiKuis(bab, "pemula");
      });

      const btnSulit = document.createElement("button");
      btnSulit.type = "button";
      btnSulit.className = "btn-start-quiz btn-sulit";
      btnSulit.textContent = "Mulai Sulit";
      btnSulit.addEventListener("click", function () {
        mulaiKuis(bab, "sulit");
      });

      actionGroup.appendChild(btnPemula);
      actionGroup.appendChild(btnSulit);

      card.appendChild(header);
      card.appendChild(judul);
      card.appendChild(rowBadge);
      card.appendChild(actionGroup);

      chapterGrid.appendChild(card);
    });
  }

  // MULAI QUIZ SESI
  // Cek apakah ada username di LocalStorage ('cLearnUsername').
  //   KALAU GA ADA, ingatkan user untuk input nama di Home terlebih dahulu.
  //   Set variabel state (babAktif, levelAktif, daftarSoal, reset indeks & skor).
  //   Sembunyikan menu bab, tampilkan layar dinamis kuis.
  //   Mulai interval timer (hitungan detik pengerjaan).
  //   Panggil fungsi render soal (tampilkanLayarKuis).

  function mulaiKuis(bab, level) {
    // Validasi data user dari LocalStorage
    const savedUser = localStorage.getItem("cLearnUsername");
    if (!savedUser) {
      const keHome = confirm(
        "Halo! Kamu belum memasukkan nama pengguna di halaman Home.\n\n" +
        "Silakan isi nama kamu terlebih dahulu agar progres dan nilai kuis dapat tercatat dengan rapi.\n\n" +
        "Buka halaman Home sekarang?"
      );
      if (keHome) {
        window.location.href = "index.html";
      }
      return;
    }

    if (!bab.levels || !bab.levels[level] || bab.levels[level].length === 0) {
      alert("Soal level " + level + " untuk bab ini belum tersedia.");
      return;
    }

    // reset dan atur state kuis
    babAktif = bab;
    levelAktif = level;
    daftarSoal = bab.levels[level];
    indeksSoal = 0;
    jawabanUser = {};
    skor = 0;
    detikBerjalan = 0;
    isKuisAktif = true;

    // Ganti tampilan ke layar kuis
    if (quizMenu) quizMenu.hidden = true;
    if (quizDynamicScreen) quizDynamicScreen.hidden = false;

    // Jalankan timer pengerjaan kuis (per 1 detik)
    clearInterval(timer);
    timer = setInterval(function () {
      detikBerjalan++;
      const timerEl = document.getElementById("quiz-timer-text");
      if (timerEl) {
        timerEl.textContent = formatWaktu(detikBerjalan);
      }
    }, 1000);

    tampilkanLayarKuis();
  }

  // TAMPILKAN SOAL QUIZ YG LAGI DIKERJAKAN
  // ada tombol keluar, judl bab, timer
  // progress bar nya
  // kartu soal
  // pilgan
  // kalau salah ada kotak penjelasan
  // navigasi bawah

  function tampilkanLayarKuis() {
    if (!quizDynamicScreen) return;
    quizDynamicScreen.textContent = "";

    const soalSekarang = daftarSoal[indeksSoal];
    const totalSoal = daftarSoal.length;
    const sudahDijawab = jawabanUser[soalSekarang.id] !== undefined;
    const jawabanTerpilih = jawabanUser[soalSekarang.id];
    const persenProgress = Math.round(((indeksSoal + 1) / totalSoal) * 100);
    const isSoalTerakhir = indeksSoal === totalSoal - 1;

    const section = document.createElement("section");
    section.className = "active-quiz-section";

    // ── 7.1. Header Layar Kuis ──────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "quiz-nav-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "quiz-header-left";

    // Tombol keluar kuis dengan dialog konfirmasi
    const btnKeluar = document.createElement("button");
    btnKeluar.type = "button";
    btnKeluar.className = "btn-exit-quiz";
    btnKeluar.textContent = "Keluar Kuis";
    btnKeluar.addEventListener("click", function () {
      if (confirm("Kuis belum selesai. Yakin ingin keluar?")) {
        kembaliKeMenu();
      }
    });

    const infoBab = document.createElement("div");
    infoBab.className = "quiz-header-info";

    const judulBabEl = document.createElement("h2");
    judulBabEl.className = "quiz-chapter-title";
    judulBabEl.textContent = "Bab " + babAktif.id + ": " + babAktif.judul;

    const levelBadge = document.createElement("span");
    levelBadge.className = "quiz-header-level " + levelAktif;
    levelBadge.textContent = "LEVEL " + levelAktif.toUpperCase();

    infoBab.appendChild(judulBabEl);
    infoBab.appendChild(levelBadge);
    headerLeft.appendChild(btnKeluar);
    headerLeft.appendChild(infoBab);

    // Wadah Timer Berjalan
    const timerBox = document.createElement("div");
    timerBox.className = "quiz-timer-box";
    const timerLabel = document.createElement("span");
    timerLabel.className = "timer-label";
    timerLabel.textContent = "Waktu: ";
    const timerValue = document.createElement("span");
    timerValue.id = "quiz-timer-text";
    timerValue.className = "timer-text";
    timerValue.textContent = formatWaktu(detikBerjalan);

    timerBox.appendChild(timerLabel);
    timerBox.appendChild(timerValue);
    header.appendChild(headerLeft);
    header.appendChild(timerBox);

    // Progress Bar Pengerjaan Soal 
    const progressContainer = document.createElement("div");
    progressContainer.className = "quiz-progress-container";

    const labelRow = document.createElement("div");
    labelRow.className = "progress-label-row";
    const textSoalKe = document.createElement("span");
    textSoalKe.textContent = "Soal " + (indeksSoal + 1) + " dari " + totalSoal;
    const textPersen = document.createElement("span");
    textPersen.textContent = persenProgress + "%";
    labelRow.appendChild(textSoalKe);
    labelRow.appendChild(textPersen);

    const track = document.createElement("div");
    track.className = "progress-track";
    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = persenProgress + "%";
    track.appendChild(fill);

    progressContainer.appendChild(labelRow);
    progressContainer.appendChild(track);

    //Kartu Pertanyaan 
    const questionCard = document.createElement("div");
    questionCard.className = "question-card";

    const nomorBadge = document.createElement("span");
    nomorBadge.className = "question-number-badge";
    nomorBadge.textContent = "Pertanyaan #" + (indeksSoal + 1);

    const pertanyaanText = document.createElement("h3");
    pertanyaanText.className = "question-text";
    pertanyaanText.textContent = soalSekarang.question;

    questionCard.appendChild(nomorBadge);
    questionCard.appendChild(pertanyaanText);

    // Jika soal memiliki potongan kode C
    if (soalSekarang.code) {
      const pre = document.createElement("pre");
      pre.className = "question-code-block";
      const code = document.createElement("code");
      code.textContent = soalSekarang.code;
      pre.appendChild(code);
      questionCard.appendChild(pre);
    }

    // Jika ada teks pertanyaan lanjutan setelah kode
    if (soalSekarang.questionAfterCode) {
      const qAfter = document.createElement("p");
      qAfter.className = "question-after-code";
      qAfter.textContent = soalSekarang.questionAfterCode;
      questionCard.appendChild(qAfter);
    }

    // pilgan
    const optionsList = document.createElement("div");
    optionsList.className = "options-list";
    const opsiKeys = ["A", "B", "C", "D"];

    opsiKeys.forEach(function (kunci) {
      if (!soalSekarang.options || !soalSekarang.options[kunci]) return;

      const btnOpsi = document.createElement("button");
      btnOpsi.type = "button";
      btnOpsi.className = "option-btn";

      if (sudahDijawab) {
        btnOpsi.disabled = true; // Kunci tombol jika sudah dijawab
        // Beri highlight hijau pada kunci jawaban yang benar
        if (kunci === soalSekarang.answer) {
          btnOpsi.classList.add("correct");
        }
        // Beri highlight merah jika opsi yang dipilih user salah
        if (jawabanTerpilih === kunci && jawabanTerpilih !== soalSekarang.answer) {
          btnOpsi.classList.add("wrong");
        }
        if (jawabanTerpilih === kunci) {
          btnOpsi.classList.add("user-selected");
        }
      } else {
        // Event saat opsi diklik
        btnOpsi.addEventListener("click", function () {
          pilihJawaban(soalSekarang, kunci);
        });
      }

      const keySpan = document.createElement("span");
      keySpan.className = "option-key";
      keySpan.textContent = kunci;

      const labelSpan = document.createElement("span");
      labelSpan.className = "option-label";
      labelSpan.textContent = soalSekarang.options[kunci];

      btnOpsi.appendChild(keySpan);
      btnOpsi.appendChild(labelSpan);
      optionsList.appendChild(btnOpsi);
    });

    questionCard.appendChild(optionsList);

    // ── 7.5. Kotak Penjelasan (Jika Jawaban Salah) ──────────────────────────
    const isSalah = sudahDijawab && jawabanTerpilih !== soalSekarang.answer;
    const penjelasan = soalSekarang.explain || soalSekarang.explanation;

    if (isSalah && penjelasan && penjelasan.trim() !== "") {
      const expBox = document.createElement("div");
      expBox.className = "explanation-box wrong-exp";

      const expTitle = document.createElement("h4");
      expTitle.className = "exp-title";
      expTitle.textContent = "Penjelasan Jawaban:";

      const expDesc = document.createElement("p");
      expDesc.className = "exp-desc";
      expDesc.textContent = penjelasan.trim();

      expBox.appendChild(expTitle);
      expBox.appendChild(expDesc);
      questionCard.appendChild(expBox);
    }

    // bavigasi soal 
    const controlsBar = document.createElement("div");
    controlsBar.className = "quiz-controls-bar";

    // Tombol Soal Sebelumnya
    const btnPrev = document.createElement("button");
    btnPrev.type = "button";
    btnPrev.className = "btn-nav-quiz btn-prev";
    btnPrev.textContent = "Soal Sebelumnya";
    if (indeksSoal === 0) {
      btnPrev.disabled = true;
    } else {
      btnPrev.addEventListener("click", function () {
        indeksSoal--;
        tampilkanLayarKuis();
      });
    }

    // Tombol Soal Berikutnya / Selesai Kuis
    const btnNext = document.createElement("button");
    btnNext.type = "button";
    btnNext.className = "btn-nav-quiz btn-next" + (isSoalTerakhir ? " finish" : "");
    btnNext.textContent = isSoalTerakhir ? "Selesai & Lihat Hasil" : "Soal Berikutnya";
    
    // User WAJIB memilih jawaban sebelum bisa lanjut ke soal berikutnya
    if (!sudahDijawab) {
      btnNext.disabled = true;
    } else {
      btnNext.addEventListener("click", function () {
        if (isSoalTerakhir) {
          selesaiKuis();
        } else {
          indeksSoal++;
          tampilkanLayarKuis();
        }
      });
    }

    controlsBar.appendChild(btnPrev);
    controlsBar.appendChild(btnNext);

    section.appendChild(header);
    section.appendChild(progressContainer);
    section.appendChild(questionCard);
    section.appendChild(controlsBar);

    quizDynamicScreen.appendChild(section);
  }

  // fungsi logika pilih jawaban
  function pilihJawaban(soal, kunciDipilih) {
    jawabanUser[soal.id] = kunciDipilih;
    if (kunciDipilih === soal.answer) {
      skor++;
    }
    tampilkanLayarKuis();
  }

  // QUIZ SELESAI DAN SIMPAN KE LOCALSTORAGE
  function selesaiKuis() {
    isKuisAktif = false;
    clearInterval(timer);

    const total = daftarSoal.length;
    const persentase = Math.round((skor / total) * 100);

    // Bentuk objek hasil kuis
    const hasil = {
      chapterId: babAktif.id,
      judul: babAktif.judul,
      chapterTitle: babAktif.judul,
      level: levelAktif,
      skor: skor,
      total: total,
      persentase: persentase,
      percentage: persentase,
      waktu: detikBerjalan
    };

    // Simpan ke LocalStorage (cLearnQuizHistory)
    try {
      const riwayat = JSON.parse(localStorage.getItem("cLearnQuizHistory") || "[]");
      riwayat.push(hasil);
      localStorage.setItem("cLearnQuizHistory", JSON.stringify(riwayat));
    } catch (e) {
      console.warn("Gagal menyimpan riwayat kuis:", e);
    }

    tampilkanHalamanHasil(hasil);
  }

  // TAMPILAN REKAP NILAI / HASILNYA
  function tampilkanHalamanHasil(hasil) {
    if (!quizDynamicScreen) return;
    quizDynamicScreen.textContent = "";

    const section = document.createElement("section");
    section.className = "results-section";

    const card = document.createElement("div");
    card.className = "results-card";

    // Kategori pesan hasil
    let pesanJudul = "Kuis Selesai";
    let pesanDeskripsi = "Anda telah menyelesaikan kuis pada bab ini.";

    if (hasil.persentase >= 85) {
      pesanJudul = "Hasil Sangat Baik";
      pesanDeskripsi = "Pemahaman Anda terhadap materi bab ini sudah sangat solid.";
    } else if (hasil.persentase >= 60) {
      pesanJudul = "Hasil Cukup Baik";
      pesanDeskripsi = "Anda telah memahami sebagian besar konsep dasar pada bab ini.";
    } else {
      pesanJudul = "Perlu Latihan Lagi";
      pesanDeskripsi = "Silakan pelajari kembali materi bab ini untuk meningkatkan pemahaman Anda.";
    }

    const titleEl = document.createElement("h2");
    titleEl.className = "results-title";
    titleEl.textContent = pesanJudul;

    const descEl = document.createElement("p");
    descEl.className = "results-desc";
    descEl.textContent = pesanDeskripsi;

    // Display Badge Nilai
    const scorePill = document.createElement("div");
    scorePill.className = "score-display-pill";

    const scoreNum = document.createElement("span");
    scoreNum.className = "score-percent";
    scoreNum.textContent = hasil.persentase + "%";

    const scoreSub = document.createElement("span");
    scoreSub.className = "score-subtext";
    scoreSub.textContent = hasil.skor + " dari " + hasil.total + " Soal Benar";

    scorePill.appendChild(scoreNum);
    scorePill.appendChild(scoreSub);

    // Grid Rincian Statistik
    const statsGrid = document.createElement("div");
    statsGrid.className = "results-stats-grid";

    function buatStatItem(label, nilai) {
      const box = document.createElement("div");
      box.className = "stat-detail-item";
      const lbl = document.createElement("span");
      lbl.className = "stat-detail-label";
      lbl.textContent = label;
      const val = document.createElement("strong");
      val.className = "stat-detail-val";
      val.textContent = nilai;
      box.appendChild(lbl);
      box.appendChild(val);
      return box;
    }

    statsGrid.appendChild(buatStatItem("Waktu Pengerjaan", formatWaktu(hasil.waktu)));
    statsGrid.appendChild(buatStatItem("Tingkat Kesulitan", hasil.level.toUpperCase()));
    statsGrid.appendChild(buatStatItem("Bab Materi", "Bab " + hasil.chapterId));

    // Baris Tombol Aksi Pasca Kuis
    const actionsRow = document.createElement("div");
    actionsRow.className = "results-actions-row";

    const btnUlangi = document.createElement("button");
    btnUlangi.type = "button";
    btnUlangi.className = "btn-result-action btn-retry";
    btnUlangi.textContent = "Ulangi Kuis";
    btnUlangi.addEventListener("click", function () {
      mulaiKuis(babAktif, levelAktif);
    });

    const btnMenu = document.createElement("button");
    btnMenu.type = "button";
    btnMenu.className = "btn-result-action btn-chapters";
    btnMenu.textContent = "Kembali ke Menu Kuis";
    btnMenu.addEventListener("click", kembaliKeMenu);

    const linkMateri = document.createElement("a");
    linkMateri.className = "btn-result-action btn-materi";
    linkMateri.href = "materi.html";
    linkMateri.textContent = "Baca Materi";

    actionsRow.appendChild(btnUlangi);
    actionsRow.appendChild(btnMenu);
    actionsRow.appendChild(linkMateri);

    card.appendChild(titleEl);
    card.appendChild(descEl);
    card.appendChild(scorePill);
    card.appendChild(statsGrid);
    card.appendChild(actionsRow);

    section.appendChild(card);
    quizDynamicScreen.appendChild(section);
  }

  // navigasi kembali ke menu
  function kembaliKeMenu() {
    isKuisAktif = false;
    clearInterval(timer);
    if (quizDynamicScreen) {
      quizDynamicScreen.hidden = true;
      quizDynamicScreen.textContent = "";
    }
    if (quizMenu) quizMenu.hidden = false;
  }

  // init aplikasi nya
  function initQuiz() {

    // hubungkan elemen DOM setelah HTML siap
    quizMenu = document.getElementById("quiz-menu");
    quizDynamicScreen = document.getElementById("quiz-dynamic-screen");
    chapterGrid = document.getElementById("chapter-grid");
    chapterCountEl = document.getElementById("chapter-count");
    quizLoading = document.getElementById("quiz-loading");
    quizError = document.getElementById("quiz-error");
    quizErrorMessage = document.getElementById("quiz-error-message");
    retryQuizBtn = document.getElementById("retry-quiz-btn");
    chaptersSection = document.getElementById("chapters-section");

    // Event listener tombol retry error
    if (retryQuizBtn) {
      retryQuizBtn.addEventListener("click", ambilDataQuiz);
    }

    // Proteksi navigasi sidebar saat kuis sedang berlangsung
    const sidebarLinks = document.querySelectorAll(".side-menu a");
    sidebarLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (!isKuisAktif) return; 

        event.preventDefault();
        const targetHref = link.getAttribute("href");
        const isMenuKuis = link.classList.contains("active-menu");

        const pesan = isMenuKuis
          ? "Kuis sedang berlangsung. Progres akan hilang jika kembali ke menu. Batalkan kuis?"
          : "Kuis sedang berlangsung. Progres akan hilang jika meninggalkan halaman. Yakin keluar?";

        if (confirm(pesan)) {
          if (isMenuKuis) {
            kembaliKeMenu();
          } else {
            isKuisAktif = false;
            clearInterval(timer);
            window.location.href = targetHref;
          }
        }
      });
    });

    // Proteksi reload / close tab saat kuis berlangsung
    window.addEventListener("beforeunload", function (event) {
      if (isKuisAktif) {
        event.preventDefault();
        event.returnValue = "";
      }
    });

    // Mulai memuat data kuis
    ambilDataQuiz();
  }

  // jalankan JS setelah DOM siap
  document.addEventListener("DOMContentLoaded", initQuiz);