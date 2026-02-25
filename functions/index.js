/**
 * Airzeta Security System - Cloud Functions
 * 
 * 1. scrapeSecurityNews: Scheduled daily scraper + Gemini AI filtering
 * 2. onCriticalNewsCreated: Firestore trigger for critical news email alerts
 * 3. manualScrapeNews: HTTPS callable for manual trigger (admin)
 * 
 * Uses: Gemini 2.5 Flash-Lite (Stable) via Google Generative AI SDK
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Parser = require("rss-parser");
const cheerio = require("cheerio");

initializeApp();
const db = getFirestore();
const rssParser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "AirzetaSecurityBot/1.0" },
});

// ============================================================
// NEWS SOURCES CONFIGURATION
// ============================================================
const NEWS_SOURCES = [
  {
    name: "Air Cargo News",
    url: "https://www.aircargonews.net/feed/",
    type: "rss",
  },
  {
    name: "ICAO Newsroom",
    url: "https://www.icao.int/Newsroom/Pages/default.aspx",
    type: "html",
    selector: ".ExternalClass a, .ms-rtestate-field a",
    baseUrl: "https://www.icao.int",
  },
  {
    name: "Passenger Terminal Today",
    url: "https://www.passengerterminaltoday.com/feed/",
    type: "rss",
  },
  {
    name: "AeroTime Hub",
    url: "https://www.aerotime.aero/feed",
    type: "rss",
  },
];

// ============================================================
// SCRAPER FUNCTIONS
// ============================================================

/**
 * Fetch articles from an RSS feed
 */
async function fetchRSSArticles(source) {
  try {
    const feed = await rssParser.parseURL(source.url);
    return (feed.items || []).slice(0, 15).map((item) => ({
      title: item.title || "",
      link: item.link || "",
      description: (item.contentSnippet || item.content || "").substring(0, 500),
      pubDate: item.pubDate || item.isoDate || "",
      source: source.name,
      imageUrl: item.enclosure?.url || extractImageFromContent(item.content) || "",
    }));
  } catch (error) {
    console.error(`[Scraper] RSS fetch failed for ${source.name}:`, error.message);
    return [];
  }
}

/**
 * Fetch articles from HTML page (for ICAO-style pages)
 */
async function fetchHTMLArticles(source) {
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "AirzetaSecurityBot/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const articles = [];

    $(source.selector).each((_, el) => {
      const title = $(el).text().trim();
      let link = $(el).attr("href") || "";
      if (link && !link.startsWith("http")) {
        link = `${source.baseUrl}${link}`;
      }
      if (title && title.length > 15 && link) {
        articles.push({
          title,
          link,
          description: "",
          pubDate: new Date().toISOString(),
          source: source.name,
          imageUrl: "",
        });
      }
    });

    return articles.slice(0, 15);
  } catch (error) {
    console.error(`[Scraper] HTML fetch failed for ${source.name}:`, error.message);
    return [];
  }
}

/**
 * Extract first image URL from HTML content
 */
function extractImageFromContent(htmlContent) {
  if (!htmlContent) return "";
  try {
    const $ = cheerio.load(htmlContent);
    const img = $("img").first().attr("src");
    return img || "";
  } catch (e) {
    return "";
  }
}

// ============================================================
// GEMINI AI FILTERING
// ============================================================

/**
 * Use Gemini 2.5 Flash-Lite to filter and classify articles
 */
async function filterWithGemini(articles) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Gemini] API key not configured. Set GEMINI_API_KEY in functions config.");
    // Fallback: return first 5 articles with basic classification
    return articles.slice(0, 5).map((a) => ({
      ...a,
      region: "Global",
      headlineEn: a.title,
      headlineKr: a.title,
      priority: "normal",
    }));
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const articleSummaries = articles
    .map((a, i) => `[${i}] "${a.title}" - ${a.description?.substring(0, 200) || "N/A"} (Source: ${a.source})`)
    .join("\n");

  const prompt = `You are a cargo security intelligence analyst for an airline security team.

TASK: From the articles below, select exactly 5 that are most relevant to aviation cargo security operations. Prioritize: security incidents, ICAO/regulatory policy changes, cargo-specific threats, and dangerous goods incidents.

ARTICLES:
${articleSummaries}

For each selected article, provide:
1. "index": the article number [0-${articles.length - 1}]
2. "region": classify as one of [Global, Asia, Americas, Europe/CIS, Middle East/Africa]
3. "headlineEn": English headline (clean, concise, max 120 chars)
4. "headlineKr": Korean translation summary (max 80 chars)
5. "priority": "critical" if it involves imminent threats (explosives, regulation violations, emergency directives) or "normal"

Respond ONLY with a valid JSON array of 5 objects. No markdown, no explanation.
Example: [{"index":0,"region":"Global","headlineEn":"...","headlineKr":"...","priority":"normal"}]`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = responseText;
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    }

    const parsed = JSON.parse(jsonStr);

    return parsed.map((item) => {
      const original = articles[item.index] || articles[0];
      return {
        ...original,
        region: item.region || "Global",
        headlineEn: item.headlineEn || original.title,
        headlineKr: item.headlineKr || original.title,
        priority: item.priority || "normal",
      };
    });
  } catch (error) {
    console.error("[Gemini] AI filtering failed:", error.message);
    // Fallback: return first 5 with defaults
    return articles.slice(0, 5).map((a) => ({
      ...a,
      region: "Global",
      headlineEn: a.title,
      headlineKr: a.title,
      priority: "normal",
    }));
  }
}

// ============================================================
// FIRESTORE SAVE
// ============================================================

/**
 * Save filtered news to Firestore securityNews collection
 */
async function saveNewsToFirestore(newsItems) {
  const batch = db.batch();
  const collectionRef = db.collection("securityNews");
  const today = new Date().toISOString().split("T")[0];

  for (const item of newsItems) {
    const docRef = collectionRef.doc();
    batch.set(docRef, {
      region: item.region || "Global",
      headlineEn: item.headlineEn || item.title,
      headlineKr: item.headlineKr || item.title,
      date: today,
      link: item.link || "",
      imageUrl: item.imageUrl || "",
      priority: item.priority || "normal",
      source: item.source || "",
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(`[Firestore] Saved ${newsItems.length} news items for ${today}`);
}

// ============================================================
// MAIN SCRAPE PIPELINE
// ============================================================

async function runScrapePipeline() {
  console.log("[Pipeline] Starting security news scrape...");

  // 1. Scrape all sources
  const allArticles = [];
  for (const source of NEWS_SOURCES) {
    const articles =
      source.type === "rss"
        ? await fetchRSSArticles(source)
        : await fetchHTMLArticles(source);
    allArticles.push(...articles);
    console.log(`[Pipeline] ${source.name}: ${articles.length} articles`);
  }

  console.log(`[Pipeline] Total raw articles: ${allArticles.length}`);

  if (allArticles.length === 0) {
    console.warn("[Pipeline] No articles fetched. Skipping AI filtering.");
    return { success: false, count: 0 };
  }

  // 2. AI filtering with Gemini
  const filteredNews = await filterWithGemini(allArticles);
  console.log(`[Pipeline] Filtered to ${filteredNews.length} articles`);

  // 3. Save to Firestore
  await saveNewsToFirestore(filteredNews);

  // 4. Cleanup old news (keep last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldStr = thirtyDaysAgo.toISOString().split("T")[0];

  const oldDocs = await db
    .collection("securityNews")
    .where("date", "<", oldStr)
    .get();

  if (!oldDocs.empty) {
    const deleteBatch = db.batch();
    oldDocs.docs.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();
    console.log(`[Pipeline] Cleaned up ${oldDocs.size} old news items`);
  }

  return { success: true, count: filteredNews.length };
}

// ============================================================
// CLOUD FUNCTIONS
// ============================================================

/**
 * Scheduled function: runs daily at 07:00 UTC (16:00 KST)
 */
exports.scrapeSecurityNews = onSchedule(
  {
    schedule: "0 7 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "512MiB",
    timeoutSeconds: 120,
    secrets: ["GEMINI_API_KEY"],
  },
  async () => {
    const result = await runScrapePipeline();
    console.log("[Scheduled] scrapeSecurityNews completed:", result);
  }
);

/**
 * Manual trigger for admin (HTTPS callable)
 */
exports.manualScrapeNews = onCall(
  {
    region: "asia-northeast3",
    memory: "512MiB",
    timeoutSeconds: 120,
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    // Verify admin
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== "hq_admin") {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    const result = await runScrapePipeline();
    return result;
  }
);

/**
 * Firestore trigger: send email alert when critical news is created
 */
exports.onCriticalNewsCreated = onDocumentCreated(
  {
    document: "securityNews/{newsId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.priority !== "critical") return;

    console.log("[Alert] Critical news detected:", data.headlineEn);

    // Get all registered user emails
    const usersSnapshot = await db.collection("users").get();
    const emails = usersSnapshot.docs
      .map((d) => d.data().email)
      .filter(Boolean);

    if (emails.length === 0) {
      console.log("[Alert] No active users to notify");
      return;
    }

    // Write to 'mail' collection for Firebase Trigger Email extension
    // This requires the "Trigger Email from Firestore" extension to be installed
    const mailDoc = {
      to: emails,
      message: {
        subject: `[URGENT] Security Alert: ${data.headlineEn}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1B3A7D; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">&#9888; Aviation Security Alert</h2>
              <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Airzeta Station Security System</p>
            </div>
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 0;">
              <strong style="color: #856404;">CRITICAL PRIORITY</strong>
            </div>
            <div style="padding: 20px; background: #f8f9fa; border: 1px solid #dee2e6;">
              <h3 style="color: #1B3A7D; margin-top: 0;">${data.headlineEn}</h3>
              <p style="color: #495057; font-size: 15px;">${data.headlineKr || ""}</p>
              <div style="margin: 15px 0;">
                <span style="background: #E94560; color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px;">
                  ${data.region || "Global"}
                </span>
                <span style="color: #6c757d; font-size: 13px; margin-left: 10px;">${data.date || ""}</span>
              </div>
              ${data.link ? `<a href="${data.link}" style="display: inline-block; background: #1B3A7D; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Read Full Article</a>` : ""}
            </div>
            <div style="padding: 15px; background: #e9ecef; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #6c757d;">
              Sent by Airzeta Security System | Do not reply to this email
            </div>
          </div>
        `,
      },
      createdAt: FieldValue.serverTimestamp(),
    };

    await db.collection("mail").add(mailDoc);
    console.log(`[Alert] Email queued for ${emails.length} recipients`);
  }
);
