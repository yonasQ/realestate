# Launch checklist: what is still needed from you

The site works end to end today. Inquiries are stored and visible in `/admin` even with no email configured. The items below are **business information or credentials only you can provide**, plus decisions the site must not make up.

## Blocking before public launch

- [ ] **Your identity** (Admin → Site settings): name, title, short professional introduction, portrait photo. Until set, the site uses neutral wording and shows no name. Don't add licences, years of experience, awards or sales figures you can't evidence.
- [ ] **Brand name and domain.** "Addis Homes" is a placeholder default; choose your real brand and register the domain.
- [ ] **Your contact details**: business phone, WhatsApp number, email, Telegram (optional), office address and hours. These switch on the call and WhatsApp buttons. Until then, the developer's sales office is shown, clearly labelled as Temer's.
- [ ] **Written confirmation from Temer Properties** that you are authorised to market these developments and to reuse their published renders, plans and brochure. The relationship statement on the site says you represent them and are not the developer; adjust its wording to match the agreement exactly.
- [ ] **Notification channel**: `INQUIRY_NOTIFY_EMAIL` + SMTP credentials (Google Workspace, Zoho, Postmark, Mailgun…) and/or a CRM webhook. Send a test inquiry after configuring.
- [ ] **Legal review** of `/privacy` and `/terms` (currently plain-language drafts) against Ethiopian personal data protection law and your agreement with Temer.
- [ ] **Data conflicts**: review [DATA_REVIEW.md](DATA_REVIEW.md). Nine listings and three developments are held as drafts because Temer's own pages contradict themselves.
- [ ] **Production server, DNS, secrets**: follow [DEPLOYMENT.md](DEPLOYMENT.md), then create your admin account with a strong unique password.

## Strongly recommended

- [ ] **Prices.** Temer publishes none online, so every listing shows "Price on request". If Temer gives you prices or a price list, enter them per listing (amount + ETB or USD; never converted). A pop-up on Temer's site advertises "from ETB 120,000 per m²" for a Sarbet project near the roundabout; confirm in writing which project before using it.
- [ ] **Better photography.** Most of Temer's images are marketing flyers with Amharic text baked in; those were deliberately excluded. Older projects share the same generic interior renders, labelled "representative". Ask Temer for clean, high-resolution exterior renders and site photos (≥ 2400 px, no text overlays), then upload them per development in the admin.
- [ ] **Exact site locations.** Several map pins from Temer were reused across unrelated projects, so they are shown as "approximate" or omitted. Provide verified coordinates per site.
- [ ] **Bot protection.** Add Cloudflare Turnstile keys if spam appears (honeypot, timing and rate limits are already active).
- [ ] **Analytics.** Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (cookieless; no consent banner needed) or similar.
- [ ] **Error monitoring and uptime alerts** (Sentry, external `/api/health` monitor).
- [ ] **Off-server backups** of `backups/`, plus one test restore.
- [ ] **Google Business Profile** and Search Console: submit `https://<domain>/sitemap.xml`.
- [ ] **Testimonials.** None are shown. Add only genuine, written-permission testimonials (this needs a small new content section).

## Not included (deliberate)

- No fabricated testimonials, awards, transaction counts or investment-return claims.
- No company statistics for Temer: their About page (founded 2010 EC, 350+ units) and catalogue (founded 2008 EC, 500+ units) disagree.
- No Amharic version yet. The content model is ready for it, but translations need a fluent reviewer.
