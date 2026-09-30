import { hashPassword, writeDb, type Db } from "./localJsonClient.js";

const now = () => new Date().toISOString();

function variant(
  id: string,
  name: string,
  trafficPct: number,
  js: string,
  css: string,
): Db["tests"][number]["variants"][number] {
  const at = now();
  return {
    id,
    name,
    trafficPct,
    js,
    css,
    version: 1,
    updatedAt: at,
    updatedBy: "u1",
    history: [{ version: 1, at, by: "u1", message: "initial" }],
  };
}

export function buildSeed(): Db {
  return {
    users: [
      {
        id: "u1",
        email: "dev@demo.com",
        passwordHash: hashPassword("demo1234"),
        role: "developer",
      },
    ],
    sessions: [],
    clients: [
      { id: "c1", name: "Acme Store", slug: "acme-store", domain: "acme.com" },
      { id: "c2", name: "Globex Travel", slug: "globex-travel", domain: "globex.travel" },
    ],
    tests: [
      {
        id: "t1",
        clientId: "c1",
        name: "Homepage Hero Test",
        slug: "homepage-hero-test",
        status: "running",
        variants: [
          variant("v1", "Control", 50, "", ""),
          variant(
            "v2",
            "Variant B",
            50,
            `const cta = document.querySelector(".hero .cta");
if (cta) {
  cta.textContent = "Shop the sale";
}
`,
            `.hero .cta {
  font-size: 18px;
}
`,
          ),
        ],
      },
      {
        id: "t2",
        clientId: "c1",
        name: "Promo Banner Test",
        slug: "promo-banner-test",
        status: "running",
        variants: [
          variant("v1", "Control", 50, "", ""),
          variant(
            "v2",
            "Hidden Banner",
            50,
            `document.body.classList.add("ab-hide-banner");
`,
            `.ab-hide-banner .promo-banner {
  display: none;
}
`,
          ),
        ],
      },
      {
        id: "t3",
        clientId: "c2",
        name: "Checkout Trust Badges",
        slug: "checkout-trust-badges",
        status: "draft",
        variants: [
          variant("v1", "Control", 50, "", ""),
          variant(
            "v2",
            "With Badges",
            50,
            `const form = document.querySelector("#checkout-form");
if (form) {
  const badge = document.createElement("div");
  badge.className = "ab-trust-badge";
  badge.textContent = "Secure checkout • Free cancellation";
  form.prepend(badge);
}
`,
            `.ab-trust-badge {
  padding: 8px 12px;
  margin-bottom: 12px;
  background: #f1f8f1;
  border: 1px solid #b7dcb7;
  font-size: 14px;
}
`,
          ),
        ],
      },
    ],
  };
}

export function seedDb(): void {
  writeDb(buildSeed());
}
