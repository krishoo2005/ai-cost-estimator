const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT) || 4173;
const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const htmlPath = path.join(__dirname, "ai-cost-estimator.html");
const maxBodyBytes = 8_000;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBodyBytes) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

function normalizeParsedContent(content) {
  if (typeof content !== "string") throw new Error("Invalid model response.");
  const jsonText = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(jsonText);
  const area = Number(parsed.area);
  const floors = Number(parsed.floors);
  const areaMode = ["total", "per-floor"].includes(parsed.areaMode) ? parsed.areaMode : null;
  return {
    city: typeof parsed.city === "string" ? parsed.city.trim().slice(0, 80) : "",
    area: Number.isFinite(area) && area > 0 && area <= 100000 ? area : null,
    areaMode,
    floors: Number.isInteger(floors) && floors >= 1 && floors <= 20 ? floors : null,
    quality: typeof parsed.quality === "string" ? parsed.quality.trim().slice(0, 40) : "",
    constructionType: typeof parsed.constructionType === "string" ? parsed.constructionType.trim().slice(0, 50) : ""
  };
}

async function parseEstimatePrompt(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Extract only project details explicitly stated by the user. Do not estimate or invent prices, rates, quantities, or missing values. For city, return only the city or district name stated by the user, without the state or surrounding words. Return one JSON object with keys city (string or empty), area (number or null, only when the user gives square feet), areaMode (total or per-floor or null), floors (integer or null), quality (string or empty), and constructionType (string or empty). If ambiguous or absent, use null or empty strings."
        },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    console.error(`Groq request failed with HTTP ${response.status}.`);
    throw Object.assign(new Error("AI provider rejected the request."), { providerStatus: response.status });
  }
  const payload = await response.json();
  return normalizeParsedContent(payload?.choices?.[0]?.message?.content);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${host}`);

  if (request.method === "GET" && ["/", "/ai-cost-estimator.html", "/copyprojectcivil.html"].includes(requestUrl.pathname)) {
    try {
      const html = await fs.readFile(htmlPath);
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin"
      });
      response.end(html);
    } catch {
      sendJson(response, 500, { error: "The estimator page could not be loaded." });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/ai/parse") {
    if (!process.env.GROQ_API_KEY) {
      sendJson(response, 503, { error: "AI parsing is not configured. Add GROQ_API_KEY to the local, ignored .env file." });
      return;
    }
    try {
      const body = await readJsonBody(request);
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt || prompt.length > 1_500) {
        sendJson(response, 400, { error: "Enter a prompt between 1 and 1,500 characters." });
        return;
      }
      const result = await parseEstimatePrompt(prompt);
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error.statusCode || (error.name === "TimeoutError" ? 504 : 502);
      const message = statusCode === 400 || statusCode === 413
        ? error.message
        : error.providerStatus
          ? `Groq rejected the request (HTTP ${error.providerStatus}). Check the backend key and model configuration.`
          : "AI parsing failed. Check server configuration and try again.";
      sendJson(response, statusCode, { error: message });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(port, host, () => {
  console.log(`Estimator listening on ${host}:${port}`);
});
