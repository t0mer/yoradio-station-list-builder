import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const ORIGIN = "https://example.com";

/** Every local asset the page pulls in. Kept in sync with public/index.html. */
const REFERENCED = [
  "/dist/js/main.js",
  "/plugins/jquery/jquery.min.js",
  "/plugins/datatables/jquery.dataTables.min.js",
  "/plugins/datatables-responsive/js/dataTables.responsive.min.js",
  // Flags are requested by main.js rather than the markup, so the "references
  // no asset that is not served" check below cannot see them.
  "/flags/France.png",
  "/flags/United_States.png",
  "/flags/%C3%85land_Islands.png",
];

describe("static assets", () => {
  it("serves the index page at the root", async () => {
    const res = await SELF.fetch(`${ORIGIN}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>");
  });

  it.each(REFERENCED)("serves %s", async (path) => {
    const res = await SELF.fetch(`${ORIGIN}${path}`);

    expect(res.status).toBe(200);
  });

  it("references no asset that is not served", async () => {
    const html = await SELF.fetch(`${ORIGIN}/`).then((r: Response) => r.text());

    const local = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((u) => !/^(https?:)?\/\/|^#|^data:|^mailto:/.test(u));

    const broken: string[] = [];
    for (const ref of local) {
      const res = await SELF.fetch(new URL(ref, `${ORIGIN}/`).toString());
      if (res.status !== 200) broken.push(`${ref} -> ${res.status}`);
    }

    expect(broken).toEqual([]);
  });
});
