import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { htmlToText, previewOf, sanitizeEmailHtml } from "../src/modules/email/email-html.js";

describe("email HTML", () => {
  it("drops scripts, event handlers and javascript: links", () => {
    const html = sanitizeEmailHtml(
      '<p onclick="x()">Hi <a href="javascript:alert(1)">x</a></p><script>alert(1)</script><img src=x onerror=alert(1)>',
    );
    assert.ok(!/script|onclick|onerror|javascript:|<img/i.test(html), html);
  });

  it("keeps what the editor produces, including text-align only", () => {
    const html = sanitizeEmailHtml(
      '<p style="text-align: center; color: red"><strong>B</strong> <em>I</em> <u>U</u> <s>S</s></p><ol><li>one</li></ol><blockquote>q</blockquote>',
    );
    assert.match(html, /<p style="text-align:center">/);
    assert.ok(!html.includes("color"));
    assert.match(html, /<strong>B<\/strong>/);
    assert.match(html, /<ol><li>one<\/li><\/ol>/);
  });

  it("forces safe link attributes", () => {
    assert.match(sanitizeEmailHtml('<a href="https://example.com">x</a>'), /rel="noopener noreferrer"/);
  });

  it("derives readable text and a bounded preview", () => {
    const text = htmlToText("<p>Hello&nbsp;there</p><p>Line &amp; two</p>");
    assert.equal(text, "Hello there\nLine & two");
    assert.equal(previewOf("x".repeat(300)).length, 200);
  });
});
