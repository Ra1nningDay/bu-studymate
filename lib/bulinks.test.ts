import assert from "node:assert/strict";
import { test } from "node:test";
import { BuLinksClient, decodeWpText } from "@/lib/bulinks";

const page = (id: number, link: string, title: string, slug = `p${id}`) => ({ id, link, slug, title: { rendered: title } });
const minute = 60_000;

function setup(handler: (url: string, call: number) => Response | Promise<Response>) {
  const urls: string[] = [];
  let time = 1_000_000;
  const fetchImpl = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return handler(String(input), urls.length);
  }) as typeof fetch;
  return { urls, client: new BuLinksClient(fetchImpl, () => time), advance: (ms: number) => { time += ms; } };
}

test("decodeWpText strips tags, decodes entities and truncates to 120 characters", () => {
  assert.equal(decodeWpText("<b>A &amp; B</b> &#8211; &#x0E01;"), "A & B – ก");
  const long = decodeWpText("x".repeat(500));
  assert.equal(long.length, 120);
  assert.ok(long.endsWith("…"));
});

test("listPages drops pages with unofficial links, http links and empty or No Access titles", async () => {
  const { client } = setup(() => Response.json([
    page(1, "https://bulinks.bu.ac.th/tuition-fees-2026/", "Tuition &amp; Fees", "tuition-fees-2026"),
    page(2, "https://script.google.com/macros/s/abc/exec", "Script"),
    page(3, "http://bulinks.bu.ac.th/x/", "Plain http"),
    page(4, "https://bulinks.bu.ac.th/empty/", ""),
    page(5, "https://bulinks.bu.ac.th/denied/", "No Access")
  ]));
  assert.deepEqual(await client.listPages(), [{
    id: 1, title: "Tuition & Fees", url: "https://bulinks.bu.ac.th/tuition-fees-2026/", slug: "tuition-fees-2026"
  }]);
});

test("listPages caches for an hour, de-duplicates concurrent calls and serves stale data when a refresh fails", async () => {
  let fail = false;
  const { client, urls, advance } = setup(() => fail
    ? new Response("down", { status: 500 })
    : Response.json([page(1, "https://bulinks.bu.ac.th/a/", "A")]));
  const [first, second] = await Promise.all([client.listPages(), client.listPages()]);
  assert.equal(urls.length, 1);
  assert.deepEqual(first, second);
  advance(59 * minute);
  await client.listPages();
  assert.equal(urls.length, 1);
  fail = true;
  advance(2 * minute);
  assert.deepEqual(await client.listPages(), first);
  assert.equal(urls.length, 2);
});

test("listPages pages through results", async () => {
  const { client, urls } = setup((url) => url.includes("page=1&")
    ? Response.json(Array.from({ length: 100 }, (_, i) => page(i + 1, `https://bulinks.bu.ac.th/p${i}/`, `Title ${i}`)),
      { headers: { "x-wp-totalpages": "2" } })
    : Response.json([101, 102, 103].map((id) => page(id, `https://bulinks.bu.ac.th/q${id}/`, `Title ${id}`)),
      { headers: { "x-wp-totalpages": "2" } }));
  assert.equal((await client.listPages()).length, 103);
  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes("/wp-json/wp/v2/pages?per_page=100&page=1&_fields=id,link,slug,title"));
});

test("latestPosts builds the query, converts date_gmt to a Date and caches for 20 seconds", async () => {
  const { client, urls, advance } = setup(() => Response.json([{
    id: 7, date_gmt: "2026-10-05T02:50:46", link: "https://bulinks.bu.ac.th/news/7/",
    title: { rendered: "Exam &amp; schedule" }, categories: [1, 564]
  }]));
  const posts = await client.latestPosts([564, 1], 5);
  for (const part of ["categories=1,564", "per_page=5", "orderby=date", "_fields=id,date_gmt,link,title,categories"]) {
    assert.ok(urls[0].includes(part), part);
  }
  assert.equal(posts[0].publishedAt.toISOString(), "2026-10-05T02:50:46.000Z");
  assert.deepEqual(posts[0].categoryIds, [1, 564]);
  assert.equal(posts[0].title, "Exam & schedule");
  advance(19_000);
  await client.latestPosts([1, 564], 5);
  assert.equal(urls.length, 1);
  advance(2_000);
  await client.latestPosts([1, 564], 5);
  assert.equal(urls.length, 2);
});

test("clients reject on HTTP errors, timeouts and non-JSON 200 responses", async () => {
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  for (const handler of [
    () => new Response("down", { status: 500 }),
    () => new Response("<html>blocked</html>", { status: 200 }),
    () => { throw abort; }
  ]) {
    await assert.rejects(setup(handler).client.listPages());
    await assert.rejects(setup(handler).client.latestPosts([1], 3));
  }
});
