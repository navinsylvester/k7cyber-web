# Tester brief, phase 1: look, compare, one note

The message sent to the first few support engineers on 2026-10-15 (`11-staging-readiness.md` item 31 and §7). Phase 1 is
read-only apart from one internal note: sign in, find cases, open them, compare with the Hub. Resolving, assigning, queues,
the customer journey, the manager pages, CSAT and the product desk are phase 2. Replace the bracketed parts before sending;
the link changes whenever the tunnel restarts.

---

**Subject: K7 Support portal, phase 1 test (30 minutes, read-only)**

Hi [names],

We are building a web portal for support that works on top of Dynamics. It is not replacing anything yet. For this first
round I want three or four of you to look at it next to the Hub for about 30 minutes and tell me what does not match.

**The link:** https://storm-maria-remember-delivery.trycloudflare.com/support/sign-in?agent=1
Click *Sign in with Microsoft* and use your normal K7 account. This address changes when my machine restarts; if it stops
working, wait for a new one from me. The first page you open can take a few seconds, later ones are quick.

**Before you start, five things to know**

1. **It reads a test copy of Dynamics, not production.** Nothing you do in the portal reaches the real CRM. Keep doing your
   actual work in the Hub as usual.
2. **The copy was taken on 12 October.** Cases created after that are not there, and every resolved case in the copy shows
   12 October as its resolution date, so timers and SLA figures look wrong. That is known, do not report it.
3. **No email leaves the portal.** Anything it would normally send is dropped.
4. **Do not resolve, cancel, reassign or queue anything,** even your own cases. The copy holds real customers' cases, and the
   only change allowed in this round is an internal note on a case you own, starting with the word TEST.
5. **Report in [channel / email]** with: the page address, the case number if any, what you did, what you expected, what
   you saw, and a screenshot. The time helps me find it in the log.

**What to test (in this order)**

1. **Sign in.** You should land on your workspace. If you see "no access to the support system", tell me; you need a role in
   the test copy and that is a two-minute fix on my side.
2. **Workspace home.** Your counters, your active cases, the 14-day trend. Do the numbers look like yours as of 12 October?
3. **Case lists.** Open *Cases* and pick the three views you use most. Same cases, same columns, same order as the Hub?
4. **Search.** A case number, a customer name, an account name. Does it find what the Hub finds?
5. **One case.** Open a case you know well. Compare the head, the details, the timeline (notes and emails), the attachments and
   the related items with the same case in the Hub. This is the most useful check of the round.
6. **One note.** On a case you own, add an internal note beginning with TEST. Confirm it appears in the timeline.
7. **Read-only extras, if you have time.** The two dashboards under *Dashboards*, a knowledge article, a product in *Products*.
   Try the light theme and your phone.

**Not built yet, so do not report:** sending email from the portal, merging cases, editing cities and states.

Everything else that looks wrong, slow, confusing or different from the Hub, I want to hear about, including small things.
Thanks, this is the round that tells me whether the views are right before anyone works in it for real.

[your name]
