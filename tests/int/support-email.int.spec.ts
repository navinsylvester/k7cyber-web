import { describe, expect, it } from 'vitest'

import { linkTarget } from '@/components/support/EmailComposer.client'
import { cleanEmailHtml, hasText, linkify, LINK_STYLE, safeHref, safeStyle, textToEmailHtml, wrapEmail } from '@/lib/support/email-html'

/* The email body an agent sends from the case sheet (tester items of 2026-10-29: formatting, links that read as links). */

describe('cleanEmailHtml: what the composer makes survives', () => {
  it('keeps bold, italic, underline, lists and line divs', () => {
    const html = 'Hello <b>there</b>, <i>see</i> <u>this</u>:<div><br></div><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol><div>Thanks</div>'
    expect(cleanEmailHtml(html)).toBe(html)
  })

  it('turns font colour, size and face into a checked span', () => {
    expect(cleanEmailHtml('<font color="#C00000">red</font>')).toBe('<span style="color:#c00000">red</span>')
    expect(cleanEmailHtml('<font size="4">big</font>')).toBe('<span style="font-size:18px">big</span>')
    expect(cleanEmailHtml('<font face="Georgia">serif</font>')).toBe(`<span style="font-family:Georgia, &#39;Times New Roman&#39;, serif">serif</span>`.replace(/&#39;/g, "'"))
    expect(cleanEmailHtml('<font face="Comic Sans MS" size="9">x</font>')).toBe('x')
  })

  it('keeps an agent link, styled to read as a link everywhere', () => {
    expect(cleanEmailHtml('<a href="https://k7computing.com/support?a=1&amp;b=2">help</a>')).toBe(`<a href="https://k7computing.com/support?a=1&amp;b=2" style="${LINK_STYLE}">help</a>`)
    expect(cleanEmailHtml('<a href="mailto:care@k7computing.com">mail us</a>')).toContain('href="mailto:care@k7computing.com"')
  })

  it('links bare web and email addresses, leaving the full stop outside', () => {
    const out = cleanEmailHtml('<div>Update from https://www.k7computing.com/downloads. Or write to support@k7computing.com!</div>')
    expect(out).toContain(`<a href="https://www.k7computing.com/downloads" style="${LINK_STYLE}">https://www.k7computing.com/downloads</a>.`)
    expect(out).toContain(`<a href="mailto:support@k7computing.com" style="${LINK_STYLE}">support@k7computing.com</a>!`)
    expect(cleanEmailHtml('see www.k7computing.com now')).toContain('href="https://www.k7computing.com/"')
  })

  it('does not link inside a link, and stops a link at a non-breaking space', () => {
    expect(cleanEmailHtml('<a href="https://a.example.com">https://b.example.com</a>')).toBe(`<a href="https://a.example.com/" style="${LINK_STYLE}">https://b.example.com</a>`)
    expect(cleanEmailHtml('go to https://k7computing.com&nbsp;now')).toContain('>https://k7computing.com</a>&nbsp;now')
  })
})

describe('cleanEmailHtml: what must not reach Dynamics or a customer', () => {
  it('drops scripts, styles and comments with their content', () => {
    expect(cleanEmailHtml('a<script>alert(1)</script>b<style>p{}</style>c<!-- x -->d')).toBe('abcd')
    expect(cleanEmailHtml('a<svg><script>x</script></svg>b<iframe src="https://x.example"></iframe>c')).toBe('abc')
  })

  it('drops event handlers and unknown attributes', () => {
    expect(cleanEmailHtml('<b onclick="x()" class="k" id="i">b</b>')).toBe('<b>b</b>')
    expect(cleanEmailHtml('<img src="https://x.example/p.png" onerror="x()">t')).toBe('t')
  })

  it('refuses javascript: and data: links however they are spelled', () => {
    for (const href of ['javascript:alert(1)', 'JaVaScRiPt:x', 'java&#10;script:x', ' java\tscript:x', 'data:text/html,x', 'vbscript:x', '//evil.example', '#top']) {
      expect(cleanEmailHtml(`<a href="${href}">t</a>`)).toBe('t')
    }
    expect(safeHref('https://ok.example/a b')).toBe('https://ok.example/ab')
  })

  it('re-writes styles from checked values only', () => {
    expect(safeStyle('color: red; background: url(x); font-size: 99px; position: fixed')).toBe('')
    expect(safeStyle('color: rgb(255, 0, 0); font-size: large; font-weight: 700; text-decoration: underline')).toBe('color:#ff0000;font-size:18px;font-weight:bold;text-decoration:underline')
    expect(safeStyle('color: #0563C1 !important; font-family: "Courier New", monospace')).toBe("color:#0563c1;font-family:'Courier New', Courier, monospace")
    expect(cleanEmailHtml('<span style="color:#123456;behavior:url(x.htc)">t</span>')).toBe('<span style="color:#123456">t</span>')
    expect(cleanEmailHtml('<span style="expression(alert(1))">t</span>')).toBe('t')
  })

  it('balances tags and escapes stray signs', () => {
    expect(cleanEmailHtml('<b><i>x</b> y</i>')).toBe('<b><i>x</i></b> y')
    expect(cleanEmailHtml('</div>a < b & c > d<b>')).toBe('a &lt; b &amp; c &gt; d<b></b>')
    expect(cleanEmailHtml('<span>plain</span>')).toBe('plain')
    expect(cleanEmailHtml('<a href="x"><b>t</b></a>')).toBe('<b>t</b>')
  })

  it('a quote cannot break out of an attribute', () => {
    const out = cleanEmailHtml(`<a href='https://x.example/"onmouseover="alert(1)'>t</a>`)
    expect(out).not.toMatch(/onmouseover="/)
    expect(out).toMatch(/^<a href="https:\/\/x\.example\/%22onmouseover=%22alert\(1\)" style=/)
  })
})

describe('plain text and the wrapper', () => {
  it('turns paragraphs and lines into HTML with links', () => {
    expect(textToEmailHtml('Hi,\n\nSee https://k7computing.com.\nThanks <K7>')).toBe(`<p>Hi,</p><p>See <a href="https://k7computing.com/" style="${LINK_STYLE}">https://k7computing.com</a>.<br>Thanks &lt;K7&gt;</p>`)
  })

  it('wraps the body in the house font and knows an empty one', () => {
    expect(wrapEmail('<p>x</p>')).toMatch(/^<div style="font-family:Arial[^"]*"><p>x<\/p><\/div>$/)
    expect(hasText('<div><br></div><p>&nbsp;</p>')).toBe(false)
    expect(hasText('<p>Hi</p>')).toBe(true)
  })

  it('linkify leaves text without addresses alone', () => {
    expect(linkify('version 16.0.1234 on Windows 11')).toBe('version 16.0.1234 on Windows 11')
  })
})

describe('linkTarget: what the agent types in the link box', () => {
  it('adds the scheme a bare address needs', () => {
    expect(linkTarget('k7computing.com/support')).toBe('https://k7computing.com/support')
    expect(linkTarget('care@k7computing.com')).toBe('mailto:care@k7computing.com')
    expect(linkTarget('https://k7computing.com')).toBe('https://k7computing.com/')
  })
  it('refuses what is not a link', () => {
    for (const v of ['', 'not a link', 'javascript:alert(1)', 'localhost', 'ftp://x.example']) expect(linkTarget(v)).toBeNull()
  })
})
