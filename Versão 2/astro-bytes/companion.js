"use strict";

/* Configuration */

const STORAGE_KEY = "astroBytes.companion.demo.v1";
const GAME_DURATION_SECONDS = 20;
const MAX_VISIBLE_COINS = 7;

const imagePaths = {
  normal: "images/rise_pet_normal.png",
  happy: "images/rise_pet_happy.png",
  love: "images/rise_pet_love.png",
  proud: "images/rise_pet_proud.png",
  surprise: "images/rise_pet_surprise.png",
  asleep: "images/rise_pet_asleep.png",
  grumpy: "images/rise_pet_grumpy.png",
  wink: "images/rise_pet_wink.png"
};

const imageDescriptions = {
  normal: "Rise smiling",
  happy: "Rise looking happy",
  love: "Rise with heart-shaped eyes",
  proud: "Rise looking proud",
  surprise: "Rise looking surprised",
  asleep: "Rise sleeping",
  grumpy: "Rise looking grumpy",
  wink: "Rise winking"
};

const defaultMessage = "Hello, explorer! Ready for a little break?";

/* Elements */

const sleepAnimation = document.querySelector("#sleep-animation");

const petImage = document.querySelector("#pet-image");
const petMessage = document.querySelector("#pet-message");
const petFaceButton = document.querySelector("#pet-face-button");
const petTie = document.querySelector("#pet-tie");
const petHelmet = document.querySelector("#pet-helmet");
const petOutfitLabel = document.querySelector("#pet-outfit-label");

const cheerButton = document.querySelector("#cheer-button");
const affectionButton = document.querySelector("#affection-button");
const restButton = document.querySelector("#rest-button");
const collectButton = document.querySelector("#collect-button");
const customizeButton = document.querySelector("#customize-button");

const coinBalance = document.querySelector("#coin-balance");
const shopBalance = document.querySelector("#shop-balance");
const setupNote = document.querySelector("#companion-setup-note");

const gameDialog = document.querySelector("#coin-game-dialog");
const gameArea = document.querySelector("#coin-game-area");
const gameTime = document.querySelector("#game-time");
const gameScore = document.querySelector("#game-score");
const gameMessage = document.querySelector("#game-message");
const startGameButton = document.querySelector("#start-game-button");

const shopDialog = document.querySelector("#customize-dialog");
const shopMessage = document.querySelector("#shop-message");
const removeAccessoriesButton = document.querySelector(
  "#remove-accessories-button"
);

const accessories = {
  tie: {
    name: "Bow Tie",
    price: 50,
    image: petTie,
    buyButton: document.querySelector("#buy-tie-button"),
    equipButton: document.querySelector("#equip-tie-button"),
    status: document.querySelector("#tie-status")
  },
  helmet: {
    name: "Helmet",
    price: 100,
    image: petHelmet,
    buyButton: document.querySelector("#buy-helmet-button"),
    equipButton: document.querySelector("#equip-helmet-button"),
    status: document.querySelector("#helmet-status")
  }
};

/* Saved demonstration progress */

function createDefaultProgress() {
  return {
    coins: 0,
    owned: {
      tie: false,
      helmet: false
    },
    equipped: {
      tie: false,
      helmet: false
    }
  };
}

let storageAvailable = true;

function loadProgress() {
  const fallback = createDefaultProgress();

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!saved || typeof saved !== "object") {
      return fallback;
    }

    fallback.coins =
      Number.isSafeInteger(saved.coins) && saved.coins >= 0
        ? saved.coins
        : 0;

    for (const key of ["tie", "helmet"]) {
      fallback.owned[key] = saved.owned?.[key] === true;
      fallback.equipped[key] =
        fallback.owned[key] && saved.equipped?.[key] === true;
    }

    return fallback;
  } catch {
    storageAvailable = false;
    return fallback;
  }
}

const progress = loadProgress();

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }

  updateStorageNotice();
}

function updateStorageNotice() {
  setupNote.textContent = storageAvailable
    ? "Virtual coins and accessories are saved in this browser for this demo."
    : "Progress is available for this session, but browser storage is unavailable.";
}

/* Preload expressions to make changes smoother. */

const expressionImages = Object.values(imagePaths).map((path) => {
  const image = new Image();
  image.src = path;
  return image;
});

/* Pet expressions */

let isAsleep = false;
let expressionTimeout = null;
let pokeCount = 0;
let lastPokeTime = 0;

function showExpression(expression, message) {
  petImage.src = imagePaths[expression];
  petImage.alt = imageDescriptions[expression];
  petMessage.textContent = message;
}

function showRestingExpression() {
  if (isAsleep) {
    showExpression("asleep", "Rest mode. I will be here when you return.");
  } else {
    showExpression("normal", defaultMessage);
  }
}

function react(expression, message, duration = 3000) {
  window.clearTimeout(expressionTimeout);
  showExpression(expression, message);

  expressionTimeout = window.setTimeout(() => {
    showRestingExpression();
  }, duration);
}

function resetPokes() {
  pokeCount = 0;
  lastPokeTime = 0;
}

cheerButton.addEventListener("click", () => {
  if (isAsleep) return;

  resetPokes();
  react("happy", "A little smile for your space journey!");
});

affectionButton.addEventListener("click", () => {
  if (isAsleep) return;

  resetPokes();
  react("love", "Sending a little love across the stars!");
});

restButton.addEventListener("click", () => {
  window.clearTimeout(expressionTimeout);
  resetPokes();

  isAsleep = !isAsleep;
  sleepAnimation.hidden = !isAsleep;

  restButton.textContent = isAsleep ? "Wake Up" : "Rest";
  cheerButton.disabled = isAsleep;
  affectionButton.disabled = isAsleep;

  showRestingExpression();
});

petFaceButton.addEventListener("click", () => {
  if (isAsleep) {
    react("asleep", "Zzz... Use Wake Up when you are ready.");
    return;
  }

  const now = performance.now();

  pokeCount = now - lastPokeTime < 1200 ? pokeCount + 1 : 1;
  lastPokeTime = now;

  if (pokeCount >= 3) {
    react("grumpy", "Hey! Watch the helmet!", 2500);
  } else {
    react("surprise", "Oh! You found me!", 1800);
  }
});

/* Wallet and customization */

function updateProgressDisplay() {
  coinBalance.value = String(progress.coins);
  shopBalance.value = String(progress.coins);

  const equippedNames = [];

  for (const [key, accessory] of Object.entries(accessories)) {
    const owned = progress.owned[key];
    const equipped = progress.equipped[key];

    accessory.image.hidden = !equipped;

    accessory.buyButton.disabled =
      owned || progress.coins < accessory.price;

    accessory.buyButton.textContent = owned
      ? `${accessory.name} Owned`
      : `Buy ${accessory.name} — ${accessory.price} coins`;

    accessory.equipButton.disabled = !owned;
    accessory.equipButton.textContent = equipped
      ? `Remove ${accessory.name}`
      : `Equip ${accessory.name}`;

    accessory.equipButton.setAttribute(
      "aria-pressed",
      String(equipped)
    );

    if (equipped) {
      accessory.status.textContent = "Equipped";
      equippedNames.push(accessory.name);
    } else if (owned) {
      accessory.status.textContent = "Owned";
    } else {
      const remaining = Math.max(0, accessory.price - progress.coins);

      accessory.status.textContent = remaining > 0
        ? `${remaining} more coins needed`
        : "Ready to buy";
    }
  }

  petOutfitLabel.textContent = equippedNames.length
    ? `Outfit: ${equippedNames.join(" + ")}`
    : "Outfit: Original";

  removeAccessoriesButton.disabled = equippedNames.length === 0;
}

for (const [key, accessory] of Object.entries(accessories)) {
  accessory.buyButton.addEventListener("click", () => {
    if (progress.owned[key]) return;

    if (progress.coins < accessory.price) {
      shopMessage.textContent = "Collect more coins to unlock this item.";
      return;
    }

    progress.coins -= accessory.price;
    progress.owned[key] = true;
    progress.equipped[key] = true;

    saveProgress();
    updateProgressDisplay();

    shopMessage.textContent =
      `${accessory.name} purchased and equipped!`;

    if (!isAsleep) {
      react("proud", "A new look for a new adventure!");
    }
  });

  accessory.equipButton.addEventListener("click", () => {
    if (!progress.owned[key]) return;

    progress.equipped[key] = !progress.equipped[key];

    saveProgress();
    updateProgressDisplay();

    shopMessage.textContent = progress.equipped[key]
      ? `${accessory.name} equipped.`
      : `${accessory.name} removed.`;
  });
}

removeAccessoriesButton.addEventListener("click", () => {
  progress.equipped.tie = false;
  progress.equipped.helmet = false;

  saveProgress();
  updateProgressDisplay();

  shopMessage.textContent =
    "Accessories removed. Your purchased items are still available.";
});

customizeButton.addEventListener("click", () => {
  updateProgressDisplay();
  shopMessage.textContent = "";

  if (!shopDialog.open) {
    shopDialog.showModal();
  }
});

/* Coin game */

const game = {
  running: false,
  score: 0,
  deadline: 0,
  clockInterval: null,
  spawnInterval: null
};

const coinExpiryTimers = new Map();

function removeCoin(coin) {
  window.clearTimeout(coinExpiryTimers.get(coin));
  coinExpiryTimers.delete(coin);
  coin.remove();
}

function clearCoins() {
  for (const timer of coinExpiryTimers.values()) {
    window.clearTimeout(timer);
  }

  coinExpiryTimers.clear();
  gameArea.replaceChildren();
}

function focusNextGameControl() {
  const nextCoin = gameArea.querySelector(".game-coin");

  if (nextCoin) {
    nextCoin.focus({ preventScroll: true });
  } else {
    gameDialog.querySelector(".dialog-close").focus({
      preventScroll: true
    });
  }
}

function spawnCoin() {
  if (!game.running) return;

  if (performance.now() >= game.deadline) {
    finishGame();
    return;
  }

  if (gameArea.childElementCount >= MAX_VISIBLE_COINS) return;

  const coin = document.createElement("button");
  coin.type = "button";
  coin.className = "game-coin";
  coin.setAttribute("aria-label", "Collect one coin");

  const image = document.createElement("img");
  image.src = "images/rise_coin.png";
  image.alt = "";
  image.draggable = false;

  coin.append(image);

  /* Leave space around the edges for the floating animation. */

  const coinSize = 60;
  const padding = 14;

  const maxX = Math.max(
    padding,
    gameArea.clientWidth - coinSize - padding - 2
  );

  const maxY = Math.max(
    padding,
    gameArea.clientHeight - coinSize - padding - 2
  );

  coin.style.left =
    `${padding + Math.random() * (maxX - padding)}px`;

  coin.style.top =
    `${padding + Math.random() * (maxY - padding)}px`;

  coin.style.animationDelay = `${-Math.random() * 2}s`;

  coin.addEventListener("click", () => {
    if (!game.running || !coin.isConnected) return;

    if (performance.now() >= game.deadline) {
      finishGame();
      return;
    }

    const hadFocus = document.activeElement === coin;

    removeCoin(coin);

    game.score += 1;
    gameScore.value = String(game.score);

    spawnCoin();

    if (hadFocus) {
      focusNextGameControl();
    }
  });

  /* A keyboard-focused coin remains available until focus moves away. */

  function scheduleExpiry() {
    window.clearTimeout(coinExpiryTimers.get(coin));

    const timer = window.setTimeout(() => {
      if (!coin.isConnected) return;

      if (document.activeElement === coin) {
        scheduleExpiry();
        return;
      }

      removeCoin(coin);
    }, 3500);

    coinExpiryTimers.set(coin, timer);
  }

  gameArea.append(coin);
  scheduleExpiry();
}

function updateGameClock() {
  if (!game.running) return;

  const remaining = Math.max(
    0,
    Math.ceil((game.deadline - performance.now()) / 1000)
  );

  gameTime.textContent = String(remaining);

  if (remaining === 0) {
    finishGame();
  }
}

function finishGame(endedEarly = false) {
  if (!game.running) return;

  game.running = false;

  window.clearInterval(game.clockInterval);
  window.clearInterval(game.spawnInterval);

  clearCoins();

  const availableSpace = Number.MAX_SAFE_INTEGER - progress.coins;
  const earned = Math.min(game.score, availableSpace);

  progress.coins += earned;

  saveProgress();
  updateProgressDisplay();

  const result = endedEarly
    ? `Round ended early. You earned ${earned} coins.`
    : `Time is up! You earned ${earned} coins.`;

  gameMessage.textContent = result;

  startGameButton.disabled = false;
  startGameButton.textContent = "Play Again";

  if (!endedEarly) {
    startGameButton.focus({ preventScroll: true });
  }

  if (!isAsleep) {
    react(
      earned > 0 ? "proud" : "wink",
      earned > 0
        ? `You collected ${earned} coins! Nice exploring!`
        : "Thanks for playing! Another round whenever you like.",
      4000
    );
  }
}

function startGame() {
  if (game.running) return;

  clearCoins();

  game.running = true;
  game.score = 0;
  game.deadline =
    performance.now() + GAME_DURATION_SECONDS * 1000;

  gameScore.value = "0";
  gameTime.textContent = String(GAME_DURATION_SECONDS);

  startGameButton.disabled = true;
  gameMessage.textContent = "Collect the floating coins!";

  for (let index = 0; index < 5; index += 1) {
    spawnCoin();
  }

  focusNextGameControl();

  game.clockInterval = window.setInterval(updateGameClock, 100);
  game.spawnInterval = window.setInterval(spawnCoin, 500);
}

collectButton.addEventListener("click", () => {
  if (gameDialog.open) return;

  game.score = 0;
  gameScore.value = "0";
  gameTime.textContent = String(GAME_DURATION_SECONDS);

  gameMessage.textContent = "Select Start Game when you are ready.";
  startGameButton.textContent = "Start Game";
  startGameButton.disabled = false;

  gameDialog.showModal();
  startGameButton.focus();
});

startGameButton.addEventListener("click", startGame);

/* Escape and Close both finish the round and keep collected coins. */

gameDialog.addEventListener("cancel", () => {
  finishGame(true);
});

gameDialog.addEventListener("close", () => {
  finishGame(true);
});

window.addEventListener("pagehide", () => {
  finishGame(true);
});

/* Initialize the page. */

cheerButton.disabled = false;
affectionButton.disabled = false;
restButton.disabled = false;
collectButton.disabled = false;
customizeButton.disabled = false;
petFaceButton.disabled = false;
startGameButton.disabled = false;

updateProgressDisplay();
updateStorageNotice();
showRestingExpression();