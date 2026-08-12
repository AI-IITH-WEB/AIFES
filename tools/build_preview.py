#!/usr/bin/env python3
"""
Builds a double-click-able local preview of the AIFES site without needing
Ruby/Jekyll installed. It stitches each page's front matter + body into
_layouts/default.html (resolving the {% include %} / {% if page.nav %}
bits our templates actually use) and writes the result to _preview/.

This is NOT a full Liquid/Jekyll implementation — it only understands the
handful of constructs used in this repo's own templates. GitHub Pages still
does the real build when you push; this is just for checking your work
locally first.

Usage:
    python tools/build_preview.py

Then open _preview/index.html in a browser. Links between pages work
because every page is rendered into the same folder alongside the images
and assets/ it needs.
"""
import re
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_preview")

PAGES = [
    "index.html", "research.html", "outputs.html", "education.html",
    "people.html", "community.html", "reading-group.html",
    "partners.html", "contact.html", "roadmap.html",
]


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def split_front_matter(text):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return {}, text
    fm_raw, content = m.groups()
    fm = {}
    for line in fm_raw.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip()
    return fm, content


def render_nav_conditionals(text, nav_key):
    def repl(m):
        key, body = m.group(1), m.group(2)
        return body if key == nav_key else ""
    return re.sub(
        r"\{%\s*if page\.nav == '([\w-]+)'\s*%\}(.*?)\{%\s*endif\s*%\}",
        repl, text, flags=re.S,
    )


def main():
    os.makedirs(OUT, exist_ok=True)

    layout = read(os.path.join(ROOT, "_layouts", "default.html"))
    nav_tpl = read(os.path.join(ROOT, "_includes", "nav.html"))
    footer_tpl = read(os.path.join(ROOT, "_includes", "footer.html"))

    for p in PAGES:
        src = os.path.join(ROOT, p)
        if not os.path.exists(src):
            continue
        fm, content = split_front_matter(read(src))
        title = fm.get("title", "")
        nav_key = fm.get("nav", "")

        page_html = layout
        m = re.search(r"\{%\s*if page\.title\s*%\}(.*?)\{%\s*endif\s*%\}", page_html, re.S)
        replacement = m.group(1).replace("{{ page.title }}", title) if title else ""
        page_html = page_html[:m.start()] + replacement + page_html[m.end():]

        page_html = page_html.replace(
            "{{ page.description | default: site.description }}",
            "AIFES is a research laboratory at IIT Hyderabad advancing trustworthy AI.",
        )
        page_html = page_html.replace("{% include nav.html %}", render_nav_conditionals(nav_tpl, nav_key))
        page_html = page_html.replace("{% include footer.html %}", footer_tpl)
        page_html = page_html.replace("{{ content }}", content)

        with open(os.path.join(OUT, p), "w", encoding="utf-8") as f:
            f.write(page_html)

    assets_src = os.path.join(ROOT, "assets")
    assets_dst = os.path.join(OUT, "assets")
    if os.path.exists(assets_dst):
        shutil.rmtree(assets_dst)
    shutil.copytree(assets_src, assets_dst)

    # whole folder, copied as-is — so new slide files never need this script edited
    slides_src = os.path.join(ROOT, "slides")
    slides_dst = os.path.join(OUT, "slides")
    if os.path.exists(slides_src):
        if os.path.exists(slides_dst):
            shutil.rmtree(slides_dst)
        shutil.copytree(slides_src, slides_dst)

    print(f"Built {len(PAGES)} pages into {OUT}")
    print(f"Open {os.path.join(OUT, 'index.html')} in a browser to preview.")


if __name__ == "__main__":
    main()
