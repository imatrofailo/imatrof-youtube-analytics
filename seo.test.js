import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// imatrof.tech must not compete with imatrof.com in search: Google should drop it
// from results but keep crawling it, so the page says noindex and robots.txt
// must not block it (a blocked page never shows Google the noindex).
describe("search visibility", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

  it("asks search engines not to index the page", () => {
    expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex, follow"\s*\/?>/);
  });

  it("keeps links followable so Google still reaches imatrof.com", () => {
    expect(html).not.toMatch(/nofollow/);
    expect(html).toContain('"url": "https://imatrof.com/"');
  });
});
