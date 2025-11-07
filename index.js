const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

// Rota raiz
app.get("/", (req, res) => {
  res.send("Bem vindo ao Scraper Google Maps");
});

// Rota de busca no Google Maps
app.get("/search", async (req, res) => {
  const searchTerm = req.query.term;

  if (!searchTerm) {
    return res.status(400).json({ error: "O parâmetro 'term' é obrigatório." });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--lang=pt-BR"],
    });

    const page = await browser.newPage();

    // Configura o cabeçalho de idioma
    await page.setExtraHTTPHeaders({
      "Accept-Language": "pt-BR,pt;q=0.9",
    });

    // Gera a URL de pesquisa do Google Maps
    const url = `https://www.google.com/maps/search/${encodeURIComponent(
      searchTerm
    )}`;
    await page.goto(url, { waitUntil: "networkidle2" });

    console.log(`Pesquisando: ${searchTerm}`);

    // Seletor para os resultados
    const resultsSelector = `[aria-label="Resultados para ${searchTerm}"]`;
    await page.waitForSelector(resultsSelector, { timeout: 60000 }); // Aumenta o tempo limite para o carregamento

    // Rolar a página até carregar todos os resultados
    let previousHeight;
    while (true) {
      const resultDiv = await page.$(resultsSelector);
      previousHeight = await page.evaluate((el) => el.scrollHeight, resultDiv);
      await page.evaluate((el) => el.scrollBy(0, el.scrollHeight), resultDiv);
      await new Promise((resolve) => setTimeout(resolve, 6000)); // Aguarda 6 segundos entre as rolagens
      const newHeight = await page.evaluate((el) => el.scrollHeight, resultDiv);
      if (newHeight === previousHeight) break; // Sai do loop se não houver mais resultados
    }

    // Extrair os websites dos resultados
    const data = await page.evaluate(() => {
      let elements = document.querySelectorAll(".lI9IFe");

      return Array.from(elements)
        .map((container) => {
          let website =
            container.querySelector('a[aria-label^="Acessar o site"]')?.href ||
            null;
          let phone = container.querySelector(".UsdlK")?.innerText || null;

          let name =
            container.querySelector(".qBF1Pd.fontHeadlineSmall")?.innerText ||
            null;

          return { name, website, phone };
        })
        .filter(
          (container) =>
            container.website !== null &&
            container.phone !== null &&
            container.website !== "" &&
            container.phone !== "" &&
            container.website !== undefined &&
            container.phone !== undefined &&
            !container.website.includes("wa.me") &&
            !container.website.includes("facebook.com") &&
            !container.website.includes("instagram.com") &&
            !container.website.includes("twitter.com") &&
            !container.website.includes("linkedin.com") &&
            !container.website.includes("youtube.com") &&
            !container.website.includes("tiktok.com") &&
            !container.website.includes("pinterest.com") &&
            !container.website.includes("reddit.com")
        );
    });

    await browser.close();

    return res.json({
      term: searchTerm,
      data,
    });
  } catch (error) {
    console.error("Erro ao realizar a pesquisa:", error);
    return res.status(500).json({ error: "Erro ao realizar a pesquisa." });
  }
});

// Inicializar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
