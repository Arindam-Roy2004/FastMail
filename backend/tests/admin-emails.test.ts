import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAdminEmails } from "../src/common/utils/admin-emails.js";

describe("parseAdminEmails", () => {
  it("splits, trims and lower-cases", () => {
    assert.deepEqual(parseAdminEmails(" Ops@Example.com, dev@example.com "), ["ops@example.com", "dev@example.com"]);
  });

  it("drops blanks and duplicates", () => {
    assert.deepEqual(parseAdminEmails("a@x.com,, A@X.com ,"), ["a@x.com"]);
  });

  it("means nobody when empty or unset", () => {
    assert.deepEqual(parseAdminEmails(""), []);
    assert.deepEqual(parseAdminEmails(undefined), []);
  });
});
