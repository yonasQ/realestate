# Managing content (admin guide)

Sign in at `/admin`. Accounts are created with `pnpm admin:create` (there is no public sign-up). Roles: **admin** (everything, including Site settings) and **editor** (listings, developments, inquiries).

## Developments vs listings

- A **development** is a building project (e.g. City Plus). It holds location, building facts, construction status, delivery estimate, amenities, plans and brochure.
- A **listing** is a unit type you sell inside a development (e.g. "Two-Bedroom Apartment, City Plus"). It holds bedrooms, bathrooms, size, price, availability and highlights.
- A listing is public only when **both** it and its development are published. Unpublishing a development hides all its listings.

## Publishing rules (enforced)

- New records start as **drafts**. Add images, then switch to **published**.
- Publishing a listing requires a summary (20+ characters), bedrooms (residential), a size or size range, at least one image and a published development.
- Status flow: draft ↔ published → archived → draft (archived items must return to draft before republishing).
- **Prices:** choose "On request", or a fixed / "from" / "from per m²" price with **amount and currency** (ETB or USD). Prices are shown exactly as entered and never converted.
- If two people edit the same record, the second save is rejected with a "reload" message instead of overwriting.
- Every change is recorded in the audit log, and public pages update immediately after saving.

## Images

- Upload JPEG/PNG/WebP/AVIF up to 15 MB (10 per batch). The server resizes them, converts to WebP and removes location metadata.
- For each image set **alt text** (describe what is visible, for screen readers and SEO), an optional caption, and the kind: *photo* (real photograph), *render* (architectural visualisation) or *plan* (floor/unit plan; shown in a separate section, never as a cover).
- Choose the **cover** (cards, social sharing). Reorder with ↑/↓ and press **Save image changes**.

### Asset replacement process

1. Request originals from Temer: exterior renders and site photos **without text overlays**, at least 2400 px wide, plus current floor plans.
2. Upload them to the development (and to specific listings if they show that unit).
3. Make the best exterior the cover; set kind and alt text; remove the older "representative" renders.
4. Run `pnpm media:prune` (dry run), then `pnpm media:prune --apply` to delete images no longer used.

## Inquiries

- Every submission appears under **Inquiries** with a reference (e.g. `INQ-7K3M9Q`) that the customer also sees.
- Update the status (New → Contacted → Viewing scheduled → Closed, or Spam) and keep private notes.
- The notification column shows whether the email/CRM alert was delivered. Failed alerts retry automatically; use **Retry notification** after fixing settings.
- Viewing requests are *requests*: confirm the time with the customer directly.

## Site settings (admin only)

Brand, homepage headline, your profile and contact details (these enable call and WhatsApp buttons), the relationship statement, social links, and Temer's sales-office details. Upload a portrait and, optionally, a homepage hero image (defaults to the first featured development's cover).
