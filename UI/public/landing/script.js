// =========================
// HERO WORD LOOP
// =========================
const heroFontFamilies = [
  "InterHeroLocal",
  "BrunoLocal",
  "ElectrolizeLocal",
  "Jura",
  "Kelly Slab",
  "Megrim",
  "SilkscreenLocal",
  "SixtyfourLocal",
  "UbuntuMonoLocal"
];

function waitForHeroFonts() {
  if (!document.fonts?.load) {
    return Promise.resolve();
  }

  const fontLoads = heroFontFamilies.map((family) =>
    document.fonts.load(`64px "${family}"`)
  );

  return Promise.allSettled(fontLoads).then(() => document.fonts.ready);
}

function startHeroWordLoop() {
  const wordTrack = document.getElementById("wordTrack");
  const wordItems = Array.from(document.querySelectorAll(".word"));

  if (!wordTrack || wordItems.length === 0) {
    return;
  }
  let currentWordIndex = 0;
  let isResettingWordLoop = false;

  const getWordHeight = () => wordItems[0].offsetHeight;

  function goToWord(index, animated = true) {
    wordTrack.style.transition = animated ? "transform 0.8s ease" : "none";
    wordTrack.style.transform = `translateY(-${index * getWordHeight()}px)`;
  }

  goToWord(0, false);

  setInterval(() => {
    if (isResettingWordLoop) return;

    if (currentWordIndex === wordItems.length - 1) {
      isResettingWordLoop = true;

      setTimeout(() => {
        currentWordIndex = 0;
        goToWord(currentWordIndex, false);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            wordTrack.style.transition = "transform 0.8s ease";
            isResettingWordLoop = false;
          });
        });
      }, 1000);

      return;
    }

    currentWordIndex++;
    goToWord(currentWordIndex, true);
  }, 1000);

  window.addEventListener("resize", () => {
    goToWord(currentWordIndex, false);
  });
}

waitForHeroFonts().finally(startHeroWordLoop);

// =========================
// PRICE TICKER MARQUEE
// =========================
const priceTrack = document.getElementById("priceTrack");

if (priceTrack) {
  priceTrack.innerHTML += priceTrack.innerHTML;

  let tickerX = 0;
  const tickerSpeed = 0.6;

  function animateTicker() {
    tickerX -= tickerSpeed;

    if (Math.abs(tickerX) >= priceTrack.scrollWidth / 2) {
      tickerX = 0;
    }

    priceTrack.style.transform = `translateX(${tickerX}px)`;
    requestAnimationFrame(animateTicker);
  }

  animateTicker();
}

// =========================
// LIVE PRICE LOGIC
// =========================
function formatUsdPrice(value, symbol) {
  if (symbol === "USDC") {
    return `$${value.toFixed(2)}`;
  }

  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  }

  if (value >= 1) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  })}`;
}

function updateTickerPrice(symbol, value) {
  const items = document.querySelectorAll(`.price-item[data-symbol="${symbol}"]`);

  items.forEach((item) => {
    const priceEl = item.querySelector(".coin-price");
    if (!priceEl) return;

    if (symbol === "ARCA") {
      priceEl.textContent = "SOON";
      priceEl.classList.add("soon");
      return;
    }

    priceEl.textContent = formatUsdPrice(value, symbol);
  });
}

async function fetchLivePrices() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=shadow-2,metropolis,bitcoin,ethereum,solana,sonic-3,usd-coin&vs_currencies=usd"
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data["shadow-2"]?.usd !== undefined) {
      updateTickerPrice("SHADOW", data["shadow-2"].usd);
    }

    if (data["metropolis"]?.usd !== undefined) {
      updateTickerPrice("METRO", data["metropolis"].usd);
    }

    if (data.bitcoin?.usd !== undefined) {
      updateTickerPrice("BTC", data.bitcoin.usd);
    }

    if (data.ethereum?.usd !== undefined) {
      updateTickerPrice("ETH", data.ethereum.usd);
    }

    if (data.solana?.usd !== undefined) {
      updateTickerPrice("SOL", data.solana.usd);
    }

    if (data["sonic-3"]?.usd !== undefined) {
      updateTickerPrice("S", data["sonic-3"].usd);
    }

    if (data["usd-coin"]?.usd !== undefined) {
      updateTickerPrice("USDC", data["usd-coin"].usd);
    }

    updateTickerPrice("ARCA", null);
  } catch {
    // silently fail — ticker stays at last known value
  }
}

fetchLivePrices();
setInterval(fetchLivePrices, 300000);

// =========================
// FEATURE CARD REVEAL
// =========================
const revealCards = document.querySelectorAll(".reveal-card");

if (revealCards.length > 0) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        }
      });
    },
    { threshold: 0.18 }
  );

  revealCards.forEach((card) => revealObserver.observe(card));
}
const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {
  const question = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");
  const symbol = item.querySelector(".faq-symbol");

  if (item.classList.contains("active")) {
    answer.style.maxHeight = answer.scrollHeight + "px";
    symbol.textContent = "×";
  }

  question.addEventListener("click", () => {
    const isActive = item.classList.contains("active");

    faqItems.forEach((otherItem) => {
      const otherAnswer = otherItem.querySelector(".faq-answer");
      const otherSymbol = otherItem.querySelector(".faq-symbol");

      otherItem.classList.remove("active");
      otherAnswer.style.maxHeight = null;
      otherSymbol.textContent = "+";
    });

    if (!isActive) {
      item.classList.add("active");
      answer.style.maxHeight = answer.scrollHeight + "px";
      symbol.textContent = "×";
    }
  });
});
