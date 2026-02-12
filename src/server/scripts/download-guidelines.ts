import fs from "fs";
import path from "path";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const OUTPUT_DIR = path.resolve("data/guidelines");
const BATCH_SIZE = 100;
const DELAY_MS = 350; // ~3 req/sec without API key

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function search(): Promise<{ webEnv: string; queryKey: string; count: number }> {
  const term = encodeURIComponent('"Practice Guideline"[pt] AND "Practice Guidelines as Topic"[MeSH] AND open access[filter]');
  const url = `${BASE}/esearch.fcgi?db=pmc&term=${term}&usehistory=y&retmax=0&retmode=json`;

  console.log("Searching PMC for practice guidelines...");
  const res = await fetch(url);
  const json = await res.json();
  const result = json.esearchresult;

  console.log(`Found ${result.count} articles`);
  return {
    webEnv: result.webenv,
    queryKey: result.querykey,
    count: parseInt(result.count),
  };
}

async function fetchBatch(webEnv: string, queryKey: string, start: number): Promise<string> {
  const url =
    `${BASE}/efetch.fcgi?db=pmc&WebEnv=${webEnv}&query_key=${queryKey}` +
    `&retstart=${start}&retmax=${BATCH_SIZE}&rettype=xml`;

  const res = await fetch(url);
  return await res.text();
}

function extractArticles(xml: string): string[] {
  const articles: string[] = [];
  const regex = /<article[\s>][\s\S]*?<\/article>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    articles.push(match[0]);
  }
  return articles;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const { webEnv, queryKey, count } = await search();
  const batches = Math.ceil(count / BATCH_SIZE);
  let saved = 0;

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    console.log(`Fetching batch ${i + 1}/${batches} (articles ${start}-${start + BATCH_SIZE - 1})...`);

    try {
      const xml = await fetchBatch(webEnv, queryKey, start);
      const articles = extractArticles(xml);

      for (const article of articles) {
        const pmcidMatch = article.match(/<article-id[^>]*pub-id-type="pmc"[^>]*>(\d+)<\/article-id>/);
        const filename = pmcidMatch ? `PMC${pmcidMatch[1]}.xml` : `article_${saved}.xml`;
        fs.writeFileSync(path.join(OUTPUT_DIR, filename), article);
        saved++;
      }

      console.log(`  Saved ${articles.length} articles (${saved} total)`);
    } catch (err) {
      console.error(`  Batch ${i + 1} failed:`, err);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${saved} articles saved to ${OUTPUT_DIR}`);
}

main();
