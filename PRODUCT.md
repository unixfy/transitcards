# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone who lands on the site: Alex's colleagues and friends (the README mentions office visitors who may see the physical binder), fellow transit-card collectors and transit fans, and the general public arriving without context. Visitors browse on both desktop and phones. They look through the collection, search or filter it by agency, open a card for its details, or let the slideshow play.

## Product Purpose

transitcards.alexwang.net is a digital twin of Alex's physical binder of public transit fare payment cards collected from around the world. It lets visitors browse the whole collection, search and filter it, see how it grew over time, and view each card up close with its agency, location, acquisition date and notes. Success is a visitor enjoying the cards themselves and finding the ones they care about quickly.

## Positioning

This is one person's real, physical collection mirrored online, a personal hobby archive rather than a catalog or marketplace. Every card is something Alex actually holds in a binder.

## Operating Context

- Content lives in a Directus CMS at cms.alexwang.net; the site is a SvelteKit app deployed on Cloudflare.
- Card records have: name, issuing agency (name and city), acquisition date, notes (trusted HTML) and an image.
- The homepage is an infinite-scroll grid with agency filtering, full-text search and a "Cards Over Time" chart.
- Each card has its own detail page, and there is a "feeling lucky" random-card route.
- A full-screen slideshow mode is meant as an ambient display: left running on a screen or TV (for example in an office) as a passive showcase, not primarily for personal browsing.

## Capabilities and Constraints

- Data model is fixed to what the CMS provides today; future work must not assume new fields.
- Light and dark themes are both supported, with a user toggle; the slideshow is always dark.
- Terminology: "cards" (not tickets or passes), "agency" for the issuer, "collection" for the whole set.

## Brand Commitments

Site title "Alex's Transit Cards". Personal, friendly, hobbyist voice (see README).

## Evidence on Hand

Real card photographs served from the CMS asset endpoint, and real collection data (about 370 cards at the time of writing). No testimonials, press or statistics exist beyond the collection itself and must not be fabricated.

## Product Principles

1. The card photographs are the star; interface chrome recedes around them.
2. Mobile is first-class: touch targets, vertical space and thumb reach matter as much as desktop.
3. Accessible by default: strong text contrast, no forced all-caps or monospace for reading text, and respect for reduced-motion preferences.
4. Work only with the data the CMS already provides.
5. Make browsing a pleasure with no learning curve, since visitors arrive without context.

## Accessibility & Inclusion

Readable contrast in both themes, plain-case sans-serif text, comfortable touch-target sizes, reduced-motion respected for tilt and hover effects.
