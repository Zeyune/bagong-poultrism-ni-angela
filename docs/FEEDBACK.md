# FEEDBACK.md — Effie's opinions and reactions

A running, dated log of **Effie's own opinions, reactions, and design instincts** about PoultryPilot.
Kept separate from the specification documents (which say what the system *should* be) and from
`CHANGELOG.md` (which records *changes*, with my reasoning). This file is Effie's voice: impressions,
hunches, and "this feels off" notes — captured verbatim-ish so they are not lost between sessions.

Newest entries at the top. My responses and any resulting work are logged in `CHANGELOG.md`, linked
where relevant.

---

## 2026-07-21

### The app feels like a toy, not a professional / "inventory" system
> "it still feels like this isn't an inventory system... my hunch is that it is like that because it
> is still in progress and still not finished. Maybe I look into a Phase-1-completed state and adjust
> its looks, design, or aesthetics. I feel like the app isn't for professional use and more like a
> toy. idk though, maybe it's just me."

**Context at the time:** only the Flocks module was visible; the dashboard (FR-06) and inventory
(FR-05) were not built. PoultryPilot is a *farm-management* system per the specs, not an inventory
system — inventory is one module of it.

**Standing idea from this:** a deliberate design / aesthetics pass for a more professional feel,
likely best done once Phase 1's screens all exist (around Steps 8–9), so the system is styled as a
whole rather than piecemeal. Not yet scheduled — noted here so it is not forgotten.

### The create-flock form is missing fields
> "the system seems lacking necessary data (default feed item, growth curve (broiler only), etc.) ...
> would you please check the documents if you might [have] missed, overlooked, or forgot [something]?"

**Verdict: correct.** The Add-Flock form omitted fields that USER_FLOWS.md §3.1 and FR-01 call for.
Details and resolution tracked in `CHANGELOG.md`.
