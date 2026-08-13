# Free-Tier / Cost Assumptions

**Verified:** 13 August 2026. **Re-verify before every deploy.**

Free tiers change without warning. Railway removed its free tier; Fly.io cut theirs to a
2-hour trial; Heroku's is long gone; Neon restructured after the Databricks acquisition;
Render shortened its spin-down from 30 to 15 minutes. Treat every figure below as a
snapshot, not a contract. This file is the reason the architecture keeps every one of
these services behind an interface: none of them is load-bearing.

---

## 1. Recommended V1 stack

| Service | Purpose | Free tier used | Real limitation | What happens at the limit | Migration option |
|---|---|---|---|---|---|
| **Cloudflare Pages** | Frontend hosting + CDN | Unlimited bandwidth, 500 builds/month, 100 custom domains, commercial use **allowed** | 500 builds/month; 25 MiB max per asset | Builds queue/fail; serving continues | Netlify Free (also allows commercial use), or any static host — the output is a plain `dist/` folder |
| **Render** (Web Service) | NestJS API | 512 MB RAM, 0.1 CPU, 750 instance-hours/month, 100 GB bandwidth | **Spins down after 15 min idle; 30–60 s cold start** | First request after idle hangs up to a minute | Fly.io, Koyeb free web service, or Render Starter at $7/month |
| **Neon** | PostgreSQL | 0.5 GB storage per project, 100 CU-hours/month, scale-to-zero, branching | Hard cutoffs, not throttles. Cold start 0.5–2 s | Database **suspends** until the next cycle | Supabase free Postgres, or Neon Launch from $5/month |
| **Cloudinary** | Photo storage + delivery | 25 credits/month (1 credit ≈ 1 GB storage *or* 1 GB bandwidth *or* 1,000 transformations), 3 users | **No tier between Free and $89/month.** Overage can suspend asset access | Warnings from ~90%; account eventually disabled | Cloudflare R2 (zero egress fees) + ImageKit free tier, or Supabase Storage |
| **Brevo** *or* **Resend** | Invitation & auth emails | Brevo: 300 emails/day forever. Resend: 3,000/month | Shared IPs; deliverability is adequate, not excellent | Sending pauses until reset | Postmark ($15/10k) when invitations start failing |
| **Auth** | Sessions | **Self-hosted. Zero cost, zero vendor.** Argon2id + httpOnly session cookie, built in Phase 3 | Our own code is the security surface | n/a | Better Auth (open source) if we outgrow it. Not Clerk |
| **AI** | Story Assistant only | Google AI Studio free tier: Flash-Lite ~15 RPM / 1,000 requests-per-day | **See the warning below** | 429s; the app degrades to manual story writing | Any provider — one adapter interface, one env var |
| **GitHub** | Repo + CI | Free private repos, 2,000 Actions minutes/month | Ample for V1 | Builds queue | n/a |
| **Local dev** | Everything | Docker Compose + Postgres 16 | None | n/a | n/a |

**Total recurring cost of V1: $0.00**, excluding a domain name (~$12/year, optional — every
service above issues a free subdomain with HTTPS).

---

## 2. Three decisions that were not obvious

### Not Vercel for the frontend
Vercel's Hobby plan **prohibits commercial use** in its Terms of Service, and caps bandwidth
at 100 GB/month. This product is intended to become a real product. Cloudflare Pages allows
commercial use on the free tier, has unlimited bandwidth, and its edge network is
substantially better positioned for East African users. If the audience is in Uganda, this
is also a latency decision, not only a licensing one.

### Not Render's free Postgres
Render's free PostgreSQL **expires 30 days after creation**, with a 14-day grace period,
after which the database and all its data are deleted. That is disqualifying for a product
whose entire premise is preservation, even in testing. The API goes on Render; the database
goes on Neon.

### The AI free tier conflicts with our privacy promise — read this before Phase 16
Google's free AI Studio tier generally carries a **data-sharing clause**: free-tier inputs
may be used to improve their models. The architecture commits to never sending family data
to a provider that trains on it.

Three honest options, in order of preference:

1. **Ship V1 with `AI_ENABLED=false`.** Everything else works. The relationship calculator is
   deterministic and needs no LLM at all. This is the default and it costs nothing.
2. **Enable AI on the free tier for your own testing only,** on a test family with invented
   names. Never on a real family's data.
3. **Pay for the Story Assistant when real families use it.** A story draft is roughly
   1–2k tokens. At MVP volumes this is single-digit dollars per month on a paid API tier
   with zero-retention terms — the one place where spending a few dollars buys something
   the free tier genuinely cannot.

This is the only place in V1 where "free" and "correct" pull against each other, and it is
worth deciding deliberately rather than by default.

---

## 3. Consequences we design around now

**Cold starts are the defining constraint.** Render sleeps after 15 minutes; Neon scales to
zero. A user's first request of the day can take 30–60 seconds. Mitigations built into the
architecture rather than bolted on later:

- The web client is a static SPA on Cloudflare's edge. It loads instantly regardless of API
  state, so the user sees the interface, not a blank screen.
- Every data view has a real loading state. No spinner-over-white.
- The API request timeout is generous (60 s), and TanStack Query retries once.
- Before a demo to a real family: hit the health endpoint a minute beforehand.
- A GitHub Actions cron pinging `/api/v1/health` every 14 minutes would keep the service
  warm — but it burns the 750 monthly instance-hours in about 31 days, so it only works if
  you run exactly one free service. Noted, not recommended yet.

**Photo storage is the first thing that will actually cost money.** Twenty-five credits
disappear quickly once a family uploads a few hundred photographs and the CDN serves them.
Phase 9 therefore stores only `cloudinaryPublicId` behind a `StorageProvider` interface and
uploads at capped dimensions with `f_auto,q_auto`. Swapping to Cloudflare R2 is one adapter
class, not a rewrite.

**0.5 GB of Postgres is a lot of family data.** A member row is well under a kilobyte and no
image bytes ever touch the database. Ten thousand members plus their stories is comfortably
under 100 MB. Storage will not be the binding constraint; the 100 CU-hour compute allowance
will be, and scale-to-zero protects it.

---

## 4. What we are explicitly not paying for, and what we lose

| Not used | What it would have given us | What we do instead |
|---|---|---|
| Clerk / Auth0 | Hosted auth, MFA, social login | Argon2id + httpOnly session cookies (Phase 3) |
| Redis / BullMQ | Background jobs | Nothing needs a queue in V1 |
| Sentry paid | Error tracking | Sentry free (5k events/month) or structured logs |
| Datadog / New Relic | APM | Render's built-in logs |
| Pinecone / Qdrant | Vector search | Not in V1 at all |
| Managed backups | PITR | `pg_dump` on a schedule + the JSON export in Phase 18 |

The last row matters most. Neon's free tier gives 6 hours of instant restore, which is not a
backup strategy for a heritage product. **Until there is a paid database, the family JSON
export from Phase 18 is the real backup.** Run it, keep the files, and be honest with any
family testing V1 about what "preserved" currently means.
