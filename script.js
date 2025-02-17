const MIN_DATE = new Date(2022, 1, 1);
const MAX_DATE = new Date(2025, 1, 1);
const MAX_QUESTIONS = 5;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const images = Array.from({ length: 63 }, (_, i) => `images/image (${i + 1}).jpg`);

let gameState = {
  shuffledImages: [],
  currentIndex: 0,
  questionCount: 0,
  answered: false,
  skippedImages: new Set(),
  playerCount: 1,
  players: [],
  currentPlayerIndex: 0,
  firstAnswer: null
};

const monthNames = [
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
  "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"
];

function formatDate(date) {
  if (!(date instanceof Date)) return "Bilinmiyor";
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function selectPlayerCount(count) {
  gameState.playerCount = count;
  // Her iki modda da başlangıç ekranı kaybolsun:
  document.getElementById('player-count-screen').classList.add('fade-out');
  setTimeout(() => {
    document.getElementById('player-count-screen').style.display = 'none';
    if(count === 1) {
      gameState.players = [{ name: 'Tek Oyuncu', score: 0 }];
      startGame();
    } else {
      // Çok oyunculu modda, multiplayer ekranını göster:
      document.getElementById('multiplayer-setup').style.display = 'flex';
    }
  }, 500);
}

function startMultiplayerGame() {
  const p1 = document.getElementById('player1').value || 'Oyuncu 1';
  const p2 = document.getElementById('player2').value || 'Oyuncu 2';
  gameState.players = [
    { name: p1, score: 0 },
    { name: p2, score: 0 }
  ];
  document.getElementById('multiplayer-setup').classList.add('fade-out');
  setTimeout(() => {
    document.getElementById('multiplayer-setup').style.display = 'none';
    startGame();
    updatePlayerDisplay();
  }, 500);
}

function updatePlayerDisplay() {
  const container = document.getElementById('player-info');
  container.innerHTML = gameState.players.map((player, index) => 
    `<div class="player-score ${index === gameState.currentPlayerIndex ? 'current-turn' : ''}">
      ${player.name}: ${player.score}
    </div>`
  ).join('');
}

// İki oyunculu modda, her iki oyuncu da aynı seçeneği seçebilsin:
function handleAnswer(selectedDate, correctStr, event) {
  if (gameState.answered) return;
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isCorrect = selectedDate === correctStr;
  
  if(gameState.playerCount === 1) {
    document.getElementById("options").querySelectorAll("button").forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.6";
    });
    gameState.answered = true;
    if(isCorrect) currentPlayer.score++;
    showFeedback(isCorrect ? `✅ Doğru!` : `❌ Yanlış! Doğru Tarih: ${correctStr}`);
    updatePlayerDisplay();
    document.getElementById("nextButton").disabled = false;
  } else {
    // İki oyunculu mod:
    if (!gameState.firstAnswer) {
      // İlk oyuncu seçimini yapıyor; butonu devre dışı bırakmadan metne (P1) ekleyelim.
      event.target.innerHTML = event.target.innerHTML + " (P1)";
      gameState.firstAnswer = {
        player: currentPlayer,
        answer: selectedDate,
        isCorrect: isCorrect
      };
      gameState.currentPlayerIndex = 1;
      showFeedback(`${gameState.players[0].name} cevapladı. Sıra ${gameState.players[1].name}'de`);
      updatePlayerDisplay();
      return;
    } else {
      // İkinci oyuncu cevabı:
      if (event.target.innerHTML.indexOf("(P1)") !== -1 && event.target.innerHTML.indexOf("(P1, P2)") === -1) {
        event.target.innerHTML = event.target.innerHTML.replace(" (P1)", " (P1, P2)");
      } else if (!event.target.innerHTML.includes("(P1)")) {
        event.target.innerHTML = event.target.innerHTML + " (P2)";
      }
      const secondAnswer = {
        player: gameState.players[1],
        answer: selectedDate,
        isCorrect: isCorrect
      };

      if(gameState.firstAnswer.isCorrect) gameState.firstAnswer.player.score++;
      if(secondAnswer.isCorrect) gameState.players[1].score++;
      
      const feedback = 
        `${gameState.players[0].name}: ${gameState.firstAnswer.answer} (${gameState.firstAnswer.isCorrect ? '✅' : '❌'})<br>
         ${gameState.players[1].name}: ${secondAnswer.answer} (${secondAnswer.isCorrect ? '✅' : '❌'})<br>
         Doğru Tarih: ${correctStr}`;
      
      showFeedback(feedback);
      document.getElementById("options").querySelectorAll("button").forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = "0.6";
      });
      gameState.answered = true;
      gameState.currentPlayerIndex = 0;
      gameState.firstAnswer = null;
      updatePlayerDisplay();
      document.getElementById("nextButton").disabled = false;
    }
  }
}

function startGame() {
  document.querySelector(".container").style.display = "block";
  gameState.shuffledImages = [...images].sort(() => Math.random() - 0.5);
  gameState.currentIndex = 0;
  gameState.questionCount = 0;
  gameState.answered = false;
  gameState.skippedImages = new Set();
  if(gameState.playerCount === 2) updatePlayerDisplay();
  loadRandomPhoto();
}

async function loadRandomPhoto() {
  gameState.answered = false;
  document.getElementById("nextButton").disabled = true;
  showFeedback("Yükleniyor...");
  document.getElementById("options").innerHTML = "";

  const spinner = document.getElementById("loading-spinner");
  const img = document.getElementById("photo");
  spinner.style.display = "block";

  try {
    img.src = gameState.shuffledImages[gameState.currentIndex];
    await new Promise((resolve, reject) => {
      img.onload = () => {
        spinner.style.display = "none";
        resolve();
      };
      img.onerror = () => reject("Fotoğraf yüklenemedi");
    });

    const exifDate = await getExifDate(img);
    displayQuiz(exifDate);
    showFeedback("");
  } catch (error) {
    console.error("Hata:", error);
    showFeedback("Fotoğraf yüklenirken hata oluştu. Sonrakine geçiliyor...", "error");
    skipPhoto();
  }
}

async function getExifDate(imgElement) {
  return new Promise((resolve) => {
    EXIF.getData(imgElement, function() {
      const exifDate = EXIF.getTag(this, "DateTimeOriginal");
      if (exifDate) {
        const datePart = exifDate.split(" ")[0].replace(/:/g, "-");
        resolve(adjustDateToRange(datePart));
      } else {
        resolve(generateRandomDate());
      }
    });
  });
}

function adjustDateToRange(dateString) {
  const parts = dateString.split("-");
  let date = new Date(parts[0], parts[1]-1, parts[2]);
  return (date < MIN_DATE || date > MAX_DATE) ? generateRandomDate() : date;
}

function generateRandomDate() {
  return new Date(MIN_DATE.getTime() + Math.random() * (MAX_DATE.getTime() - MIN_DATE.getTime()));
}

function nextPhoto() {
  if (gameState.playerCount === 2 && gameState.firstAnswer) {
    showFeedback("Lütfen ikinci oyuncu da tahmin yapsın!");
    return;
  }
  
  gameState.questionCount++;
  if (gameState.questionCount >= MAX_QUESTIONS) {
    showEndScreen();
    return;
  }
  
  gameState.currentIndex = (gameState.currentIndex + 1) % gameState.shuffledImages.length;
  loadRandomPhoto();
}

function showEndScreen() {
  const container = document.querySelector(".container");
  container.classList.add("fade-out");
  setTimeout(() => {
    container.style.display = "none";
    const endScreen = document.getElementById("end-screen");
    endScreen.style.display = "flex";
    endScreen.classList.add("fade-in");
    document.getElementById("finalScore").innerHTML = gameState.players
      .map(p => `${p.name}: ${p.score} Puan`).join("<br>");
  }, 500);
}

function restartGame() {
  gameState.questionCount = 0;
  gameState.players.forEach(p => p.score = 0);
  document.getElementById("end-screen").style.display = "none";
  document.querySelector(".container").classList.remove("fade-out");
  startGame();
}

function displayQuiz(correctDate) {
  const optionsContainer = document.getElementById("options");
  optionsContainer.innerHTML = "";
  const correctStr = formatDate(correctDate);
  window.currentCorrectStr = correctStr;

  const fakeDates = generateFakeDates(correctDate);
  while(fakeDates.length < 4) {
    const newDate = generateRandomDate();
    if(formatDate(newDate) !== correctStr && !fakeDates.includes(newDate)) {
      fakeDates.push(newDate);
    }
  }

  fakeDates.map(formatDate)
    .concat([correctStr])
    .sort(() => Math.random() - 0.5)
    .forEach(dateStr => {
      const button = document.createElement("button");
      button.textContent = dateStr;
      button.addEventListener('click', function(e) {
        handleAnswer(dateStr, correctStr, e);
      });
      optionsContainer.appendChild(button);
    });
}

function generateFakeDates(correctDate) {
  const fakeDates = new Set();
  while (fakeDates.size < 4) {
    let newDate = new Date(correctDate.getTime() + (Math.random() * 2 - 1) * ONE_YEAR_MS);
    if(newDate < MIN_DATE) newDate = new Date(MIN_DATE);
    if(newDate > MAX_DATE) newDate = new Date(MAX_DATE);
    if(formatDate(newDate) === formatDate(correctDate)) continue;
    fakeDates.add(newDate.getTime());
  }
  return Array.from(fakeDates).map(t => new Date(t));
}

function showFeedback(message, type = "info") {
  const feedback = document.getElementById("feedback");
  feedback.innerHTML = message;
  feedback.className = type;
}

function skipPhoto() {
  gameState.skippedImages.add(gameState.currentIndex);
  gameState.currentIndex = (gameState.currentIndex + 1) % gameState.shuffledImages.length;
  loadRandomPhoto();
}

window.addEventListener("load", () => {
  document.getElementById("start-spinner").style.display = "none";
  document.getElementById("player-count-screen").classList.add("fade-in");
});

window.onbeforeunload = () => "Oyun devam ediyor. Çıkmak istediğinize emin misiniz?";
