---
title: "DieDaily: A 30-Level Motorcycle Gauntlet Where Deaths Are Your Score"
pubDate: 2026-11-22
tags: [games, indie dev]
summary: "My first game launch: a black-and-white physics motorcycle platformer where dying is scoring. Eight days from first commit to launch, and 30 handmade levels with a sawtooth difficulty curve held up by hand-placed coordinates and machine-checked solvability."
figure: rail
cover: /covers/blog-die-daily.jpg
translatedFrom: /blog/die-daily/
---

DieDaily is a black-and-white physics motorcycle platformer. Two controls — throttle and brake — a ragdoll stick figure, and spikes that kill on contact. When you die, you don't retry: the death goes straight onto your score. The game is live on [CrazyGames](https://www.crazygames.com/game/diedaily), or you can [play it right here](/die-daily/) (Chinese UI). It's the first thing I've ever shipped end to end, and it took eight days from first commit to launch. This essay is about the design core and the bugs worth remembering.

### Why deaths are the score

In most games, dying is a punishment: you reset, and the whole point is to not die. DieDaily flips that — **death is the score**. Every crash pops a death card that tells you exactly why you died: impaled, head scuffed the ground, flipped over, fell into a pit, even "ghost braking" (tapping the brake in midair with nothing anywhere near you). The harder you die, the higher you score, so players start hunting the routes that look like they'll kill you.

The death cards came late. In the earliest build you just died, and players resented it: "this level is unfair." Once every death explained itself, resentment turned into information — you knew whether to send it flat-out next time or lay off the throttle.

### A sawtooth difficulty curve across 30 levels

All 30 levels are handmade, each one a list of hand-placed coordinates. The curve is deliberately sawtoothed: three levels of climbing difficulty, then an easy one so you can breathe. The "endgame" feel is reserved for the final level — it never gets recycled in the middle. And to keep "solvable" from being a marketing promise, I wrote a static level validator: jump distances and platform gaps are machine-checked before anything ships, with a 30/30 regression script standing guard.

Each level carries three targets: clear it, clear it without dying, clear it fast (CLEAR / ZERO / PAR). Thirty levels make ninety targets — casual players chase completion, pros chase all-gold. Level 4's seesaw demands a full-speed run; level 16 is a fake bridge, where full throttle lands you on spikes and letting off drops you onto the island short of the flag. It's the first level in the line that asks you to think.

### The stack: Box2D plus pixi.js

Physics runs on [planck.js](https://github.com/pmndrs/planck) (a JS port of Box2D), rendering on pixi.js 8. I picked Box2D for its rock-solid joint constraints — the moment the ragdoll flies off the bike, every limb has to hold up to frame-by-frame scrutiny at 60 fps. It's the exact opposite of my other game, bead-string, where there's no physics engine at all and the feel of the beads is pure algorithm. Same author, two games, two worldviews: DieDaily lets the physics engine drive everything.

The air game got two flourishes — HOP (an extra midair jump) and TUCK (a midair tuck-spin) — plus death GIF export and full run replays, because a death shouldn't just be a number; it should be highlight material.

### Three real bugs from the git log

1. **HOP and TUCK popups stacking on the same frame.** Two floating labels triggered at once would overlap; the cause was an off-by-one in the column-avoidance logic when labels entered the queue. Fixing it also earned "head impalement" its own death channel, separated from generic "flip".
2. **Stunt frame timing.** The judgment frame for an air stunt was sampled too early; `usedHop` got mis-flagged and chain-jump detection silently died. Frame-by-frame replay during the deep audit is what found it.
3. **Levels with no gate.** Early on, changing one coordinate meant manually playing every level to check nothing broke. After the static validator landed, the question "did I just make level 17 unsolvable?" became a script run.

### If you're building one of these

The four-dimension framework that settled out of the LEVEL spec transfers directly: **solvability** (prove it with a machine, never by assertion), **difficulty curve** (sawtooth, endgame exactly once), **teaching** (hide the tutorial inside the levels; failure is the lesson), and **failure UX** (a near-miss sells the retry better than a clean death ever will).

### Limits and what's next

The "daily" promise is only half-kept: today the daily level rotates through the 30 by date — it isn't a new level every day. Whether to build true daily levels waits on the first round of analytics. Touch controls are in; the game now lives on CrazyGames, which loads directly in most regions, and the on-site mirror plays direct.

When you're done dying, come browse the other builds in [the projects list](/projects/) — and post your death count in the CrazyGames comments.
