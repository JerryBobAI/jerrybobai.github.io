---
title: "Tesla's VP of AI on End-to-End Driving: Inside the FSD Foundation Model and Its World Simulator (ICCV 2025)"
pubDate: 2026-11-22
tags: [AI, autonomous driving, world models]
summary: "Tesla's first public teardown of its end-to-end foundation model stack: camera pixels straight in, control actions straight out — two billion tokens in, two out. The hardest part is evaluation, and the fix is elegantly cheap: flip the state-action pairs, and every mile of driving data trains an interactive world simulator for free."
figure: hub
cover: /covers/blog-tesla-fsd-world-simulator.jpg
translatedFrom: /blog/tesla-fsd-world-simulator/
---

Ashok Elluswamy, Tesla's VP of AI, gave the keynote "Building an Autonomous Future" (remotely) at the WDFM-AD workshop — the 2nd Workshop on Distillation of Foundation Models for Autonomous Driving — at ICCV 2025 in Honolulu. It's the first time Tesla has publicly walked through its end-to-end foundation-model stack in a structured way. This essay is a careful read of the full talk transcript, cross-checked against the official blog post from the workshop organizers; claims are attributed to the speaker throughout, and numbers that Tesla itself hasn't confirmed are flagged as such.

## 1. The one-line version

Tesla's first public teardown: FSD (Full Self-Driving) and Robotaxi run on **one large end-to-end neural network** — camera pixels straight in, control actions straight out, no hand-drawn module boundaries in between. And the hardest part, according to Ashok, is **evaluation** — which is why Tesla built its own neural world simulator, moving evaluation into an interactive, generated environment.

## 2. The scoreboard: where Robotaxi stands in 2025

The talk opens with three things that have "already happened" (all speaker's claims):

| Fact | Detail |
|---|---|
| Robotaxi service live | Operating in Austin and the SF Bay Area since June–July; in Austin, no safety driver inside below 40 mph (~64 km/h) |
| Factory-to-door delivery | The first customer car drove itself from the Austin factory to the customer's home — 20–30 minutes covering highway, city streets, and a parking lot |
| Fleet-wide self-logistics | Every Tesla built in the US now drives itself from the production line to the loading dock a few miles away |

He's explicit that the delivery demo used a **production car, production cameras, and the same computer as every car on sale** — not a one-off test mule. The subtext of the whole segment: autonomous driving is no longer a lab capability. It's a factory-floor routine.

## 3. Why go all-in on end-to-end

The stack's core: **a single large end-to-end neural network** taking raw pixels + navigation maps + vehicle kinematics + audio, and outputting control actions ("Photon In → Control Out", in the organizers' phrasing). The talk is explicit: the model **no longer performs explicit vehicle detection or road-boundary perception**. Such capabilities can exist implicitly, or be trained as auxiliary tasks — but what drives the car is the direct mapping from video stream to actions.

Why abandon the modular pipeline (perception → prediction → planning, each optimized separately and stitched together)? He gives three reasons.

**Reason one: human preferences can't be explicitly coded.** Obstacle ahead — slam the brakes or ease off? Brake too early and the ride feels bad; too late and it's unsafe, and the reasonable threshold at 15 mph is nothing like the one at 70. This isn't an engineering parameter with an objective optimum. It's the problem of aligning human values into code. "You can try to write it down, but you'll write it badly."

<details class="mt-3 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
<summary><strong>Deep dive | Why "when to brake" breaks the modular case</strong></summary>
<ul>
<li>The modular pipeline's hidden assumption: every driving decision has a writable explicit cost function — a math function that scores each candidate action.</li>
<li>Ashok's counterexample: for the same obstacle, whether "close in fast, brake late" or "ease off early" is right depends on speed, road context, and passenger comfort preferences.</li>
<li>So the cost function isn't one curve — it's a preference distribution that shifts continuously with the scene. Enumerating it in code means patching forever.</li>
<li>A neural network trained on human driving data learns that preference distribution directly, with no one forcing it to be explicit.</li>
<li><strong>One line:</strong> the hard part isn't "how to drive" — it's "what humans consider driving well." That is precisely learning methods' home turf.</li>
</ul>
</details>

**Reason two: module interfaces lose information.** Traditional perception outputs a list of objects (bounding boxes, semantic maps) — an "ill-defined" interface that throws information away. Rare scenes (an animal crossing the road) can't be expressed properly as an object list, and uncertainty can't propagate through the whole system.

**Reason three: deterministic latency.** Branching computations make modular latency unpredictable; real-time systems need deterministic latency. A single network provides that guarantee.

Three live video examples (all autonomous):

- A flooded single-lane road in each direction: the car borrows the opposing lane to go around. There's no explicit code that prices "cost of crossing the line vs. cost of wading" — but one look at the scene and the right move is obvious.
- A flock of chickens crossing: the car waits for the last one. "There's no collision risk, but this is what you're supposed to do."
- A flock of geese standing in the middle of the road: the model judges that they're **not crossing, just standing**, so it reverses and steers around them. The audience gasped: "It's changing its mind."

## 4. Hard problem one: two billion tokens in, two out

Ashok calls building such a system "very hard," and the first difficulty is the curse of dimensionality: the input space is enormous while the output is tiny, which makes learning the right mapping brutally difficult.

- **7–8 cameras** per car depending on model, each 5 MP at a high frame rate (36 Hz per the organizers' blog; the talk itself only says "high frame rate");
- A 30-second context window plus route and speed kinematics — inputs that "easily exceed **two billion tokens**";
- Output: roughly **two tokens** — the next step's steering and acceleration.

<details class="mt-3 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
<summary><strong>Deep dive | What makes a many-to-one mapping hard</strong></summary>
<ul>
<li>Language models map tokens to tokens at similar scale; driving is an extreme compression — two billion in, two out.</li>
<li>Naively stacking a giant transformer for a brute-force mapping invites spurious correlations — statistical coincidences with no causal grounding, like "this stretch of road usually comes with this micro-steering." Change the distribution and it collapses.</li>
<li>What the model actually has to learn is <strong>why</strong> those two tokens are right: extracting the correct signal from overwhelming context and generalizing robustly across distributions.</li>
<li>This is a data problem, not an architecture problem — which is why the answer, next section, is a data engine.</li>
</ul>
</details>

Tesla's answer is the data engine: the fleet has accumulated "500 years of driving" (his figure) — far beyond what cluster storage can hold — so the system must distill data that covers the genealogy of driving. Three distillation mechanisms, per the talk:

1. **Explicit triggers** — footage auto-saved when a pre-set scenario condition fires;
2. **Small dedicated neural networks** — mining for specific scenarios on purpose;
3. **Prediction-minus-reality monitoring** — continuously comparing what the model predicted against what actually happened; any deviation is a high-value sample.

He stressed this kind of rare data **cannot be staged**: "It requires a static scene, the state space of every vehicle in the scene — that's genuinely hard to fake." Only a whole fleet picks it up for free. It's Tesla's moat, and he named it: the "Niagara Falls of data."

## 5. Hard problem two: debugging a black box

"It's end-to-end — so how do you debug it when it breaks?" His answer: **the same model can be prompted to predict any intermediate quantity**: 3D occupancy (the grid representation that chops space into cells and labels which ones are filled), traffic lights, curbs, object classes — even a natural-language explanation of its own decision. The car at runtime consumes only the control actions; everything else is auxiliary. But those outputs provide interpretability and internal supervision, which in turn push the model toward more correct control.

### 5.1 The Gaussian splatting variant

Gaussian splatting — reconstructing a 3D scene from tens of thousands of colored, translucent ellipsoids — has been an academic darling, but the traditional pipeline (nerfstudio et al.) has a fatal weakness in driving: cars mostly drive straight, so the camera baseline stays tiny, renders near the training views look great, and **any new view off the training distribution falls apart** into blur. It also needs explicit solvers like COLMAP to initialize poses and takes tens of minutes.

Tesla's variant has **the same foundation model generate the Gaussians directly**:

| Dimension | Traditional splatting | Tesla variant (as demoed) |
|---|---|---|
| Generalization to novel views | Collapses into blur | 3D structure largely intact while rotating |
| Pose initialization | Needs a COLMAP-class solver | No traditional initialization |
| Speed | Tens of minutes | "Ridiculously fast"; scene updates in near-real-time |
| Semantics | None | Emitted directly alongside the geometry |

The purpose is debugging: you can tell whether the car was accelerating or braking, whether it cleared the obstacle safely — engineers can step inside the scene the model "sees."

### 5.2 One model, two gears

- **Fast path**: normal driving; control actions come straight out, no inference overhead.
- **Reflective mode**: when there's time, the model first produces reasoning tokens, and the action must be consistent with the reasoning.

<details class="mt-3 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
<summary><strong>Deep dive | Why not think hard all the time</strong></summary>
<ul>
<li>A full reasoning chain on every decision eats latency; real-time control can't wait for it.</li>
<li>So the default is the fast path — intuitive, direct action (System 1, in the psychology framing).</li>
<li>Reflection fires only where it's "needed": think first, then act, with action and reasoning forced to agree (System 2).</li>
<li>It's test-time compute, scaled on demand — the driving edition of spending compute where it's hard.</li>
<li><strong>One line:</strong> same weights, two gears — think on the hard cases, act on the easy ones.</li>
</ul>
</details>

## 6. Hard problem three: evaluation

Ashok's own ranking: evaluation is "**the hardest of these three problems**" (the three being dimensionality, interpretability, and evaluation). His opening is blunt: feed in masses of driver data, keep scaling, and **open-loop metrics look great without necessarily translating into real driving performance**. He didn't unpack the mechanism ("many reasons — won't go into it"), only that fixing it takes serious investment.

The second trap is **the evaluation set itself**. Sample the fleet at random and most of what you get is boring highway cruising — evaluating on that distribution means nothing. The fix, again, is the data engine: the same triggers and mining mechanisms build a **balanced, fully covering evaluation set**. He admits the work is "extremely important and very tedious."

One demo detail deserves unpacking — proactive safety, i.e. second-order reasoning:

<details class="mt-3 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
<summary><strong>Deep dive | Why braking early is the mark of intelligence when the car ahead spins out</strong></summary>
<ul>
<li>The demo: on a highway, a car ahead spins out of control, about to hit the barrier and bounce back into Tesla's lane. Tesla begins braking at roughly 4 m/s² — "not a gentle brake" — <strong>before the car ahead has even hit the barrier</strong>.</li>
<li>The key: the evidence chain isn't closed yet. The spinning car hasn't bounced back; its trajectory could still be read as "it's changing lanes."</li>
<li>An ordinary system waits for the first-order event — the crash, the bounce, the velocity vector snapping — before reacting. Tesla's model predicted the second-order consequence (hit barrier → rebound → intrusion into this lane) during the spin, and braked early.</li>
<li>Ashok's criterion is hard: a 4 m/s² deceleration request can only come from predicting a collision; it can't come from misreading a lane change. The model isn't getting lucky — it understood the physics.</li>
<li><strong>One line:</strong> intelligence isn't how fast you react — it's how far in advance you know the bad thing is coming.</li>
</ul>
</details>

## 7. The world simulator: moving evaluation into the network

This is the most technically loaded part of the talk, and the core insight is one sentence: **flip the state-action pair, and a world model trains itself for free.**

### 7.1 The training principle

State-action pairs — a snapshot of the world at some moment, plus the action taken — are the cheapest thing in driving data. No human labels, no optimal driving required. Flip the training target: **given past states and an action, predict the next state**. Any trash driving becomes usable training data, because what a simulator needs is precisely the edge cases.

<details class="mt-3 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
<summary><strong>Deep dive | Why the flipped pairs teach a world model</strong></summary>
<ul>
<li>A driving model learns "state → best action." A world simulator learns "state + <em>any</em> action → the world's next frame."</li>
<li>Supervision for the second problem is everywhere: every second, the fleet produces "state now + action the driver took + what the world actually did next." All free labels.</li>
<li>Once trained, feed the predicted next state back in, attach any action, and roll forward forever (autoregressive generation).</li>
<li>It covers edge cases by construction — the fleet data is full of humans doing ridiculous things.</li>
<li><strong>One line:</strong> no labeling, no staged scenarios — physics itself lives inside every frame of "action → consequence."</li>
</ul>
</details>

### 7.2 The demo specs

- **One network generating eight camera streams simultaneously** (front, side, rear-view mix), each 5 MP;
- **Action-conditioned** — you can drive the simulator in real time; steering and braking both respond;
- Continuous generation of 1–1.5 minutes with all eight 5 MP streams consistent; cross-camera consistency down to wheel rims and traffic lights;
- Lowering test-time compute gets to **near-real-time rendering** — they demoed six straight minutes of interactive driving, deliberately driving up onto a curb to test generalization, and the image held.

### 7.3 Three ways to use it

| Use | How | Value |
|---|---|---|
| Replay old failures | Feed last year's failure case (too close to a pedestrian, say) straight into the newest network | Verify "is this fixed?" instantly, no new miles needed |
| Adversarial injection | Condition the car in the original video that was going straight to cut into your path; everything else stays identical | Synthesized corner-case evaluation sets: change one variable, hold the rest |
| Closed-loop RL | Let the policy drive inside the simulator for hours without crashing | A training ground for closed-loop reinforcement learning |

The third row is the real headroom: Ashok said outright that the tool is "not just for evaluation — it can also be used for closed-loop reinforcement learning." The simulator is the training ground.

## 8. Outlook: the same stack, from cars to Optimus

Three closing claims (all the speaker's framing):

1. **Robotaxi expansion**: the goal is unlocking full autonomy across the whole fleet; Cybercab, Tesla's purpose-built next-gen vehicle, has two seats and exists for robotaxi — with the claim that "transportation cost will be the lowest, even lower than public transit."
2. **The method scales**: same approach across vehicle platforms, regions, and weather.
3. **Transfer to Optimus** (Tesla's humanoid robot): the world simulator's video generation works for Optimus too — demoed as a **fully generated video** of Optimus navigating a factory — and it's action-conditioned: the original clip of walking straight serves as ground truth, and conditioning generates correct pixels for left turns, right turns, and beyond. "The same neural network, plus some Optimus data, generalizes to other robot forms."

The closing line: "Tesla is all in on robotics" — the entire company focused on producing "intelligent, useful, large-scale" robots — followed by a recruiting pitch aimed at AI, robotics, and vision researchers.

## 9. The quotes

> "It requires a lot of intelligence to understand that something is going wrong way before it actually goes wrong." (on the preemptive braking demo)

> "Basically has access to the Niagara Falls of data, and it's up to Tesla to use this data to solve this problem." (on the fleet-data moat)

> "You can't stage this that easily... Tesla has a unique advantage here that it can tap into the entire fleet to get this data." (on the data engine)

> "Any kind of trash driving is good enough for this kind of simulator." (on training the world simulator from flipped state-action pairs)

> "Evaluation... is actually the most difficult of these three problems." (his own ranking: dimensionality < interpretability < evaluation)

> "Tesla is all in on robotics. The entire company is just focused on producing intelligent, useful, large-scale robots." (the closing declaration)

## 10. My read

**What transfers:**

- **The end-to-end defense is the LLM paradigm, ported.** The strongest of Ashok's three reasons — "human preferences can't be explicitly coded" — is the same reason RLHF exists: rather than hand-writing rules, learn the preference distribution from human behavior. Autonomous driving today is language models yesterday; the modular-to-end-to-end playbook maps one to one.
- **"Two billion in, two out" is a constraint, not a flaw.** A tiny action space forces the right engineering direction: since you can't generate candidates and pick one, the only levers are input-side data quality and the evaluation loop. That's a fundamentally different road from LLMs' sample-and-select — worth filing under "problem shape determines method."
- **The evaluation bottleneck resonates far beyond cars.** "Loss doesn't predict real performance; open-loop metrics lie" replays one to one in agent development: benchmark scores don't predict real-task success. Tesla's answer — build your own interactive environment — generalizes: **build the environment before you brag about capability**. And the economics of flipped state-action pairs (the thing that was going to happen anyway, as a free label) is a paradigm-level trick for any domain that has historical behavior logs plus final outcomes.
- **"Think on the hard cases, act on the easy ones"** is reasoning models' adaptive thinking landing in a real-time system — test-time compute allocated on demand is a general architecture pattern for real-time products.

**Where to apply discounts:**

- The ~trillion-parameter and 36 Hz figures come from the **organizers' blog, not Tesla** (the blogger is a workshop organizer, not a Tesla employee);
- "Transfers most seamlessly to other forms of robots" is promo language — the demo is video generation, not real robot control;
- Every driving datum and demo comes from the speaker himself, with no third-party verification; "driverless below 40 mph" is an operational limit, not a capability claim;
- The recruiting pitch and the closing declaration are company narrative — read them for direction, nothing more.

**Leading indicators worth watching:**

- Cybercab production, and how fast the driverless speed cap (40 mph) climbs;
- Whether the world simulator gets a paper or an open release (the WDFM-AD series has precedent — Waymo presenting on distillation — so academic engagement is a real demand);
- What the same speaker adds next time (his CVPR'26 keynote is already circulating on YouTube, 66K views);
- Whether adversarial-injection evaluation becomes an industry standard — it directly sets the cost curve for validating rare scenarios.
