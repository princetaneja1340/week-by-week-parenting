/* ==========================================================================
   Week by Week Parenting™ · by Aasthaxp
   script.js — vanilla JS, no dependencies, no build step.

   Contents
   --------
   01 · Boot & helpers
   02 · Unlock flag  ← flip UNLOCK_ALL to false to re-lock weeks
   03 · Week content (all 26 weeks of Stage 1)
   04 · Week navigator (chips, selection, keyboard, scrolling)
   05 · Week card renderer
   06 · Session persistence (checkboxes + memory page)
   07 · Parenting scorecard
   08 · Reveal-on-scroll (IntersectionObserver)
   09 · Header, mobile nav, smooth scroll, print
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     01 · BOOT & HELPERS
     ======================================================================== */

  // Progressive enhancement: CSS hides .reveal only when JS is present.
  document.documentElement.classList.remove('no-js');

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Session-scoped store. Falls back to an in-memory object if sessionStorage
     is unavailable (private mode, file:// in some browsers). */
  var store = (function () {
    var memory = {};
    var ok = false;
    try {
      var k = '__wbw_test__';
      window.sessionStorage.setItem(k, '1');
      window.sessionStorage.removeItem(k);
      ok = true;
    } catch (e) { ok = false; }

    return {
      get: function (key) {
        try { return ok ? window.sessionStorage.getItem(key) : (key in memory ? memory[key] : null); }
        catch (e) { return null; }
      },
      set: function (key, value) {
        try { if (ok) { window.sessionStorage.setItem(key, value); } else { memory[key] = value; } }
        catch (e) { memory[key] = value; }
      }
    };
  })();

  var PREFIX = 'wbw:';


  /* ========================================================================
     02 · UNLOCK FLAG
     ------------------------------------------------------------------------
     LIMITED-PERIOD PROMOTION: every week renders its complete card.

     To re-lock later, set UNLOCK_ALL to false. Weeks other than
     FEATURED_WEEK then fall back to the teaser card automatically —
     no other code or markup changes needed. Also remove the
     `.unlock-banner` block from index.html when you re-lock.
     ======================================================================== */

  var UNLOCK_ALL    = true;
  var FEATURED_WEEK = 14;   // still the "sample" week highlighted in the navigator

  var STAGE_1 = 'Stage 1 · Birth–6 Months';


  /* ========================================================================
     03 · WEEK CONTENT
     ------------------------------------------------------------------------
     Shape of each entry (keys kept short so the data stays readable):

       n      week number
       title  card title
       emoji  navigator/preview emoji
       focus  one-line summary
       meta   3 header pills
       goals  [emotional, physical, brain, language, social]
       min    4 tasks · 5 min/day
       bet    5 tasks · 15 min/day
       bst    4 tasks · 30+ min/day
       mom / dad / fam   role missions
       bud    { b: budget price, p: premium price, f: [], m: [], p3: [] }
       avoid  5 items (red styling)
       flags  5 items (amber styling)
       sci    { p: paragraph, t: take-away }
       val    { q: quote, v: value name, n: note }
       card   5 tear-off mission-card checks
     ======================================================================== */

  var WEEKS = [

    /* ---------------------------------------------------------------- 1 */
    {
      n: 1, emoji: '🤱', title: 'Skin, Scent & Safety',
      focus: 'Skin-to-skin, a feeding rhythm, and a very quiet room.',
      meta: ['🤱 Skin-to-skin', '😴 Safe sleep', '🍼 Feeding rhythm'],
      goals: [
        'Baby settles on your chest within a minute or two of being held.',
        'Feeds 8–12 times in 24 hours; wet nappies steady from day 5.',
        'Begins to prefer your smell and voice over a stranger’s.',
        'Hears real speech — not only shushing — several times a day.',
        'One other trusted adult holds baby every day.'
      ],
      min: [
        'Ten minutes of skin-to-skin, once a day.',
        'Say one calm sentence at every nappy change.',
        'Check the cot: firm, flat, empty, baby on the back.',
        'Drink a full glass of water at every feed.'
      ],
      bet: [
        'Everything in Minimum.',
        'Two skin-to-skin sessions of 20 minutes.',
        'Learn one hunger cue that comes before crying — rooting, hand to mouth.',
        'Dim the lights after 8 p.m. so night starts feeling different from day.',
        'Ask one visitor to bring food instead of gifts.'
      ],
      bst: [
        'Everything in Better, spread across the day.',
        'Skin-to-skin with the second parent, daily.',
        'Track feeds and nappies for one full day to see the real pattern.',
        'Sleep when the baby sleeps, once, without apologising for it.'
      ],
      mom: 'One hot meal, sitting down, every day. You are not the host this week — you are the patient. Let someone else answer the door.',
      dad: 'Own the nights in blocks. Nappies, burping and settling for one three-hour stretch so she gets unbroken sleep — not “help”, your shift.',
      fam: 'Agree one house rule out loud: nobody wakes a sleeping baby for a photo. Write it on a sticky note by the door if you have to.',
      bud: { b: '₹300–₹800', p: '₹2,000+',
        f: ['Your bare chest', 'Clean cotton cloth', 'A steady, low voice'],
        m: ['Muslin swaddle cloths', 'Feeding pillow', 'Nipple balm'],
        p3: ['Hospital-grade pump on rent', 'One postpartum doula visit', 'Bedside co-sleeper cot'] },
      avoid: [
        'Passing the baby around a room full of visitors.',
        'Pillows, bumpers or loose blankets in the cot.',
        'Kajal in the eyes; oil in the ears or nose.',
        'Sugar water, ghutti or honey — nothing but milk.',
        'Judging your supply by how long a feed takes.'
      ],
      flags: [
        'Fewer than six wet nappies a day after day five.',
        'Yellowing that reaches the palms and soles, or keeps deepening.',
        'Temperature below 36.5°C or above 37.9°C.',
        'Not waking at all for feeds, or too sleepy to feed.',
        'Grunting, or nostrils flaring, with every breath.'
      ],
      sci: { p: 'The first week is dominated by <strong>chemosensory learning</strong> — newborns orient toward the smell of their own mother’s milk within days. Kangaroo care (skin-to-skin) is associated with steadier heart rate, temperature and blood sugar in the newborn period, which is why it is standard practice in neonatal units worldwide.',
             t: 'Skin-to-skin isn’t sentimental. It’s physiology.' },
      val: { q: 'A newborn does not need a perfect parent. It needs a present one.', v: 'Presence',
             n: 'Presence is not performance. Sitting quietly in the room counts.' },
      card: ['Ten minutes skin-to-skin', 'Cot: firm, flat, empty, on the back', 'Talk at every nappy change', 'One hot meal for mom', 'Second parent holds baby daily']
    },

    /* ---------------------------------------------------------------- 2 */
    {
      n: 2, emoji: '👁️', title: 'Eye Contact & First Bonds',
      focus: 'Twenty centimetres away is exactly where your face belongs.',
      meta: ['👁️ Mutual gaze', '🔇 Low stimulation', '🗣️ Real words'],
      goals: [
        'Calms faster when she sees your face, not only when she feels your arms.',
        'Turns her head briefly toward light and toward voices.',
        'Holds your gaze for five to ten seconds at about 22 cm.',
        'Hears a few hundred real words spoken directly to him today.',
        'Every reflexive smile gets a smile back.'
      ],
      min: [
        'Hold baby 22 cm from your face and simply look, for two minutes.',
        'Narrate one nappy change from start to finish.',
        'Switch off background TV and radio for one hour.',
        'One feed with eye contact and no phone.'
      ],
      bet: [
        'Everything in Minimum.',
        'Slow-blink game: blink, wait, blink — ten rounds.',
        'Carry baby to a window and name three things you can both see.',
        'Read one page aloud from whatever you happen to be reading.',
        'Second parent does their own five minutes of face time.'
      ],
      bst: [
        'Everything in Better.',
        'Ten minutes of gaze-and-talk after a feed, phone in another room.',
        'Photograph baby’s eyes in soft daylight — no flash.',
        'Sing the same lullaby, the same way, at the same time tonight.'
      ],
      mom: 'Say one true sentence out loud, to another adult, about how you actually feel today. Not a status update — a sentence.',
      dad: 'Become the best cue-reader in the house. Take charge of the question “is she hungry or tired?” and get good at it.',
      fam: 'Decide who is on visitor duty this week so mom never has to host, serve tea, or explain anything to anyone.',
      bud: { b: '₹200–₹500', p: '₹1,200+',
        f: ['Your face in daylight', 'A window', 'Your ordinary speaking voice'],
        m: ['Black-and-white contrast cards', 'Extra muslins', 'A cotton floor sheet'],
        p3: ['Contrast board-book set', 'Shatterproof floor mirror', 'Organic cotton play mat'] },
      avoid: [
        'Any screen inside the baby’s line of sight.',
        'Jiggling or shaking to stop a cry — sway slowly instead.',
        'Strong perfume, attar or hair oil right before a cuddle.',
        'Bright overhead tube light straight into the eyes.',
        'Comparing your baby to anyone else’s, including your first child.'
      ],
      flags: [
        'Eyes that never track anything, even briefly.',
        'No startle response to a sudden, loud sound.',
        'A white or grey reflection in the pupil in photos.',
        'Constant watering with sticky discharge in both eyes.',
        'Every feed taking 45+ minutes with poor weight gain.'
      ],
      sci: { p: 'Newborn focal distance is roughly <strong>20–30 cm</strong> — almost exactly the distance from the breast or bottle to a parent’s face. Face-like patterns attract more looking than scrambled ones from the first days of life, and early episodes of mutual gaze are associated with later joint attention.',
             t: 'You are already the most interesting object in the room. Get closer.' },
      val: { q: 'Being looked at is the first way a person learns they exist.', v: 'Attention',
             n: 'Give the same undivided look to your partner once today. It works on adults too.' },
      card: ['Two minutes of face time', 'TV and radio off for an hour', 'Narrate one nappy change', 'Same lullaby each night', 'Dad does his own gaze time']
    },

    /* ---------------------------------------------------------------- 3 */
    {
      n: 3, emoji: '🌗', title: 'Rhythms of Day & Night',
      focus: 'Bright mornings, dim evenings — building the first body clock.',
      meta: ['🌞 Morning light', '🌙 Dim evenings', '🔁 Repeatable order'],
      goals: [
        'Evenings feel predictable, even when they are hard.',
        'Longer feeds by day, so night stretches slowly lengthen.',
        'Starts linking dim light and quiet with sleep.',
        'Hears a different tone of voice at night — softer, slower.',
        'The whole household knows what happens after dinner.'
      ],
      min: [
        'Open the curtains within 30 minutes of waking.',
        'Keep night feeds boring: low light, few words, no play.',
        'Same three things, same order, before the longest sleep.',
        'Say “good morning” properly, out loud, once a day.'
      ],
      bet: [
        'Everything in Minimum.',
        'Ten minutes of indirect daylight in the morning — a balcony or window.',
        'Change into “day clothes” and “night clothes”, even at home.',
        'Keep daytime normal-noisy: fans, kitchen, conversation.',
        'Write down the rough time of the longest sleep for three days.'
      ],
      bst: [
        'Everything in Better.',
        'Build a five-minute bedtime sequence you can repeat for years.',
        'Both parents learn the sequence so either can run it.',
        'One evening walk outdoors before dark.'
      ],
      mom: 'Protect one 90-minute daytime sleep block for yourself this week. Someone else holds the baby, phone off, door shut. Non-negotiable.',
      dad: 'Own the bedtime sequence three nights this week — start to finish, no coaching from anyone.',
      fam: 'Agree the evening quiet hour: lights down, volume down, no new visitors after that time.',
      bud: { b: '₹400–₹1,000', p: '₹2,500+',
        f: ['Daylight', 'A curtain', 'Your own voice, two volumes'],
        m: ['Dim warm night lamp', 'Blackout curtain clips', 'Cotton sleep sacks'],
        p3: ['Blackout curtains', 'White-noise machine', 'Dimmable warm bedside light'] },
      avoid: [
        'Bright white light during night feeds.',
        'Tiptoeing in silence during the day — normal noise is good.',
        'Starting a rigid schedule and blaming yourself when it breaks.',
        'Late-evening visitors “just for five minutes”.',
        'Screens in the room during the wind-down hour.'
      ],
      flags: [
        'Inconsolable crying for more than three hours most days.',
        'No alert, awake period at all across a whole day.',
        'Losing weight, or still below birth weight after two weeks.',
        'Arching, screaming and vomiting after most feeds.',
        'A parent who cannot sleep even when the baby is sleeping.'
      ],
      sci: { p: 'Circadian rhythm is not present at birth — melatonin production ramps up over the <strong>first two to three months</strong>, entrained largely by light exposure and by the regularity of daily routines. Morning light and dim evenings are the two strongest, cheapest levers available to you.',
             t: 'You cannot force a newborn to sleep. You can teach the difference between day and night.' },
      val: { q: 'Rhythm is kinder than a schedule. It bends without breaking.', v: 'Rhythm',
             n: 'Aim for the same order of events, not the same times on a clock.' },
      card: ['Curtains open on waking', 'Night feeds: low light, few words', 'Same three things before bed', 'One evening walk', 'Quiet hour after dinner']
    },

    /* ---------------------------------------------------------------- 4 */
    {
      n: 4, emoji: '💪', title: 'Tummy Time Begins',
      focus: 'Seconds, not minutes. Time on your chest counts.',
      meta: ['💪 Neck strength', '🤸 Position changes', '⏱️ Little and often'],
      goals: [
        'Protests less on the tummy when you are face to face with him.',
        'Lifts the head briefly and turns it from one cheek to the other.',
        'Learns that a change of position brings a change of view.',
        'Hears encouragement, not just instruction — tone matters.',
        'Does tummy time with two different adults.'
      ],
      min: [
        'Three tummy-time sessions of 20–30 seconds each.',
        'Lie back and let baby lie on your chest, face to face.',
        'Alternate which end of the cot you lay baby down at.',
        'Carry baby in a different position for one trip across the room.'
      ],
      bet: [
        'Everything in Minimum.',
        'Total two to three minutes of floor tummy time across the day.',
        'Tummy time across your lap during burping.',
        'Get down to floor level so your face is the reward.',
        'Alternate the arm you carry and feed on.'
      ],
      bst: [
        'Everything in Better.',
        'Five short sessions, always ending before the crying starts.',
        'Add a rolled towel under the chest for support.',
        'Film ten seconds today; compare it in four weeks.'
      ],
      mom: 'Do your own floor time. Lie flat on your back for five minutes and breathe into your belly — your core has had a hard year.',
      dad: 'Be the tummy-time partner. You get on the floor, at eye level, and make it the best part of his day.',
      fam: 'Clear one safe, clean floor space that stays clear all week. No shoes, no clutter, always ready.',
      bud: { b: '₹300–₹900', p: '₹2,000+',
        f: ['Your chest', 'A clean bedsheet on the floor', 'A rolled hand towel'],
        m: ['Cotton quilted play mat', 'Small crinkle cloth book', 'Rolled bolster'],
        p3: ['Padded foam play mat', 'Wooden play gym', 'Tummy-time water mat'] },
      avoid: [
        'Tummy time straight after a feed.',
        'Pushing through hard crying — stop, cuddle, try again later.',
        'Leaving baby unattended on a bed or sofa, ever.',
        'Long stretches in car seats, bouncers or swings.',
        'Comparing head control with an older cousin.'
      ],
      flags: [
        'No attempt at all to lift or turn the head by six weeks.',
        'A head that always turns to the same side, never the other.',
        'A distinct flattening on one side of the skull.',
        'Stiffness or a strong arch through the back at rest.',
        'Arms and legs that feel floppy when you lift him.'
      ],
      sci: { p: 'Since back-sleeping guidance dramatically reduced sudden infant deaths, awake <strong>prone play</strong> became the main way infants build neck, shoulder and trunk strength. Higher daily tummy-time minutes are associated with earlier attainment of rolling and crawling — but the total is what matters, not the length of any one session.',
             t: 'Six sessions of thirty seconds beat one miserable three-minute session.' },
      val: { q: 'Strength is built in small doses, repeated cheerfully.', v: 'Consistency',
             n: 'The same is true of your own habits this year. Small, cheerful, repeated.' },
      card: ['3 × 30 seconds tummy time', 'Chest-to-chest daily', 'Alternate cot ends', 'Swap carrying arm', 'Stop before the crying']
    },

    /* ---------------------------------------------------------------- 5 */
    {
      n: 5, emoji: '🔊', title: 'The Language of Crying',
      focus: 'Learning your baby’s three or four distinct cries.',
      meta: ['🔊 Cue reading', '🤝 Quick response', '🧘 Your own calm'],
      goals: [
        'Learns that crying reliably brings someone — the root of trust.',
        'Settles with a consistent soothing sequence you both know.',
        'Begins to be soothed by anticipation, before the feed arrives.',
        'Hears her cry answered in words: “I hear you, I’m coming.”',
        'Can be soothed by at least two different people.'
      ],
      min: [
        'Answer every cry within a few seconds, even if only with your voice.',
        'Say out loud what you think the cry means.',
        'Use the same soothing order every time.',
        'One long exhale before you pick her up.'
      ],
      bet: [
        'Everything in Minimum.',
        'Name three different cries this week — hungry, tired, overstimulated.',
        'Try the 5-step calm: hold, sway, shush, skin, feed.',
        'Hand over to the second parent before you reach your limit.',
        'Note the time of day the hardest hour happens.'
      ],
      bst: [
        'Everything in Better.',
        'Build a written “calm plan” both parents follow in order.',
        'Practise a five-minute reset for yourself: put baby down safe, breathe.',
        'Tell one person outside the house how the hard hour is going.'
      ],
      mom: 'You are allowed to put a crying baby down in a safe cot and walk out for five minutes. That is good parenting, not failure.',
      dad: 'Take the hardest hour of the day this week. Not the easy evening cuddle — the hour that actually breaks people.',
      fam: 'Agree the handover phrase: “I need ten minutes.” No explanation required, no questions asked, from anyone.',
      bud: { b: '₹300–₹800', p: '₹2,500+',
        f: ['Your heartbeat', 'A slow sway', 'A dark, quiet room'],
        m: ['Stretchy wrap carrier', 'Swaddle with velcro', 'Hot water bottle for your own back'],
        p3: ['Ergonomic structured carrier', 'White-noise machine', 'Lactation or sleep consult'] },
      avoid: [
        'Any advice to “let a newborn cry it out”.',
        'Shaking, jerking or tossing — never, not once, not gently.',
        'Gripe water or unprescribed colic drops.',
        'Feeding as the answer to every single cry.',
        'Staying alone with a crying baby when you are past your limit.'
      ],
      flags: [
        'A high-pitched, shrill or unusually weak cry.',
        'Crying more than three hours a day, three days a week.',
        'A cry that cannot be soothed at all, for hours.',
        'Blood or mucus in the stool alongside inconsolable crying.',
        'Any thought of harming yourself or the baby — call for help today.'
      ],
      sci: { p: 'Responding promptly and consistently to infant distress is associated with <strong>less</strong> crying by the end of the first year, not more — an infant cannot be “spoiled” by responsiveness at this age. Crying peaks around six to eight weeks in most babies and then declines; knowing that curve exists helps parents survive it.',
             t: 'You are not creating a habit. You are building a nervous system.' },
      val: { q: 'A cry answered a thousand times becomes a person who asks for help.', v: 'Trust',
             n: 'Answering also teaches your child how to answer others, later.' },
      card: ['Answer every cry quickly', 'Say what the cry means', 'Same soothing order', 'Hand over before your limit', 'Five-minute reset is allowed']
    },

    /* ---------------------------------------------------------------- 6 */
    {
      n: 6, emoji: '😊', title: 'First Social Smiles',
      focus: 'Smile, wait, smile again — the first real conversation.',
      meta: ['😊 Social smile', '⏳ The pause', '🔁 Serve and return'],
      goals: [
        'Smiles on purpose at a familiar face, not just in sleep.',
        'Whole body brightens — arms and legs join the smile.',
        'Starts to expect a response after her own action.',
        'Makes an open vowel sound: “aah”, “ooh”.',
        'Smiles at two or three regular faces, not only mom.'
      ],
      min: [
        'Smile at your baby first, then wait three full seconds.',
        'Copy any sound she makes, exactly, once.',
        'One round of exaggerated eyebrow-raise and wide eyes.',
        'Greet baby with a smile every time you re-enter the room.'
      ],
      bet: [
        'Everything in Minimum.',
        'Ten rounds of smile → pause → response.',
        'Let another family member try to earn a smile.',
        'Talk in “parentese”: higher pitch, slower, exaggerated vowels.',
        'Catch and photograph one real smile.'
      ],
      bst: [
        'Everything in Better.',
        'Fifteen minutes of face-to-face play across the day.',
        'Try tongue-out imitation and see what comes back.',
        'Record a short video of the first proper smile — it disappears fast.'
      ],
      mom: 'That smile is your evidence. On the days you feel you are doing nothing right, go back and look at it.',
      dad: 'Earn your own smile. Same face, same silly sound, every day this week until it lands.',
      fam: 'Teach grandparents the pause. Most adults talk over a baby. Three seconds of silence is the whole trick.',
      bud: { b: '₹200–₹600', p: '₹1,500+',
        f: ['Your face', 'Silly noises', 'Three seconds of patience'],
        m: ['Soft cloth book', 'Contrast rattle', 'Baby-safe mirror card'],
        p3: ['Wooden play gym with faces', 'Fabric peekaboo book set', 'Floor mirror panel'] },
      avoid: [
        'Talking non-stop and never leaving a gap.',
        'Testing the smile for visitors on demand.',
        'Bright, loud toys used instead of your face.',
        'Screens “to make her smile”.',
        'Worrying if the smile appears a fortnight late — range is wide.'
      ],
      flags: [
        'No social smile at all by ten weeks.',
        'No eye contact during feeding.',
        'Very little facial movement at any time.',
        'Never quiets to a familiar voice.',
        'A clear loss of a smile that had already appeared.'
      ],
      sci: { p: 'The <strong>social smile</strong> — smiling in response to a face, rather than reflexively — typically appears between six and eight weeks and is one of the earliest signs of social reciprocity. The “serve and return” pattern it starts is the interaction style most consistently associated with later language and self-regulation.',
             t: 'Leave the gap. The gap is where your baby learns to take a turn.' },
      val: { q: 'The first smile is not a reward for good parenting. It is an invitation to a conversation.', v: 'Reciprocity',
             n: 'Notice who in your family waits for others to finish speaking. Be that person.' },
      card: ['Smile first, then wait 3 seconds', 'Copy one sound exactly', 'Greet with a smile each time', 'Dad earns his own smile', 'Photograph one real smile']
    },

    /* ---------------------------------------------------------------- 7 */
    {
      n: 7, emoji: '🔲', title: 'Tracking Light & Shapes',
      focus: 'High-contrast patterns and slow-moving objects.',
      meta: ['🔲 High contrast', '👀 Smooth tracking', '🐌 Slow movement'],
      goals: [
        'Stays calm and interested rather than overwhelmed by new sights.',
        'Follows an object past the midline of his body.',
        'Tracks a slow-moving object smoothly, not in jumps.',
        'Hears the object named every single time: “ball… ball… ball.”',
        'Watches an older sibling or cousin move around the room.'
      ],
      min: [
        'Move one high-contrast card slowly, side to side, for one minute.',
        'Hold objects about 25 cm away, no closer.',
        'Name whatever he is looking at, once.',
        'Two minutes near a window with moving shadows or leaves.'
      ],
      bet: [
        'Everything in Minimum.',
        'Track up and down as well as side to side.',
        'Swap the visual display near the changing table every few days.',
        'Let him watch you fold clothes, narrating as you go.',
        'Try black-and-white patterns and one red object.'
      ],
      bst: [
        'Everything in Better.',
        'Make a home “contrast gallery”: three cards at cot-side eye level.',
        'Ten minutes of slow tracking games, split into short bursts.',
        'Test which pattern holds attention longest and note it down.'
      ],
      mom: 'Look at one beautiful thing today that has nothing to do with the baby. A plant, a sky, a saree you like. Ten seconds counts.',
      dad: 'Make the contrast cards yourself — black marker, white card, bold shapes. Homemade beats bought here.',
      fam: 'Rotate who does the “window tour”, naming what is outside. Grandparents are excellent at this one.',
      bud: { b: '₹200–₹500', p: '₹1,400+',
        f: ['Hand-drawn black-and-white cards', 'A steel plate', 'Moving shadows on a wall'],
        m: ['Printed contrast card pack', 'Red wooden rattle', 'Contrast cloth book'],
        p3: ['Montessori visual mobile set', 'High-contrast board books', 'Play gym with hanging shapes'] },
      avoid: [
        'Fast, jerky movements — they break tracking.',
        'Flashing or light-up toys.',
        'Too many patterns at once; one at a time.',
        'Any screen, including “baby sensory” videos.',
        'Holding objects too close to the eyes.'
      ],
      flags: [
        'Eyes that never follow anything by eight weeks.',
        'One eye that consistently drifts while the other tracks.',
        'No reaction to a light being turned on in a dim room.',
        'Persistent, rapid, involuntary eye movement.',
        'Cloudiness in the pupil, or a white reflection in photos.'
      ],
      sci: { p: 'Newborn visual acuity is roughly <strong>20/400</strong> and improves rapidly across the first months. Low-frequency, high-contrast edges are the easiest stimuli for an immature visual system to resolve, which is why bold black-and-white patterns hold attention far better than pastel ones.',
             t: 'Bold and slow beats colourful and fast, every time.' },
      val: { q: 'Attention is a muscle. It is trained by things worth looking at.', v: 'Focus',
             n: 'One toy at a time, one task at a time. Model it now, mean it at fifteen.' },
      card: ['Slow side-to-side tracking', 'Hold objects 25 cm away', 'Name what he looks at', 'One pattern at a time', 'Window tour daily']
    },

    /* ---------------------------------------------------------------- 8 */
    {
      n: 8, emoji: '🤲', title: 'Hands Discover Hands',
      focus: 'Midline play: bringing both hands together.',
      meta: ['🤲 Midline', '✊ Open fists', '🧦 Body map'],
      goals: [
        'Comforts herself briefly by bringing hands to mouth.',
        'Hands are open more often than fisted.',
        'Discovers that those hands belong to her.',
        'Hears the names of body parts during dressing.',
        'Enjoys gentle hand-holding with a familiar adult.'
      ],
      min: [
        'Gently bring both hands together at her chest, five times.',
        'Say “hands” every time you do it.',
        'One minute of open-palm stroking, fingers to wrist.',
        'Dress her slowly, naming each limb.'
      ],
      bet: [
        'Everything in Minimum.',
        'Place a light cloth in her palm and let her grip it.',
        'Sing a hand rhyme daily — the same one all week.',
        'Two minutes of gentle baby massage on arms and hands.',
        'Let her feel three textures: cotton, wood, your hair.'
      ],
      bst: [
        'Everything in Better.',
        'Full ten-minute massage with warm hands after a bath.',
        'Hang a light object where a swipe might accidentally hit it.',
        'Photograph her hand in yours, same pose, once a month.'
      ],
      mom: 'Get a hand massage yourself, from your partner, for two minutes. Your hands have done everything this month.',
      dad: 'Own the massage. Learn it properly, do it four times this week, and become the person she relaxes for.',
      fam: 'One shared hand rhyme the whole family knows — a Hindi, Marathi, Tamil or Bengali one from your own childhood.',
      bud: { b: '₹200–₹700', p: '₹1,600+',
        f: ['Your hands', 'A soft cotton cloth', 'A family rhyme you already know'],
        m: ['Cold-pressed coconut or sesame oil', 'Wooden ring rattle', 'Textured cloth squares'],
        p3: ['Organic massage oil set', 'Wooden grasping toy set', 'Sensory texture book'] },
      avoid: [
        'Mittens all day — hands need to be felt and seen.',
        'Forcing fingers open.',
        'Strong mustard oil massage on very young skin without testing.',
        'Anything small enough to reach the mouth and choke.',
        'Massage on a hungry or very sleepy baby.'
      ],
      flags: [
        'Fists kept tightly clenched all day, every day.',
        'One arm that clearly moves less than the other.',
        'Hands that never come toward the middle of the body.',
        'Marked stiffness in the arms or shoulders.',
        'No response at all to touch on the palms.'
      ],
      sci: { p: 'Bringing the hands to the <strong>midline</strong> is a milestone in bilateral coordination and in body mapping — the infant’s dawning sense that these moving objects are part of “me”. Hand-to-mouth activity is also one of the earliest genuine self-soothing behaviours available to a baby.',
             t: 'Free hands, in view, most of the day. That is the whole intervention.' },
      val: { q: 'Before a child can hold anything else, they learn to hold themselves.', v: 'Self-soothing',
             n: 'Let her finish a small self-calm before you intervene. Two seconds of patience.' },
      card: ['Hands together, five times', 'Say “hands” each time', 'One hand rhyme daily', 'Two-minute massage', 'No mittens in awake time']
    },

    /* ---------------------------------------------------------------- 9 */
    {
      n: 9, emoji: '💬', title: 'Cooing Conversations',
      focus: 'Vowel sounds, and the all-important three-second pause.',
      meta: ['💬 Cooing', '⏳ Turn-taking', '🎵 Parentese'],
      goals: [
        'Feels heard — his sounds visibly change your face.',
        'Coordinates breath and voice for longer sounds.',
        'Learns that sound causes a response in another person.',
        'Produces repeated vowels: “aa-goo”, “eh-eh”.',
        'Coos with two different people, not just one.'
      ],
      min: [
        'Reply to every coo, out loud, as if it were a sentence.',
        'Wait three seconds after his sound before you answer.',
        'Copy one of his sounds exactly, then add one word.',
        'Two minutes of face-to-face “chat” daily.'
      ],
      bet: [
        'Everything in Minimum.',
        'Ten full turns in one conversation — his turn, your turn.',
        'Use parentese: higher pitch, slow, stretched vowels.',
        'Narrate one whole routine — bath or dressing — start to finish.',
        'Sing one song in your mother tongue every day.'
      ],
      bst: [
        'Everything in Better.',
        'Twenty minutes of talk across the day, in short bursts.',
        'Record 30 seconds of the conversation for the memory page.',
        'Try two languages in the same day; babies handle both easily.'
      ],
      mom: 'Talk to an adult, at length, about something other than the baby, once this week. Your mind needs its own turn.',
      dad: 'Own bath-time narration. Every step, out loud, in your own language. You are half his vocabulary.',
      fam: 'Whoever holds the baby, talks to the baby. Make that the house norm — silent holding is a missed opportunity.',
      bud: { b: '₹200–₹600', p: '₹1,500+',
        f: ['Your voice', 'Songs you already know', 'Three seconds of silence'],
        m: ['Rhyme board book', 'Simple cloth puppet', 'Soft rattle'],
        p3: ['Bilingual board-book set', 'Nursery-rhyme song collection', 'Fabric finger puppets'] },
      avoid: [
        'Filling every silence — the gap is the lesson.',
        'Correcting or “teaching” words at this age.',
        'Background TV, which measurably reduces adult–infant talk.',
        'Baby-talk that replaces real words entirely.',
        'Worrying about mixing languages. Mixing is fine.'
      ],
      flags: [
        'No vowel sounds at all by twelve weeks.',
        'No reaction to your voice when he cannot see you.',
        'Very little variation in facial expression.',
        'A clear loss of sounds he was already making.',
        'Never quiets or turns toward a familiar voice.'
      ],
      sci: { p: 'Adults who respond <strong>contingently</strong> — immediately after the infant vocalises, rather than talking over them — get more advanced, more speech-like babble in return within the same session. Infant-directed speech (“parentese”) also holds attention better and is linked to stronger later vocabulary.',
             t: 'The pause is the intervention. Wait three seconds, then answer.' },
      val: { q: 'Conversation is the first thing we teach, and the last thing we master.', v: 'Listening',
             n: 'This week, let one adult in your life finish a sentence uninterrupted.' },
      card: ['Reply to every coo', 'Wait three seconds', 'Copy his sound, add a word', 'Narrate bath time', 'One song in your language']
    },

    /* --------------------------------------------------------------- 10 */
    {
      n: 10, emoji: '🏋️', title: 'Head Control & Strength',
      focus: 'A steadier neck, longer tummy time, fewer wobbles.',
      meta: ['🏋️ Neck control', '🔄 Position variety', '🦵 Kicking'],
      goals: [
        'Enjoys being upright and seeing the room from your shoulder.',
        'Holds the head at 45° in tummy time for several seconds.',
        'Anticipates being lifted — braces slightly as you reach in.',
        'Grunts and vocalises with effort during physical play.',
        'Watches faces from an upright carrying position.'
      ],
      min: [
        'Three tummy-time sessions of about a minute each.',
        'Two minutes upright against your shoulder, no head support.',
        'Let her kick freely with the nappy off for a minute.',
        'Alternate the side you lay her down on.'
      ],
      bet: [
        'Everything in Minimum.',
        'Five minutes total floor tummy time.',
        'Slow “pull to sit” with full support, three times.',
        'Carry facing outward for short, calm periods.',
        'Place a mirror at floor level during tummy time.'
      ],
      bst: [
        'Everything in Better.',
        'Ten minutes total tummy time across the day.',
        'Airplane hold across your forearms, briefly.',
        'Film ten seconds and compare with week 4.'
      ],
      mom: 'Check your own posture. Feeding hunch is real. Two minutes of shoulder rolls and a doorway chest stretch, daily.',
      dad: 'Be the strength coach — tummy time, upright holds, airplane. Physical play is a genuine specialism. Take it.',
      fam: 'Ban the walker. Say it once, kindly, to everyone, before someone gifts one.',
      bud: { b: '₹400–₹1,000', p: '₹2,500+',
        f: ['Floor space', 'A rolled towel', 'Your forearms'],
        m: ['Play mat', 'Baby-safe mirror', 'Light wrist rattles'],
        p3: ['Wooden play gym', 'Large floor mirror panel', 'Padded activity mat'] },
      avoid: [
        'Baby walkers and jumpers — genuinely unsafe at any age.',
        'Long stretches in a bouncer or car seat at home.',
        'Propped sitting she cannot hold on her own.',
        'Pulling to sit by the hands with a lagging head.',
        'Skipping tummy time because she protests.'
      ],
      flags: [
        'Head still completely lagging in a supported pull-to-sit.',
        'No head lift at all in tummy time by twelve weeks.',
        'Persistent head tilt always to one side.',
        'A pronounced flat spot developing on the skull.',
        'Very stiff or very floppy limbs.'
      ],
      sci: { p: 'Head control develops <strong>cephalocaudally</strong> — from the head downward — and it is the foundation for sitting, reaching and eventually walking. Varied positioning across the day matters more than the length of any single session, and also reduces the risk of positional plagiocephaly.',
             t: 'Change her position often. Variety is the exercise programme.' },
      val: { q: 'Effort deserves a witness. Watch her try.', v: 'Effort',
             n: 'Praise the trying, not the achieving. Start the habit now; you will need it at exam time.' },
      card: ['3 × 1 minute tummy time', 'Two minutes upright', 'Nappy-free kicking', 'Alternate sides', 'No walkers, ever']
    },

    /* --------------------------------------------------------------- 11 */
    {
      n: 11, emoji: '🧶', title: 'Textures & Touch',
      focus: 'Cotton, wood, water, warm and cool — a guided touch tour.',
      meta: ['🧶 Texture', '💧 Water play', '🖐️ Tactile map'],
      goals: [
        'Stays regulated while experiencing something new.',
        'Grasps and holds a light object for a few seconds.',
        'Distinguishes between different surfaces on the skin.',
        'Hears texture words: soft, rough, cool, smooth.',
        'Explores textures in someone else’s lap too.'
      ],
      min: [
        'Three textures on the palms, named as you go.',
        'One minute of barefoot time on a different surface.',
        'Let him hold a light cloth and pull it.',
        'Warm and cool: a warm palm, then a cool spoon back.'
      ],
      bet: [
        'Everything in Minimum.',
        'Make a texture board: cotton, silk, jute, wool on card.',
        'Extend bath time by two minutes of splash play.',
        'Let him feel water running over his hand.',
        'Sensory walk around the house, naming five surfaces.'
      ],
      bst: [
        'Everything in Better.',
        'A full sensory basket of five safe household objects.',
        'Outdoor texture time: grass, leaf, warm stone — supervised.',
        'Note which texture he pulls away from and which he seeks.'
      ],
      mom: 'Take a bath, not a shower, once this week. Warm water is a legitimate medical intervention for a tired nervous system.',
      dad: 'Build the texture board with your own hands. Cardboard and fabric scraps. Twenty minutes, lasts months.',
      fam: 'Let grandparents lead this one — old cotton sarees, wooden spoons, brass tumblers. Their house is a sensory museum.',
      bud: { b: '₹200–₹600', p: '₹1,800+',
        f: ['Old cotton and silk scraps', 'A wooden spoon', 'A steel tumbler'],
        m: ['Texture cloth squares', 'Wooden teether', 'Silicone bath toys'],
        p3: ['Sensory texture book set', 'Wooden sensory basket', 'Natural-material toy set'] },
      avoid: [
        'Anything small enough to fit through a toilet-roll tube.',
        'Very hot or very cold objects on the skin.',
        'Glitter, loose beads or anything that sheds.',
        'Overloading with five textures at once — pause between each.',
        'Unsupervised water, at any depth, even for a second.'
      ],
      flags: [
        'Extreme distress at any and every touch.',
        'No reaction at all to temperature or texture change.',
        'A rash that spreads or blisters after contact.',
        'A hand he refuses to open or use.',
        'Skin that stays red and irritated for hours after contact.'
      ],
      sci: { p: 'Tactile input is the earliest-maturing sensory system, and gentle, varied touch is associated with better growth and calmer physiological regulation in infancy. Naming a sensation while the infant experiences it links <strong>perception to language</strong> long before the words themselves are understood.',
             t: 'Touch it, then name it. Both halves matter.' },
      val: { q: 'The world is learned first through the skin, and only later through the mind.', v: 'Curiosity',
             n: 'Let him take his time with one object. Rushing teaches skimming.' },
      card: ['Three textures, named', 'One minute barefoot', 'Warm hand, cool spoon', 'Two extra minutes in the bath', 'One outdoor texture']
    },

    /* --------------------------------------------------------------- 12 */
    {
      n: 12, emoji: '🔄', title: 'Rolling Intentions',
      focus: 'Side-lying play and the first deliberate twists.',
      meta: ['🔄 Side-lying', '🌀 Trunk rotation', '🛟 Floor safety'],
      goals: [
        'Handles the frustration of nearly-rolling without giving up.',
        'Rolls partway to the side, or fully, in one direction.',
        'Works out that turning changes what she can see.',
        'Uses effort sounds — grunts and squeals — during movement.',
        'Rolls toward a familiar face or voice.'
      ],
      min: [
        'Two minutes of side-lying play, propped with a rolled towel.',
        'Place a toy just out of reach to one side.',
        'Do it on both sides, equally.',
        'Cheer the attempt, not just the roll.'
      ],
      bet: [
        'Everything in Minimum.',
        'Five minutes of floor play with position changes every minute.',
        'Gently guide the hips through a roll so she feels the pattern.',
        'Move the interesting thing to alternating sides.',
        'Check the floor at her eye level for hazards.'
      ],
      bst: [
        'Everything in Better.',
        'Fifteen minutes of unrestricted floor time across the day.',
        'Set up a small safe “movement zone” that stays out all week.',
        'Note the date of the first full roll on the memory page.'
      ],
      mom: 'Re-check where you change her. Once rolling starts, the bed and the sofa become genuinely dangerous. Move to the floor.',
      dad: 'Do the safety sweep: cot bolts, changing surfaces, cords, gaps, plug points. One sweep, written checklist, done properly.',
      fam: 'Tell everyone, including helpers and grandparents: never leave her alone on a raised surface, not for one second.',
      bud: { b: '₹400–₹1,200', p: '₹3,000+',
        f: ['Floor space', 'A rolled towel', 'A steel bowl as a target'],
        m: ['Play mat', 'Light rolling ball', 'Cot mobile'],
        p3: ['Interlocking foam floor mats', 'Wooden rolling toy', 'Full baby-proofing kit'] },
      avoid: [
        'Leaving her unattended on a bed, sofa or changing table.',
        'Swaddling arms down once rolling begins.',
        'Cot bumpers and soft toys in the sleep space.',
        'Forcing a roll by pushing her over.',
        'Long periods strapped into any seat.'
      ],
      flags: [
        'No rolling at all by six months.',
        'Rolling only ever in one direction by six months.',
        'Using only one side of the body to move.',
        'Marked stiffness or a strong arch during movement.',
        'Loss of a movement skill she already had.'
      ],
      sci: { p: 'Rolling requires <strong>trunk rotation</strong> — the ability to turn the shoulders and hips separately — and it is usually the first independent change of location an infant achieves. Unrestricted floor time is the single strongest predictor of when it arrives; time in containers such as seats and bouncers reduces it.',
             t: 'The floor is the equipment. Everything else is optional.' },
      val: { q: 'Let her struggle for ten seconds longer than is comfortable for you.', v: 'Perseverance',
             n: 'Rescuing too early is the most loving way to slow a child down.' },
      card: ['Two minutes side-lying', 'Toy just out of reach', 'Both sides equally', 'Never alone on the bed', 'Cheer the attempt']
    },

    /* --------------------------------------------------------------- 13 */
    {
      n: 13, emoji: '🔔', title: 'Cause & Effect Play',
      focus: '“I kicked, and something happened.” The best discovery there is.',
      meta: ['🔔 Cause & effect', '🦵 Purposeful kicks', '🔁 Repetition'],
      goals: [
        'Delight — visible excitement when something works.',
        'Repeats a kick or swipe on purpose to make it happen again.',
        'Grasps that his own action produced the result.',
        'Vocalises in anticipation, before the effect arrives.',
        'Wants an audience for the trick he has discovered.'
      ],
      min: [
        'Hang one light object where a kick will reach it.',
        'React big, every single time — sound and face.',
        'Give him time to try again before you help.',
        'One round of “I press your nose, you make a sound”.'
      ],
      bet: [
        'Everything in Minimum.',
        'Tie a soft ribbon loosely from wrist to a light rattle.',
        'Play a stop–start song: sing, stop, wait for a response, resume.',
        'Crinkly paper under the feet during floor time.',
        'Count out loud how many times he repeats it.'
      ],
      bst: [
        'Everything in Better.',
        'Set up three different cause-and-effect stations.',
        'Fifteen minutes of independent play while you sit nearby, silent.',
        'Write down the first thing he clearly repeats on purpose.'
      ],
      mom: 'Notice one cause and effect in your own week: the thing you did that made today easier. Do that thing again tomorrow.',
      dad: 'Build the kick-station: a stick across two chairs, ribbons, a bell. Homemade, ten minutes, better than anything bought.',
      fam: 'Everyone reacts. A discovery with no audience gets abandoned; a discovery with an audience gets repeated a hundred times.',
      bud: { b: '₹300–₹800', p: '₹2,200+',
        f: ['Ribbon and a steel spoon', 'Crinkly paper', 'A bell from an old anklet'],
        m: ['Wrist and ankle rattles', 'Hanging cot toy', 'Crinkle cloth book'],
        p3: ['Wooden play gym with hangers', 'Musical kick piano', 'Montessori bell mobile'] },
      avoid: [
        'Battery toys that do everything for him.',
        'Helping before he has tried three times.',
        'Long strings or ribbons left unattended — strangulation risk.',
        'Changing the setup constantly; repetition is the point.',
        'Interrupting concentrated play to feed on a schedule.'
      ],
      flags: [
        'No interest in cause-and-effect play at all by five months.',
        'No visible reaction to sound or movement he creates.',
        'Never repeating an action deliberately by six months.',
        'Very few facial expressions during play.',
        'Loss of playfulness that was there before.'
      ],
      sci: { p: 'Classic infant learning studies show that babies as young as two to three months will increase a specific movement when it reliably produces an interesting effect — and will show frustration when the connection is broken. This is the earliest measurable form of <strong>agency</strong>: I act, therefore something happens.',
             t: 'Let the baby cause it. If you cause it for him, nothing is learned.' },
      val: { q: 'The first belief a child forms is “what I do matters”. Protect it.', v: 'Agency',
             n: 'Ask yourself each week: what did I do for him that he could have done himself?' },
      card: ['One kick-station set up', 'React big, every time', 'Wait before helping', 'Same setup all week', 'Let him repeat it endlessly']
    },

    /* --------------------------------------------------------------- 14 */
    {
      n: 14, emoji: '👶', title: 'Discovering Faces, Voices & Movement',
      featured: true,
      focus: 'Faces, turn-taking, and the beginnings of reaching.',
      meta: ['👀 Visual tracking', '🗣️ Turn-taking', '💪 Neck & core'],
      goals: [
        'Baby settles faster when they see or hear you — security through predictability.',
        'Holds head steady for 30+ seconds in tummy time; swipes at a dangling object.',
        'Tracks a slow-moving face or toy smoothly from one side to the other.',
        'Coos back in “conversation” — waits, then answers with a sound.',
        'Smiles at a familiar face on purpose, not just reflexively.'
      ],
      min: [
        'Hold baby 30 cm from your face and slowly say their name 3 times.',
        'One minute of tummy time on your chest.',
        'Pause after every coo — count to three before replying.',
        'Sing the same short song at the same daily moment.'
      ],
      bet: [
        'Everything in Minimum.',
        'Slow face-tracking: move your face left→right, 6 passes.',
        'Tummy time with an unbreakable mirror, 3–5 minutes.',
        'Narrate one routine out loud — “Now we pour the water…”',
        'Offer a light rattle to swipe at, held just within reach.'
      ],
      bst: [
        'Everything in Better, split across the day.',
        '10-minute “face gym”: peekaboo, tongue-out imitation, exaggerated expressions.',
        'Baby-wearing walk with live commentary on what you both see.',
        'Record a 30-second video of your “conversation” for the memory page.'
      ],
      mom: 'Ten uninterrupted minutes of face-to-face time, phone in another room. Then ten minutes that are only yours — tea, shower, sleep. Your calm is part of the curriculum.',
      dad: 'Own one full routine end-to-end this week — bath, change, settle — without being asked or corrected. Different hands, different voice, same safety.',
      fam: 'Create one 3-minute evening ritual everyone joins: lights low, one song, one sentence each about the day. Start it this week; keep it for years.',
      bud: { b: '₹200–₹600', p: '₹1,500+',
        f: ['Your own face — the best toy there is', 'A steel plate as a mirror', 'A dupatta for peekaboo'],
        m: ['High-contrast black-and-white cards', 'Soft wrist rattle', 'Cotton tummy-time mat'],
        p3: ['Shatterproof floor mirror', 'Wooden play gym with hangers', 'Ergonomic carrier for narrated walks'] },
      avoid: [
        'Screens of any kind, including “baby-safe” videos.',
        'Propping baby into a sitting position they can’t hold alone.',
        'Over-stimulating toys — flashing lights plus loud sound at once.',
        'Comparing your baby’s week to another baby’s week.',
        'Waking a sleeping baby to complete a mission. Sleep wins.'
      ],
      flags: [
        'No eye contact or social smile at all by 14 weeks.',
        'Head still flops completely with no control when supported.',
        'Doesn’t startle or turn toward loud, sudden sounds.',
        'Hands stay tightly fisted all day, every day.',
        'Marked loss of a skill they clearly had last month.'
      ],
      sci: { p: 'Around three to four months, infants shift from reflexive looking to <strong>voluntary visual tracking</strong>, and the “serve and return” rhythm of adult–infant babble becomes measurable. Studies of contingent responding — replying <em>right after</em> your baby vocalises, rather than talking over them — show richer babble and stronger later vocabulary.',
             t: 'The pause is the intervention. Wait three seconds, then answer.' },
      val: { q: 'A baby learns what the world is like from how quickly the world answers.', v: 'Responsiveness',
             n: 'Practise it with adults too — answer your partner the way you answer your baby.' },
      card: ['Face-to-face talking, daily', 'Tummy time + mirror', 'Wait 3 seconds, then reply', 'Same song, same time', 'One 3-minute family ritual']
    },

    /* --------------------------------------------------------------- 15 */
    {
      n: 15, emoji: '✋', title: 'Reaching & Grasping',
      focus: 'Aim, miss, aim again — motor planning in action.',
      meta: ['✋ Reaching', '🎯 Hand–eye', '🔁 Repeated attempts'],
      goals: [
        'Tolerates missing without immediately giving up.',
        'Reaches out and makes contact with a nearby object.',
        'Judges distance — the first true hand–eye calculation.',
        'Vocalises with effort and with success.',
        'Reaches toward faces and hair, not only toys.'
      ],
      min: [
        'Offer one toy at chest height and wait — don’t place it in the hand.',
        'Two minutes of reaching practice on the back.',
        'Offer to the left, then to the right.',
        'Let her hold and drop it, ten times, without comment.'
      ],
      bet: [
        'Everything in Minimum.',
        'Play gym or hanging toys for five minutes.',
        'Offer objects of three different weights.',
        'Reaching from side-lying — much harder, much better.',
        'Name the object each time she makes contact.'
      ],
      bst: [
        'Everything in Better.',
        'Fifteen minutes of reaching play in short bursts.',
        'Set an object slightly too far and let her problem-solve.',
        'Photograph the first proper grasp.'
      ],
      mom: 'Reach for something you want this week that has nothing to do with the baby. Book, call, class. Aim, miss, aim again.',
      dad: 'Own the play gym. Set it up, rotate what hangs on it, and be the one who notices what she is trying to reach.',
      fam: 'When she drops it, wait. Do not hand it back instantly. Everyone in the house needs this rule.',
      bud: { b: '₹300–₹900', p: '₹2,500+',
        f: ['A dupatta strung between two chairs', 'Steel spoons', 'A cloth ball you tie yourself'],
        m: ['Wooden ring rattles', 'Soft grasping ball', 'Cot play arch'],
        p3: ['Wooden play gym', 'Montessori grasping set', 'Silicone sensory ball set'] },
      avoid: [
        'Placing toys directly into the hand — that removes the learning.',
        'Heavy objects that can fall onto the face.',
        'Anything with small parts, strings or button batteries.',
        'Too many toys out at once.',
        'Interrupting a concentrated attempt.'
      ],
      flags: [
        'No reaching at all by five months.',
        'Always reaching with one hand and never the other.',
        'Cannot hold an object placed in the hand.',
        'Trembling or very jerky arm movements.',
        'No interest in objects at all.'
      ],
      sci: { p: 'Successful reaching requires the infant to predict where the hand will be, not just where it is — an early form of <strong>motor planning</strong>. Failed reaches are not wasted: the error signal is exactly what calibrates the system, which is why babies given more free reaching practice reach accurately sooner.',
             t: 'The misses are the practice. Do not shorten them.' },
      val: { q: 'Nobody ever learned to aim by having the target moved closer.', v: 'Resilience',
             n: 'The urge to make it easy is love. Resisting it is also love.' },
      card: ['Offer, then wait', 'Left side and right side', 'Let her drop it, ten times', 'Don’t hand it straight back', 'Name each object']
    },

    /* --------------------------------------------------------------- 16 */
    {
      n: 16, emoji: '🪞', title: 'Mirror Moments',
      focus: 'Meeting “that baby” in the mirror, every single day.',
      meta: ['🪞 Mirror play', '🙂 Self-image', '👨‍👩‍👦 Shared looking'],
      goals: [
        'Visible joy at the sight of the baby in the mirror.',
        'Pushes up higher in tummy time to see better.',
        'Begins connecting movement with the reflection.',
        'Vocalises at the reflection as if to another person.',
        'Enjoys seeing your face and his together in the frame.'
      ],
      min: [
        'Two minutes of mirror time daily.',
        'Name him: “That’s Aarav. Hello, Aarav.”',
        'Wave his hand and let him see it move.',
        'Hold your face beside his in the reflection.'
      ],
      bet: [
        'Everything in Minimum.',
        'Mirror propped at floor level during tummy time.',
        'Play peekaboo using the mirror.',
        'Name features: “eyes… nose… Papa’s nose.”',
        'Let him see himself in a spoon, a window, a screen that is off.'
      ],
      bst: [
        'Everything in Better.',
        'Ten minutes of mirror play across the day.',
        'A family mirror moment — three faces in one reflection.',
        'Photograph the reflection for the memory page.'
      ],
      mom: 'Look in the mirror and say one kind, true thing about yourself out loud. He is learning how people talk about their own bodies.',
      dad: 'Be in the mirror with him daily. Children learn what a family looks like from what they repeatedly see.',
      fam: 'Fix one safe mirror at baby height, permanently. It will earn its keep for three years.',
      bud: { b: '₹300–₹900', p: '₹2,800+',
        f: ['A steel thali', 'A switched-off phone screen', 'A wardrobe mirror at floor level'],
        m: ['Baby-safe acrylic mirror card', 'Cloth book with mirror page', 'Cot mirror'],
        p3: ['Wall-mounted shatterproof mirror panel', 'Montessori mirror with bar', 'Mirrored play cube'] },
      avoid: [
        'Glass mirrors that are not fixed and shatterproof.',
        'Long unsupervised mirror time.',
        'Any negative comment about anyone’s appearance nearby.',
        'Using a phone in selfie mode as the mirror.',
        'Mirror play just before sleep — it is stimulating.'
      ],
      flags: [
        'No interest at all in faces, including his own.',
        'No visual response to a large, close reflection.',
        'Very flat affect, no expression change during play.',
        'Consistently turning away from all social contact.',
        'Loss of interest in things he previously enjoyed.'
      ],
      sci: { p: 'True mirror self-recognition arrives much later — around eighteen months — but from about four months infants show clear <strong>interest and social behaviour</strong> toward the reflection, treating it as a partner. The stronger short-term benefit is postural: babies push up higher and stay in tummy time longer with a mirror in front of them.',
             t: 'The mirror is a tummy-time tool disguised as a toy.' },
      val: { q: 'How you speak about your own face teaches your child how to speak about theirs.', v: 'Self-respect',
             n: 'No commentary about weight, skin or size in front of him. Starting now.' },
      card: ['Two minutes mirror time', 'Say his name to the reflection', 'Mirror during tummy time', 'Both faces in the frame', 'One kind word about yourself']
    },

    /* --------------------------------------------------------------- 17 */
    {
      n: 17, emoji: '🎧', title: 'Sound Direction & Listening',
      focus: 'Turning toward voices, bells and rustles.',
      meta: ['🎧 Localising sound', '🔕 Quiet base', '🎵 Rhythm'],
      goals: [
        'Reassured by a familiar voice from across the room.',
        'Turns the head deliberately toward a sound source.',
        'Works out that sounds come from places.',
        'Responds differently to her own name than to other words.',
        'Recognises the voices of regular caregivers.'
      ],
      min: [
        'Call her name from one side, wait, then the other.',
        'One minute of listening to a soft rattle moved slowly.',
        'Keep one hour of the day genuinely quiet.',
        'Sing the same song from outside her line of sight.'
      ],
      bet: [
        'Everything in Minimum.',
        'Sound hunt: three different sounds from three directions.',
        'Clap a simple rhythm and pause for a reaction.',
        'Let her hear household sounds and name them.',
        'One song with actions, the same one all week.'
      ],
      bst: [
        'Everything in Better.',
        'Ten minutes of listening play across the day.',
        'Try loud/soft and fast/slow with the same instrument.',
        'Note which voice gets the fastest head turn.'
      ],
      mom: 'Fifteen minutes of your own music, in headphones, that is not a nursery rhyme. Your ears have listened to nothing but crying.',
      dad: 'Be the sound she finds. Call from another room daily until she turns toward you every time.',
      fam: 'One family song. Same one, every day, at the same moment. In ten years it will still mean something.',
      bud: { b: '₹200–₹700', p: '₹2,000+',
        f: ['Your voice', 'A steel tumbler and spoon', 'Rice in a sealed steel box'],
        m: ['Wooden maraca', 'Small hand bells', 'Rhyme board book'],
        p3: ['Wooden percussion set', 'Nursery-rhyme collection', 'Musical mobile'] },
      avoid: [
        'Loud, sudden noises for a reaction.',
        'Constant background music — it masks speech.',
        'Toys louder than a normal speaking voice.',
        'Headphones or earbuds on the baby.',
        'Testing hearing by startling her.'
      ],
      flags: [
        'No turning toward sound by five months.',
        'No startle to a sudden loud noise, at any age.',
        'Doesn’t quiet or brighten to a familiar voice.',
        'Persistent ear-pulling with fever or fussiness.',
        'Any hearing concern raised at birth that was never followed up.'
      ],
      sci: { p: 'Sound <strong>localisation</strong> improves sharply across the first six months as the auditory system learns to compare tiny timing differences between the two ears. Infants also show preferential responses to their own name from around four to five months — a first anchor for attention in a noisy world.',
             t: 'Use her name constantly. It is the first word she will know is hers.' },
      val: { q: 'A house that is never quiet raises a child who never listens.', v: 'Stillness',
             n: 'One quiet hour a day, for everyone. Screens off, voices low.' },
      card: ['Call her name from each side', 'One genuinely quiet hour', 'Three sounds, three directions', 'One family song daily', 'Use her name constantly']
    },

    /* --------------------------------------------------------------- 18 */
    {
      n: 18, emoji: '🪑', title: 'Sitting with Support',
      focus: 'Propped, cushioned, supervised — a whole new view of the world.',
      meta: ['🪑 Supported sitting', '🧘 Core strength', '👀 New viewpoint'],
      goals: [
        'Enjoys being part of the room rather than watching from below.',
        'Sits propped for 10–30 seconds with a straight-ish back.',
        'Sees the world from a new angle and studies it.',
        'Vocalises more when upright and facing people.',
        'Sits facing the family during a meal.'
      ],
      min: [
        'Two minutes sitting between your legs on the floor.',
        'Sit him on your lap facing outward during a conversation.',
        'Keep your hands ready — never walk away.',
        'Alternate sitting with plenty of floor time.'
      ],
      bet: [
        'Everything in Minimum.',
        'Five minutes of supported sitting with a cushion horseshoe.',
        'Place two toys at the edge of reach while sitting.',
        'Sitting practice on a firm surface, not a soft mattress.',
        'Let him be at table height for one family meal.'
      ],
      bst: [
        'Everything in Better.',
        'Ten minutes across the day, always supervised.',
        'Practise the controlled topple onto a cushion.',
        'Photograph the first unsupported few seconds.'
      ],
      mom: 'Sit down for one full meal with the family this week, with the baby in view but not in your lap. You are allowed to eat first.',
      dad: 'Be the human chair. Floor sitting with him between your legs, twice a day, while you talk to the room.',
      fam: 'Make space at the table now, physically. Where he sits at six months is where he will sit at six years.',
      bud: { b: '₹500–₹1,500', p: '₹4,000+',
        f: ['Your own legs', 'Firm cushions in a horseshoe', 'A folded quilt on the floor'],
        m: ['Nursing pillow as a prop', 'Firm floor mat', 'Small cotton bolsters'],
        p3: ['Adjustable high chair', 'Floor-seat with tray', 'Padded activity mat'] },
      avoid: [
        'Bumbo-style seats for long stretches.',
        'Propping on a bed or sofa where he can topple off.',
        'Leaving him propped and unattended, even briefly.',
        'Forcing an upright position he clearly resists.',
        'Replacing floor time with sitting practice.'
      ],
      flags: [
        'No sitting with support at all by seven months.',
        'A rounded back with no attempt to straighten.',
        'Always toppling to the same side.',
        'Very stiff legs that cross or scissor.',
        'Poor head control still, at this age.'
      ],
      sci: { p: 'Supported sitting develops <strong>trunk extensor strength</strong> and, just as importantly, changes what the infant can see and reach — sitting infants get far more visual access to objects and faces. This is why the onset of sitting is associated with a jump in object exploration and in shared attention with adults.',
             t: 'A new posture is a new curriculum. He is not just sitting; he is seeing.' },
      val: { q: 'Give a child a seat at the table long before they can hold a spoon.', v: 'Belonging',
             n: 'Include him in conversations he cannot yet follow. That is how belonging is built.' },
      card: ['Two minutes propped sitting', 'Sit between your legs', 'Hands always ready', 'One meal at family height', 'Floor time still comes first']
    },

    /* --------------------------------------------------------------- 19 */
    {
      n: 19, emoji: '🫣', title: 'Object Permanence Peek',
      focus: 'Peekaboo becomes genuinely, hilariously thrilling.',
      meta: ['🫣 Peekaboo', '🧠 Object permanence', '😂 Shared humour'],
      goals: [
        'Learns that gone does not mean gone forever — the root of separation confidence.',
        'Reaches to pull a cloth off a partly hidden toy.',
        'Begins expecting a hidden object to still exist.',
        'Laughs out loud — a real belly laugh.',
        'Plays the same game with several different people.'
      ],
      min: [
        'Five rounds of peekaboo with a dupatta.',
        'Hide a toy half under a cloth and let her find it.',
        'Say “all gone… back!” every time.',
        'Always announce yourself when you leave the room.'
      ],
      bet: [
        'Everything in Minimum.',
        'Hide the toy fully and wait before revealing.',
        'Peekaboo from behind a door, then a chair, then your hands.',
        'Let her hide your face with the cloth.',
        'Say goodbye properly instead of sneaking away.'
      ],
      bst: [
        'Everything in Better.',
        'Ten minutes of hide-and-find games across the day.',
        'Hide under two different cloths and let her choose.',
        'Record the first belly laugh.'
      ],
      mom: 'Leave the house for one hour without sneaking out. Say goodbye, go, come back. Practising the return is the point — for both of you.',
      dad: 'Own the goodbye ritual. Same words, same wave, every single time you leave for work.',
      fam: 'Nobody sneaks out. Ever. A vanishing grandparent is far more confusing than a sad thirty-second goodbye.',
      bud: { b: '₹200–₹600', p: '₹1,800+',
        f: ['A dupatta', 'Your hands', 'A steel bowl over a toy'],
        m: ['Lift-the-flap cloth book', 'Nesting cups', 'Fabric peekaboo toy'],
        p3: ['Wooden object-permanence box', 'Lift-the-flap board book set', 'Nesting and stacking set'] },
      avoid: [
        'Sneaking out to avoid tears.',
        'Hiding for too long before the reveal.',
        'Covering her face rather than yours.',
        'Playing when she is tired — it tips into distress fast.',
        'Making the game scary with a big startle.'
      ],
      flags: [
        'No interest in peekaboo at all by seven months.',
        'No laughing or smiling during social games.',
        'Never searching for a partly hidden object by eight months.',
        'No response when you leave or return.',
        'Loss of social engagement that was there before.'
      ],
      sci: { p: 'Partial <strong>object permanence</strong> emerges around four to eight months: infants will retrieve a partly covered object well before a fully covered one. Peekaboo is effective because it delivers a small, predictable violation of expectation followed by resolution — which is, structurally, exactly what a joke is.',
             t: 'Say goodbye every time. Predictable returns build separation confidence.' },
      val: { q: 'Children can handle goodbyes. What they cannot handle is disappearances.', v: 'Honesty',
             n: 'The small honesty of a goodbye is practice for the big honesties later.' },
      card: ['Five rounds of peekaboo', 'Hide a toy half under a cloth', 'Say “all gone… back!”', 'Always announce leaving', 'Never sneak out']
    },

    /* --------------------------------------------------------------- 20 */
    {
      n: 20, emoji: '🗣️', title: 'Babbling Begins',
      focus: 'Consonants arrive: ba, da, ma. Answer every single one.',
      meta: ['🗣️ Babble', '🔁 Repetition', '🌏 Two languages'],
      goals: [
        'Confidence that his voice gets a response every time.',
        'Coordinates lips and tongue for consonant sounds.',
        'Learns the sound patterns specific to your languages.',
        'Produces repeated syllables: “ba-ba”, “da-da”.',
        'Babbles at people, not only to himself.'
      ],
      min: [
        'Repeat his babble back, exactly, then add a word.',
        'Ten back-and-forth turns in one conversation.',
        'Read one book aloud daily, however short.',
        'Name every object you hand him.'
      ],
      bet: [
        'Everything in Minimum.',
        'Twenty minutes of talk split across the day.',
        'Exaggerate lip sounds so he can see your mouth: ba, pa, ma.',
        'Sing one song in each language you speak at home.',
        'Describe what you are doing during two full routines.'
      ],
      bst: [
        'Everything in Better.',
        'Thirty minutes of language-rich interaction across the day.',
        'Read the same book daily — repetition beats variety now.',
        'Record his babble and note the first consonant.'
      ],
      mom: 'Your mother tongue is not a disadvantage. Speak it fully, richly, without apology. Depth in one language builds depth in all of them.',
      dad: 'Read the bedtime book, every night this week. Fathers read differently, and children hear the difference.',
      fam: 'One language per person works beautifully. Grandmother in Marathi, father in English, mother in Hindi — no confusion, only richness.',
      bud: { b: '₹300–₹900', p: '₹2,500+',
        f: ['Your two languages', 'Songs from your own childhood', 'Anything you can name aloud'],
        m: ['Two board books', 'Cloth picture book', 'Rhyme collection'],
        p3: ['Bilingual board-book set', 'Indian folk-rhyme audio collection', 'Cloth story-book set'] },
      avoid: [
        'Any screen “to teach words” — it does not work at this age.',
        'Correcting his sounds.',
        'Dropping your mother tongue because of school worries.',
        'Talking mostly to other adults while holding him.',
        'Silence during nappy changes and baths — free vocabulary time.'
      ],
      flags: [
        'No babbling at all by seven months.',
        'No consonant sounds by nine months.',
        'A clear loss of babbling that had started.',
        'No response to his own name by seven months.',
        'No attempt to get your attention with sound.'
      ],
      sci: { p: 'Canonical babbling — repeated consonant–vowel syllables — typically begins between six and ten months and is one of the strongest early predictors of later language. Infants raised bilingually reach this milestone on the <strong>same schedule</strong> as monolingual infants; two languages do not delay speech.',
             t: 'Quantity and responsiveness of adult talk both matter. Talk more, and answer fast.' },
      val: { q: 'A language is not a subject. It is a doorway to everyone who came before you.', v: 'Roots',
             n: 'Teach him at least one song your grandmother sang. That is not nostalgia; it is inheritance.' },
      card: ['Repeat his babble exactly', 'Ten back-and-forth turns', 'One book aloud daily', 'One song per language', 'Name everything you hand him']
    },

    /* --------------------------------------------------------------- 21 */
    {
      n: 21, emoji: '🔁', title: 'Two-Hand Transfers',
      focus: 'Passing a toy from hand to hand, over and over.',
      meta: ['🔁 Transfer', '🤝 Bilateral skills', '🧠 Both hemispheres'],
      goals: [
        'Absorbed, contented solo play for a few minutes.',
        'Passes an object from one hand to the other deliberately.',
        'Both sides of the brain begin coordinating.',
        'Sounds of effort and satisfaction during manipulation.',
        'Offers an object toward you — the first hint of sharing.'
      ],
      min: [
        'Offer a toy to the middle so either hand can take it.',
        'Two minutes of watching her manipulate one object.',
        'Offer a second toy while the first is still held.',
        'Let her bring everything safe to her mouth.'
      ],
      bet: [
        'Everything in Minimum.',
        'Objects of three different shapes and weights.',
        'Hand her something, then hold out your palm and wait.',
        'Five minutes of uninterrupted independent play.',
        'A container to put things into and take out.'
      ],
      bst: [
        'Everything in Better.',
        'Fifteen minutes of independent play while you stay silent nearby.',
        'A treasure basket of six safe household objects.',
        'Note which hand she prefers today — it will keep changing.'
      ],
      mom: 'Fifteen minutes while she plays independently is yours. Sit down. Do not fold anything. That is the mission.',
      dad: 'Assemble the treasure basket — a wooden spoon, a steel katori, a pine cone, a silk scrap, a whisk, a brush. Nothing plastic.',
      fam: 'Learn to watch without interrupting. Narrating over concentrated play breaks it. Sit on your hands and enjoy it.',
      bud: { b: '₹300–₹900', p: '₹2,800+',
        f: ['Steel katoris', 'A wooden spoon', 'A clean cloth in a box'],
        m: ['Wooden blocks', 'Stacking cups', 'Silicone teething ring'],
        p3: ['Montessori treasure basket set', 'Wooden stacker', 'Natural-material sensory set'] },
      avoid: [
        'Anything that fits through a toilet-roll tube.',
        'Button batteries and magnets — genuine emergencies.',
        'Peeling paint or varnish on wooden items.',
        'Taking objects out of her mouth reflexively; check safety instead.',
        'Interrupting concentrated play to take a photo.'
      ],
      flags: [
        'No transferring between hands by eight months.',
        'A hand preference that is strong and fixed this early.',
        'Cannot hold an object for more than a moment.',
        'No mouthing of objects at all.',
        'One hand consistently held fisted or tucked in.'
      ],
      sci: { p: 'Hand-to-hand transfer is an early marker of <strong>bilateral coordination</strong>, reflecting growing communication between the two hemispheres. A strong, fixed hand preference before twelve months is unusual and is worth mentioning to a paediatrician; true handedness normally settles between two and four years.',
             t: 'Mouthing is exploration, not a bad habit. Make the objects safe, then let her.' },
      val: { q: 'A child deep in play is doing the most important work in the room.', v: 'Concentration',
             n: 'Protect other people’s concentration too. Nobody in this family gets interrupted for nothing.' },
      card: ['Offer toys to the middle', 'Second toy while holding the first', 'Five minutes uninterrupted play', 'A treasure basket, no plastic', 'Watch without narrating']
    },

    /* --------------------------------------------------------------- 22 */
    {
      n: 22, emoji: '🥄', title: 'Solids & Sensory Tasting',
      focus: 'First tastes, first mess, zero pressure.',
      meta: ['🥄 First tastes', '🍚 Iron-rich foods', '🙌 Self-feeding'],
      goals: [
        'Mealtimes feel calm and social, never a battle.',
        'Sits supported, opens the mouth, and manages a spoon.',
        'Discovers taste, temperature and texture as information.',
        'Hears food named in your language every time.',
        'Eats alongside the family, at the same time.'
      ],
      min: [
        'One new food at a time, three days before the next.',
        'Offer, never force. Refusal is data, not defiance.',
        'Name the food out loud every time.',
        'Let him touch the food with his hands.'
      ],
      bet: [
        'Everything in Minimum.',
        'Include one iron-rich food daily — ragi, dal, egg yolk, meat.',
        'Let him hold a preloaded spoon himself.',
        'Eat your own meal at the same time, at the same table.',
        'Offer plain water in an open cup — a few sips.'
      ],
      bst: [
        'Everything in Better.',
        'Two family meals a day with him included.',
        'Offer three textures in a week: purée, mash, soft finger food.',
        'Photograph the first proper face he pulls at a new taste.'
      ],
      mom: 'Milk is still the main meal at this age. Solids are practice. Nobody has failed if he eats two spoons and throws the third.',
      dad: 'Own one solid-food meal a day. Preparation, feeding and the clean-up. The whole thing, not the fun part.',
      fam: 'No force-feeding, no distraction feeding, no chasing around the house with a bowl. Agree this with every adult, including helpers.',
      bud: { b: '₹500–₹1,200', p: '₹3,500+',
        f: ['Mashed rice and dal', 'Ripe banana', 'A steel katori and spoon'],
        m: ['Silicone bib and spoon set', 'Steel tiffin bowls', 'Open training cup'],
        p3: ['High chair with tray', 'Silicone suction plate set', 'Steam-and-blend food maker'] },
      avoid: [
        'Salt and sugar before one year.',
        'Honey before one year — botulism risk.',
        'Whole nuts, grapes, popcorn and hard raw carrot — choking hazards.',
        'Feeding in front of a screen or while walking around.',
        'Comparing quantities eaten with any other child.'
      ],
      flags: [
        'Tongue pushing all food out, still, at seven months.',
        'Coughing, choking or turning blue with feeds.',
        'Rash, swelling or vomiting after a specific food.',
        'No weight gain over a month.',
        'Total refusal of all solids for several weeks.'
      ],
      sci: { p: 'Complementary feeding is usually recommended at <strong>around six months</strong>, when iron stores from birth begin to run low and the infant can sit supported and control the head. Repeated, pressure-free exposure — often eight to fifteen times — is what builds acceptance of a new taste; a first refusal predicts almost nothing.',
             t: 'You decide what and when. He decides whether and how much.' },
      val: { q: 'A family that eats together teaches more at the table than anywhere else.', v: 'Togetherness',
             n: 'One meal a day, everyone at the table, no phones. Start it now while it is easy.' },
      card: ['One new food at a time', 'Offer, never force', 'One iron-rich food daily', 'Let him touch the food', 'Family eats at the same time']
    },

    /* --------------------------------------------------------------- 23 */
    {
      n: 23, emoji: '🌀', title: 'Rolling Both Ways',
      focus: 'Back to front, front to back — and serious floor safety.',
      meta: ['🌀 Both directions', '🛡️ Baby-proofing', '🏃 Mobility begins'],
      goals: [
        'Confidence to move away from you, and back again.',
        'Rolls in both directions and may pivot on the tummy.',
        'Maps the room — realises places can be reached.',
        'Calls out to check you are still there.',
        'Moves toward people, not only toys.'
      ],
      min: [
        'Ten minutes of open floor time, nothing restricting her.',
        'Place a toy just beyond reach and wait.',
        'Full floor-level safety check at her eye height.',
        'Never leave her on a raised surface, not once.'
      ],
      bet: [
        'Everything in Minimum.',
        'Twenty minutes of floor time across the day.',
        'Create a small obstacle: a cushion to roll over.',
        'Move to a floor bed or lower the cot base.',
        'Cover plug points and secure trailing wires.'
      ],
      bst: [
        'Everything in Better.',
        'Forty-five minutes of floor time across the day.',
        'A properly baby-proofed “yes space” she cannot get hurt in.',
        'Note the date she first rolls both ways.'
      ],
      mom: 'The physical work changes now — more lifting, more chasing. Protect your back: bend the knees, and ask for help with the heavy things.',
      dad: 'Do the full baby-proofing audit: furniture anchored to the wall, cords tied, plug points covered, stair gates ordered. Written list, all of it done this week.',
      fam: 'Everyone learns the new rule: the floor is now her territory. No hot tea on low tables, no open doors to stairs or balconies.',
      bud: { b: '₹800–₹2,000', p: '₹5,000+',
        f: ['A cleared, swept floor', 'Cushions as obstacles', 'Furniture pushed back'],
        m: ['Plug-point covers', 'Corner guards', 'Foam floor mats'],
        p3: ['Full baby-proofing kit', 'Stair and doorway gates', 'Anti-tip furniture anchors'] },
      avoid: [
        'Any unsupervised time on a bed, sofa or changing table.',
        'Swaddling — it must be fully stopped by now.',
        'Walkers, jumpers and long spells in seats.',
        'Tablecloths that can be pulled down.',
        'Hot drinks anywhere within arm’s reach of the floor.'
      ],
      flags: [
        'No rolling in either direction by six to seven months.',
        'Movement using only one side of the body.',
        'Marked stiffness or floppiness.',
        'Loss of a movement skill she already had.',
        'No attempt to move toward anything she wants.'
      ],
      sci: { p: 'Independent mobility reorganises far more than motor skill: as infants begin to move themselves, measurable changes follow in <strong>spatial memory, distance perception and social referencing</strong> — they start checking a parent’s face before approaching something new.',
             t: 'Baby-proof this week, not next week. Mobility arrives without notice.' },
      val: { q: 'Freedom needs a fence. Build the fence, then let go inside it.', v: 'Safe freedom',
             n: 'Say “yes” far more often by designing a space where “no” is rarely needed.' },
      card: ['Ten minutes open floor time', 'Toy just beyond reach', 'Full floor safety check', 'Furniture anchored', 'Never alone on the bed']
    },

    /* --------------------------------------------------------------- 24 */
    {
      n: 24, emoji: '📛', title: 'Name Recognition',
      focus: 'Turning when called. Use the name generously.',
      meta: ['📛 His name', '🙋 Responding', '🎯 Joint attention'],
      goals: [
        'Feels recognised as a person, not just a baby.',
        'Turns the head and body toward his name.',
        'Separates his name from all other words.',
        'May respond with a sound when called.',
        'Responds to his name from several different people.'
      ],
      min: [
        'Use his actual name twenty times today, not a nickname.',
        'Call, wait three seconds, then respond warmly when he turns.',
        'Use his name at the start of a sentence, not the end.',
        'Never use his name as a warning or a scolding.'
      ],
      bet: [
        'Everything in Minimum.',
        'Call from three different distances and directions.',
        'Play the name game: pass him between two adults, each calling.',
        'Name everyone in the family out loud daily.',
        'Point at something and name it while he looks — joint attention.'
      ],
      bst: [
        'Everything in Better.',
        'Ten minutes of naming games across the day.',
        'A photo book of family faces, named each time.',
        'Note how quickly he turns, compared with last month.'
      ],
      mom: 'Ask people to use your name too. Six months of being called “baby’s mother” wears down a person. You are still you.',
      dad: 'Make the family face-book: printed photos, names written under each. Ten minutes with him daily. Grandparents will cry.',
      fam: 'Pick one name and stick to it for a few months. Fifteen affectionate nicknames are lovely for you and confusing for him.',
      bud: { b: '₹300–₹900', p: '₹2,500+',
        f: ['His name, said often', 'Printed photos', 'A cardboard folder'],
        m: ['Small photo album', 'Cloth family book', 'Board book of faces'],
        p3: ['Custom printed family photo book', 'Fabric photo album', 'Wooden name puzzle'] },
      avoid: [
        'Using his name only when he is in trouble.',
        'Constantly calling with no follow-up — the name stops meaning anything.',
        'Too many nicknames at once.',
        'Testing his response repeatedly for visitors.',
        'Assuming a problem if he ignores you while deeply focused.'
      ],
      flags: [
        'No response to his name by nine months.',
        'No response to any sound or voice.',
        'Rarely making eye contact when spoken to.',
        'A loss of social responsiveness he previously had.',
        'No babbling directed at people.'
      ],
      sci: { p: 'Reliable response to one’s own name typically appears between five and nine months and is a common early screening item, because it depends on hearing, attention <em>and</em> social motivation together. Persistent non-response by around nine to twelve months is one of the more useful early signals for a developmental conversation — <strong>not</strong> a diagnosis.',
             t: 'Call, wait, reward the turn. Every single time.' },
      val: { q: 'A name said with warmth a thousand times becomes a person who expects warmth.', v: 'Dignity',
             n: 'Never let his name become the sound of being in trouble.' },
      card: ['Use his real name 20 times', 'Call, wait, respond warmly', 'Name at the start of sentences', 'Never as a scolding', 'Name everyone in the family']
    },

    /* --------------------------------------------------------------- 25 */
    {
      n: 25, emoji: '🫂', title: 'Stranger Awareness & Trust',
      focus: 'Warm handovers to grandparents, helpers and visitors.',
      meta: ['🫂 Secure base', '👋 Slow handovers', '🛡️ Body autonomy'],
      goals: [
        'Uses you as a secure base — checks in, then explores.',
        'Turns and reaches toward you when uncertain.',
        'Distinguishes familiar people from unfamiliar ones.',
        'Uses sound and gesture to ask for you.',
        'Warms to a new person gradually, at her own pace.'
      ],
      min: [
        'Let her look at a new person from your arms first.',
        'Never hand her over while she is crying.',
        'Say who the person is: “This is Nani. Nani is safe.”',
        'Stay in view for the first few minutes of any handover.'
      ],
      bet: [
        'Everything in Minimum.',
        'A five-minute warm-up before any handover: the new person sits, ignores her, and waits.',
        'Practise short separations — two minutes, then return.',
        'Let her set the pace with grandparents.',
        'Same goodbye ritual every time.'
      ],
      bst: [
        'Everything in Better.',
        'Build a gradual comfort ladder with one regular caregiver.',
        'A twenty-minute separation with a familiar adult, then reunite warmly.',
        'Note who she settles with fastest and why.'
      ],
      mom: 'Stranger wariness is a sign of secure attachment, not bad manners. You do not owe anyone your child’s cuddle. Say no on her behalf.',
      dad: 'Be the buffer at family gatherings. You hold her, you manage the queue of relatives, you say “give her a minute” so mom does not have to.',
      fam: 'New house rule, said kindly and clearly: no picking up the baby without her looking ready. This is where body autonomy begins.',
      bud: { b: '₹200–₹800', p: '₹2,000+',
        f: ['A familiar cloth that smells of you', 'Time', 'A patient relative'],
        m: ['Comfort muslin', 'Soft washable toy', 'Photo of parents for the caregiver'],
        p3: ['Pair of comfort blankets', 'Fabric family photo book', 'Handmade attachment toy'] },
      avoid: [
        'Forcing her into anyone’s arms, including close family.',
        'Laughing at her fear or calling her shy.',
        'Sudden, unannounced separations.',
        'Handing her over while she is already crying.',
        'Shaming her for not going to a relative.'
      ],
      flags: [
        'No preference for familiar people at all by nine months.',
        'No distress or check-in when you leave, ever.',
        'Inconsolable for hours with any familiar caregiver.',
        'No eye contact or social smiling with anyone.',
        'A clear loss of social skills she already had.'
      ],
      sci: { p: 'Stranger wariness typically emerges between six and twelve months and is generally interpreted as <strong>evidence of a formed attachment</strong> — the infant now clearly distinguishes primary caregivers from others. Infants who can use a caregiver as a secure base tend to explore more, not less.',
             t: 'Fear of strangers is proof the attachment worked. Protect it; do not override it.' },
      val: { q: 'A child who is allowed to say no to a hug learns that their body is theirs.', v: 'Consent',
             n: 'The rule you set today at a family function is the rule she will carry at nineteen.' },
      card: ['Look first, from your arms', 'Never hand over a crying baby', 'Name the new person', 'Five-minute warm-up', 'No forced cuddles']
    },

    /* --------------------------------------------------------------- 26 */
    {
      n: 26, emoji: '🎉', title: 'Half-Year Milestone Review',
      focus: 'Look back at twenty-six weeks. Then plan the next one.',
      meta: ['🎉 Six months', '📊 Review', '🧭 Next stage'],
      goals: [
        'A settled, secure baby with clear preferred people.',
        'Rolls, sits with support, reaches and transfers objects.',
        'Explores deliberately and expects effects from actions.',
        'Babbles with consonants and responds to his name.',
        'Engages with several familiar people, plays social games.'
      ],
      min: [
        'Fill in the memory page properly, with today’s date.',
        'Rate all seven pillars honestly on the scorecard.',
        'Take one photograph in the same pose as week 1.',
        'Book the six-month paediatric check and vaccinations.'
      ],
      bet: [
        'Everything in Minimum.',
        'Look back at all 26 memory pages together as a couple.',
        'Pick the two pillars that scored lowest and plan next month around them.',
        'Write him a short letter about these six months.',
        'Clear out the toys and clothes he has outgrown.'
      ],
      bst: [
        'Everything in Better.',
        'Make a small six-month photo book from the year so far.',
        'Have an honest hour with your partner: what worked, what did not.',
        'Set three specific goals for weeks 27–52.'
      ],
      mom: 'Six months. Write down five things you did that nobody saw and nobody thanked you for. Then read the list back slowly.',
      dad: 'Do the same. Then read each other’s lists out loud. This is the most valuable twenty minutes in this entire book.',
      fam: 'A small celebration — not a party for Instagram. One meal, the people who actually helped, and a proper thank you to each of them.',
      bud: { b: '₹500–₹1,500', p: '₹4,000+',
        f: ['A handwritten letter', 'Photos already on your phone', 'One shared meal'],
        m: ['Printed photo set', 'A simple scrapbook', 'A milestone card set'],
        p3: ['Printed six-month photo book', 'Professional photo session', 'Keepsake hand and footprint kit'] },
      avoid: [
        'Comparing your scorecard with anyone else’s.',
        'Treating a low-scoring pillar as a failure — it is a plan.',
        'A milestone shoot that leaves everyone in tears.',
        'Skipping the six-month check-up because he “seems fine”.',
        'Buying a whole new stage of toys before decluttering.'
      ],
      flags: [
        'Not rolling in either direction.',
        'No babbling and no response to his name.',
        'No social smile, or no eye contact.',
        'Head control still poor when supported.',
        'Any skill clearly lost since the last months.'
      ],
      sci: { p: 'Six months is a standard <strong>surveillance point</strong> in most paediatric schedules — not because one milestone matters on its own, but because the overall pattern across motor, language, social and problem-solving domains is far more informative than any single item. Bring your notes; parent report is genuinely useful data.',
             t: 'Track the trajectory, not the date. Direction beats speed.' },
      val: { q: 'You will not remember the weeks. You will remember that you showed up for them.', v: 'Gratitude',
             n: 'Thank the people who fed you while you fed him. By name, out loud, this week.' },
      card: ['Fill the memory page', 'Rate all seven pillars', 'Same-pose photo as week 1', 'Book the six-month check', 'Write him a short letter']
    }
  ];


  /* ========================================================================
     04 · WEEK NAVIGATOR
     ======================================================================== */

  var track       = $('#weekTrack');
  var panel       = $('#weekPanel');
  var currentWeek = FEATURED_WEEK;

  function weekByNumber(n) {
    return WEEKS.filter(function (w) { return w.n === n; })[0];
  }

  function buildChips() {
    if (!track) { return; }
    var frag = document.createDocumentFragment();

    WEEKS.forEach(function (week) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'week-chip' + (week.featured ? ' is-featured' : '');
      chip.id = 'chip-' + week.n;
      chip.setAttribute('role', 'tab');
      chip.setAttribute('aria-controls', 'weekPanel');
      chip.setAttribute('aria-selected', week.n === currentWeek ? 'true' : 'false');
      chip.tabIndex = week.n === currentWeek ? 0 : -1;
      chip.dataset.week = String(week.n);
      chip.setAttribute('aria-label', 'Week ' + week.n + ': ' + week.title);
      chip.innerHTML =
        '<small>Week</small>' +
        '<strong>' + week.n + '</strong>' +
        '<span class="chip-dot" aria-hidden="true"></span>';
      frag.appendChild(chip);
    });

    track.appendChild(frag);
  }

  function selectWeek(n, opts) {
    opts = opts || {};
    var week = weekByNumber(n);
    if (!week) { return; }

    currentWeek = n;

    $$('.week-chip', track).forEach(function (chip) {
      var isActive = Number(chip.dataset.week) === n;
      chip.setAttribute('aria-selected', isActive ? 'true' : 'false');
      chip.tabIndex = isActive ? 0 : -1;
      if (isActive) { centreChip(chip); }
    });

    if (panel) { panel.setAttribute('aria-labelledby', 'chip-' + n); }

    renderWeek(week);

    if (opts.scrollIntoView && panel) {
      panel.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
    if (opts.focusPanel && panel) { panel.focus({ preventScroll: true }); }
  }

  /* Keep the active chip visible inside the horizontal scroller. */
  function centreChip(chip) {
    if (!track) { return; }
    var chipLeft  = chip.offsetLeft;
    var chipRight = chipLeft + chip.offsetWidth;
    var viewLeft  = track.scrollLeft;
    var viewRight = viewLeft + track.clientWidth;

    if (chipLeft < viewLeft + 24 || chipRight > viewRight - 24) {
      track.scrollTo({
        left: chipLeft - (track.clientWidth / 2) + (chip.offsetWidth / 2),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }
  }

  function bindNavigator() {
    if (!track) { return; }

    track.addEventListener('click', function (e) {
      var chip = e.target.closest('.week-chip');
      if (!chip) { return; }
      selectWeek(Number(chip.dataset.week), { scrollIntoView: true });
    });

    // Roving-tabindex keyboard support for the tablist
    track.addEventListener('keydown', function (e) {
      var keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
      if (keys.indexOf(e.key) === -1) { return; }
      e.preventDefault();

      var next = currentWeek;
      if (e.key === 'ArrowRight') { next = Math.min(WEEKS.length, currentWeek + 1); }
      if (e.key === 'ArrowLeft')  { next = Math.max(1, currentWeek - 1); }
      if (e.key === 'Home')       { next = 1; }
      if (e.key === 'End')        { next = WEEKS.length; }

      selectWeek(next);
      var chip = $('#chip-' + next);
      if (chip) { chip.focus(); }
    });

    // Arrow buttons either side of the scroller
    $$('.week-scroll').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = Number(btn.dataset.scroll) || 1;
        track.scrollBy({
          left: dir * Math.max(220, track.clientWidth * 0.7),
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
      });
    });
  }


  /* ========================================================================
     05 · WEEK CARD RENDERER
     ======================================================================== */

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  var GOAL_TAGS  = ['Emotional', 'Physical', 'Brain', 'Language', 'Social'];
  var GOAL_TONES = ['var(--terracotta)', 'var(--sage-deep)', 'var(--blue-deep)', 'var(--terracotta-deep)', 'var(--sage-deep)'];

  /* One checklist row with a session-persisted checkbox. */
  function checkRow(key, text) {
    return '<li><label>' +
             '<input type="checkbox" data-persist="' + key + '" />' +
             '<span class="cbx" aria-hidden="true"></span>' +
             '<span>' + esc(text) + '</span>' +
           '</label></li>';
  }

  function levelBlock(week, cls, badge, time, items, prefix) {
    return '<div class="level level--' + cls + '">' +
             '<header><span class="level-badge">' + badge + '</span>' +
             '<span class="level-time">' + time + '</span></header>' +
             '<ul class="checklist" role="list">' +
               items.map(function (t, i) {
                 return checkRow('w' + week.n + '-' + prefix + '-' + (i + 1), t);
               }).join('') +
             '</ul>' +
           '</div>';
  }

  function listItems(arr) {
    return arr.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
  }

  /* Full card — used for every week while UNLOCK_ALL is true. */
  function fullMarkup(week) {
    var w = week.n;

    var goals = week.goals.map(function (text, i) {
      return '<li class="goal" style="--goal:' + GOAL_TONES[i] + '">' +
               '<span class="goal-tag">' + GOAL_TAGS[i] + '</span>' +
               '<p>' + esc(text) + '</p>' +
             '</li>';
    }).join('');

    var metas = week.meta.map(function (m) {
      return '<span class="meta-pill">' + esc(m) + '</span>';
    }).join('');

    return '' +
    '<article class="week-card" id="week' + w + '" data-week="' + w + '">' +

      /* ---------- Header ---------- */
      '<header class="wc-header">' +
        '<div class="wc-header-top">' +
          '<span class="stage-badge">' + STAGE_1 + '</span>' +
          '<span class="week-number" aria-hidden="true">' + w + '</span>' +
        '</div>' +
        '<p class="wc-week-label">Week ' + w + '</p>' +
        '<h3 class="wc-title">“' + esc(week.title) + '”</h3>' +
        '<p class="wc-intro">' + esc(week.focus) + '</p>' +
        '<div class="wc-meta">' + metas + '</div>' +
      '</header>' +

      '<div class="wc-body">' +

        /* ---------- Goals ---------- */
        '<section class="wc-block" aria-labelledby="w' + w + '-goals">' +
          '<h4 class="block-title" id="w' + w + '-goals">' +
            '<span class="block-emoji" aria-hidden="true">🎯</span> This Week’s Goals</h4>' +
          '<ul class="goal-grid" role="list">' + goals + '</ul>' +
        '</section>' +

        /* ---------- Effort levels ---------- */
        '<section class="wc-block" aria-labelledby="w' + w + '-levels">' +
          '<h4 class="block-title" id="w' + w + '-levels">' +
            '<span class="block-emoji" aria-hidden="true">⏱️</span> Choose your week</h4>' +
          '<p class="block-sub">Some weeks you have thirty minutes. Some weeks you have five. Both count.</p>' +
          '<div class="levels">' +
            levelBlock(week, 'min',    'Minimum', '5 min/day',   week.min, 'min') +
            levelBlock(week, 'better', 'Better',  '15 min/day',  week.bet, 'bet') +
            levelBlock(week, 'best',   'Best',    '30+ min/day', week.bst, 'bst') +
          '</div>' +
        '</section>' +

        /* ---------- Role missions ---------- */
        '<section class="wc-block" aria-labelledby="w' + w + '-missions">' +
          '<h4 class="block-title" id="w' + w + '-missions">' +
            '<span class="block-emoji" aria-hidden="true">💌</span> This Week’s Missions</h4>' +
          '<div class="mission-grid">' +
            '<div class="mission mission--mom"><span class="mission-icon" aria-hidden="true">🌸</span>' +
              '<h5>Mom Mission</h5><p>' + esc(week.mom) + '</p></div>' +
            '<div class="mission mission--dad"><span class="mission-icon" aria-hidden="true">🧭</span>' +
              '<h5>Dad Mission</h5><p>' + esc(week.dad) + '</p></div>' +
            '<div class="mission mission--family"><span class="mission-icon" aria-hidden="true">🏡</span>' +
              '<h5>Family Mission</h5><p>' + esc(week.fam) + '</p></div>' +
          '</div>' +
        '</section>' +

        /* ---------- Budget ---------- */
        '<section class="wc-block" aria-labelledby="w' + w + '-budget">' +
          '<h4 class="block-title" id="w' + w + '-budget">' +
            '<span class="block-emoji" aria-hidden="true">🪙</span> Budget Options</h4>' +
          '<div class="budget-grid">' +
            '<div class="budget budget--free"><p class="budget-tier">Free</p>' +
              '<p class="budget-price">₹0</p><ul role="list">' + listItems(week.bud.f) + '</ul></div>' +
            '<div class="budget budget--mid"><p class="budget-tier">Budget</p>' +
              '<p class="budget-price">' + esc(week.bud.b) + '</p><ul role="list">' + listItems(week.bud.m) + '</ul></div>' +
            '<div class="budget budget--premium"><p class="budget-tier">Premium</p>' +
              '<p class="budget-price">' + esc(week.bud.p) + '</p><ul role="list">' + listItems(week.bud.p3) + '</ul></div>' +
          '</div>' +
          '<p class="budget-note">Nothing in the Budget or Premium column is required. Week ' + w + ' works perfectly at ₹0.</p>' +
        '</section>' +

        /* ---------- Avoid + Red flags ---------- */
        '<div class="warn-row">' +
          '<section class="warn warn--avoid" aria-labelledby="w' + w + '-avoid">' +
            '<h4 id="w' + w + '-avoid"><span aria-hidden="true">🚫</span> What to Avoid</h4>' +
            '<ul role="list">' + listItems(week.avoid) + '</ul>' +
          '</section>' +
          '<section class="warn warn--flags" aria-labelledby="w' + w + '-flags">' +
            '<h4 id="w' + w + '-flags"><span aria-hidden="true">⚠️</span> Red Flags</h4>' +
            '<p class="warn-lede">Mention these to your paediatrician — not a diagnosis, just a conversation starter.</p>' +
            '<ul role="list">' + listItems(week.flags) + '</ul>' +
          '</section>' +
        '</div>' +

        /* ---------- Science + Values ---------- */
        '<div class="insight-row">' +
          '<section class="science" aria-labelledby="w' + w + '-science">' +
            '<span class="evidence-badge"><span aria-hidden="true">🔬</span> Evidence-backed</span>' +
            '<h4 id="w' + w + '-science">Science Corner</h4>' +
            '<p>' + week.sci.p + '</p>' +
            '<p class="science-take"><strong>Take-away:</strong> ' + esc(week.sci.t) + '</p>' +
          '</section>' +
          '<section class="values" aria-labelledby="w' + w + '-values">' +
            '<h4 id="w' + w + '-values"><span aria-hidden="true">🕊️</span> Values Corner</h4>' +
            '<blockquote class="quote-box">' +
              '<p>“' + esc(week.val.q) + '”</p>' +
              '<footer>This week’s value: <strong>' + esc(week.val.v) + '</strong></footer>' +
            '</blockquote>' +
            '<p class="values-note">' + esc(week.val.n) + '</p>' +
          '</section>' +
        '</div>' +

        /* ---------- Scorecard ---------- */
        '<section class="wc-block" aria-labelledby="w' + w + '-score">' +
          '<h4 class="block-title" id="w' + w + '-score">' +
            '<span class="block-emoji" aria-hidden="true">📊</span> Parenting Scorecard</h4>' +
          '<p class="block-sub">Honest, not perfect. Tap the dots to rate how the week actually went — 0 to 5 per pillar.</p>' +
          '<div class="scorecard" id="scorecard"></div>' +
          '<p class="score-summary" id="scoreSummary" aria-live="polite">Week average: —</p>' +
        '</section>' +

        /* ---------- Memory page ---------- */
        '<section class="wc-block" aria-labelledby="w' + w + '-memory">' +
          '<h4 class="block-title" id="w' + w + '-memory">' +
            '<span class="block-emoji" aria-hidden="true">📔</span> Memory Page</h4>' +
          '<p class="block-sub">One minute now, priceless in ten years.</p>' +
          '<form class="memory-page" id="memoryPage" autocomplete="off" onsubmit="return false;">' +
            '<div class="mem-row">' +
              '<div class="field"><label for="memWeight">Weight</label>' +
                '<input id="memWeight" type="text" inputmode="decimal" placeholder="6.4 kg" data-persist="w' + w + '-mem-weight" /></div>' +
              '<div class="field"><label for="memHeight">Height</label>' +
                '<input id="memHeight" type="text" inputmode="decimal" placeholder="61 cm" data-persist="w' + w + '-mem-height" /></div>' +
            '</div>' +
            '<div class="field"><label for="memSmile">Cutest smile of the week</label>' +
              '<input id="memSmile" type="text" placeholder="When Papa came home and whistled…" data-persist="w' + w + '-mem-smile" /></div>' +
            '<div class="field"><label for="memSound">New sound</label>' +
              '<input id="memSound" type="text" placeholder="“aa-goo”, every morning" data-persist="w' + w + '-mem-sound" /></div>' +
            '<div class="field"><label for="memNotes">Notes to remember</label>' +
              '<textarea id="memNotes" rows="3" placeholder="What surprised you this week?" data-persist="w' + w + '-mem-notes"></textarea></div>' +
            '<p class="mem-hint" id="memHint">Saved for this browser session only — write it in the book to keep it forever.</p>' +
          '</form>' +
        '</section>' +

        /* ---------- Tear-off mission card ---------- */
        '<section class="wc-block" aria-labelledby="w' + w + '-mini">' +
          '<h4 class="block-title" id="w' + w + '-mini">' +
            '<span class="block-emoji" aria-hidden="true">✂️</span> Mission Card</h4>' +
          '<p class="block-sub">Tear here. Stick it on the fridge.</p>' +
          '<div class="detach-wrap">' +
            '<div class="perforation" aria-hidden="true"></div>' +
            '<div class="mission-card" id="missionCard">' +
              '<div class="mc-top">' +
                '<span class="mc-brand">Week by Week Parenting<sup>™</sup></span>' +
                '<span class="mc-week">Week ' + w + '</span>' +
              '</div>' +
              '<h5 class="mc-title">' + esc(week.title) + '</h5>' +
              '<p class="mc-stage">' + STAGE_1 + '</p>' +
              '<ul class="mc-checks" role="list">' +
                week.card.map(function (t, i) {
                  return checkRow('w' + w + '-mc-' + (i + 1), t);
                }).join('') +
              '</ul>' +
              '<div class="mc-foot">' +
                '<span class="mc-qr" aria-hidden="true">' + QR_SVG + '</span>' +
                '<p class="mc-foot-text">Scan for printables,<br />videos &amp; deeper notes.</p>' +
                '<button class="btn btn-ghost btn-sm" type="button" id="printCardBtn">🖨️ Print card</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

      '</div>' +
    '</article>';
  }

  /* Decorative QR placeholder, kept out of the template for readability. */
  var QR_SVG =
    '<svg viewBox="0 0 40 40" width="40" height="40"><rect width="40" height="40" rx="6" fill="#fff"/>' +
    '<g fill="var(--charcoal)"><rect x="4" y="4" width="10" height="10" rx="2"/><rect x="26" y="4" width="10" height="10" rx="2"/>' +
    '<rect x="4" y="26" width="10" height="10" rx="2"/><rect x="18" y="4" width="4" height="4"/><rect x="18" y="12" width="4" height="4"/>' +
    '<rect x="26" y="18" width="4" height="4"/><rect x="34" y="18" width="2" height="4"/><rect x="18" y="20" width="4" height="4"/>' +
    '<rect x="18" y="28" width="4" height="4"/><rect x="26" y="26" width="4" height="4"/><rect x="32" y="32" width="4" height="4"/>' +
    '<rect x="26" y="34" width="4" height="2"/></g>' +
    '<g fill="#fff"><rect x="7" y="7" width="4" height="4"/><rect x="29" y="7" width="4" height="4"/><rect x="7" y="29" width="4" height="4"/></g></svg>';

  /* Teaser card — used only when UNLOCK_ALL is false. */
  function previewMarkup(week) {
    var goals = week.goals.map(function (text, i) {
      return '<li><span class="pg-tag">' + GOAL_TAGS[i] + '</span><span>' + esc(text) + '</span></li>';
    }).join('');

    return '' +
    '<article class="week-card week-preview" data-week="' + week.n + '">' +
      '<header class="wc-header">' +
        '<div class="wc-header-top">' +
          '<span class="stage-badge">' + STAGE_1 + '</span>' +
          '<span class="week-number" aria-hidden="true">' + week.n + '</span>' +
        '</div>' +
        '<p class="wc-week-label">Week ' + week.n + '</p>' +
        '<h3 class="wc-title">' + week.emoji + ' “' + esc(week.title) + '”</h3>' +
        '<p class="wc-intro">' + esc(week.focus) + '</p>' +
      '</header>' +
      '<div class="wc-body">' +
        '<section class="wc-block">' +
          '<h4 class="block-title"><span class="block-emoji" aria-hidden="true">🎯</span> This Week’s Goals</h4>' +
          '<ul class="preview-goals" role="list">' + goals + '</ul>' +
        '</section>' +
        '<div class="locked-note">' +
          '<h4><span aria-hidden="true">📦</span> Full card in the book &amp; box</h4>' +
          '<p>Week ' + week.n + '’s complete card — the Minimum/Better/Best checklists, Mom, Dad and Family missions, ' +
            'budget options, red flags, Science Corner and printable wall card — ships in the Week by Week gift box ' +
            'and unlocks here with your QR code.</p>' +
          '<button class="btn btn-primary btn-sm" type="button" data-open-featured>See a complete card (Week ' + FEATURED_WEEK + ')</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderWeek(week) {
    if (!panel) { return; }

    var unlocked = UNLOCK_ALL || week.n === FEATURED_WEEK;
    panel.innerHTML = unlocked ? fullMarkup(week) : previewMarkup(week);

    // Re-wire everything inside the freshly rendered panel.
    hydratePersistence(panel);
    buildScorecard();
    bindPrintButton();
    observeReveals(panel);
  }

  // Delegated: teaser card's "see a complete card" button.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-open-featured]');
    if (!btn) { return; }
    selectWeek(FEATURED_WEEK, { scrollIntoView: true });
  });


  /* ========================================================================
     06 · SESSION PERSISTENCE
     Checkbox ticks and memory-page text survive navigation between weeks and
     page reloads within the same browser session (sessionStorage).
     ======================================================================== */

  function hydratePersistence(root) {
    $$('[data-persist]', root || document).forEach(function (el) {
      var key = PREFIX + el.dataset.persist;
      var saved = store.get(key);

      if (el.type === 'checkbox') {
        el.checked = (saved === '1');
        el.addEventListener('change', function () {
          store.set(key, el.checked ? '1' : '0');
          if (el.checked) { celebrate(el); }
        });
      } else {
        el.value = (saved !== null) ? saved : '';
        el.addEventListener('input', function () {
          store.set(key, el.value);
          flashSaved();
        });
      }
    });
  }

  /* A tiny, tasteful tick animation — skipped when motion is reduced. */
  function celebrate(input) {
    if (prefersReducedMotion) { return; }
    var box = input.nextElementSibling;
    if (!box || !box.classList.contains('cbx')) { return; }
    box.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1.06)' }],
      { duration: 260, easing: 'cubic-bezier(.34,1.32,.64,1)' }
    );
  }

  var savedTimer;
  function flashSaved() {
    var hint = $('#memHint');
    if (!hint) { return; }
    hint.textContent = '✓ Saved for this session';
    hint.classList.add('is-saved');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () {
      hint.textContent = 'Saved for this browser session only — write it in the book to keep it forever.';
      hint.classList.remove('is-saved');
    }, 2200);
  }


  /* ========================================================================
     07 · PARENTING SCORECARD
     Seven pillars, 0–5 each, empty by default, stored per week.
     ======================================================================== */

  var PILLARS = [
    { key: 'love',   emoji: '❤️',  label: 'Love & Emotional Security',      tone: 'var(--terracotta)' },
    { key: 'health', emoji: '🥦',  label: 'Health & Fitness',               tone: 'var(--sage)' },
    { key: 'brain',  emoji: '🧠',  label: 'Intelligence & Curiosity',       tone: 'var(--dusty-blue)' },
    { key: 'char',   emoji: '🛡️', label: 'Character & Values',             tone: 'var(--terracotta-deep)' },
    { key: 'conf',   emoji: '💬',  label: 'Confidence & Communication',     tone: 'var(--blue-deep)' },
    { key: 'indep',  emoji: '🧩',  label: 'Independence & Life Skills',     tone: 'var(--sage-deep)' },
    { key: 'family', emoji: '🏡',  label: 'Family Culture & Relationships', tone: 'var(--terracotta)' }
  ];

  var MAX_SCORE = 5;

  function scoreKey(pillar) { return PREFIX + 'score:w' + currentWeek + ':' + pillar; }

  function buildScorecard() {
    var host = $('#scorecard');
    if (!host) { return; }

    host.innerHTML = '';

    PILLARS.forEach(function (pillar) {
      var saved = parseInt(store.get(scoreKey(pillar.key)) || '0', 10) || 0;

      var row = document.createElement('div');
      row.className = 'score-row';
      row.dataset.pillar = pillar.key;

      var label = document.createElement('div');
      label.className = 'score-label';
      label.innerHTML = '<span class="sc-emoji" aria-hidden="true">' + pillar.emoji + '</span>' +
                        '<span>' + pillar.label + '</span>';

      var bar = document.createElement('div');
      bar.className = 'score-bar';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', pillar.label + ' score out of ' + MAX_SCORE);
      bar.style.setProperty('--tone', pillar.tone);

      for (var i = 1; i <= MAX_SCORE; i++) {
        var seg = document.createElement('button');
        seg.type = 'button';
        seg.className = 'score-seg';
        seg.dataset.value = String(i);
        seg.setAttribute('aria-pressed', 'false');
        seg.setAttribute('aria-label', 'Rate ' + pillar.label + ' ' + i + ' out of ' + MAX_SCORE);
        bar.appendChild(seg);
      }

      var value = document.createElement('div');
      value.className = 'score-value';
      value.textContent = '—';

      row.appendChild(label);
      row.appendChild(bar);
      row.appendChild(value);
      host.appendChild(row);

      paintRow(row, saved);
    });

    host.addEventListener('click', onScoreClick);
    updateScoreSummary();
  }

  function onScoreClick(e) {
    var seg = e.target.closest('.score-seg');
    if (!seg) { return; }
    var row = seg.closest('.score-row');
    var clicked = Number(seg.dataset.value);
    var current = Number(row.dataset.score || 0);

    // Clicking the current value again clears back to zero.
    var next = clicked === current ? 0 : clicked;

    paintRow(row, next);
    store.set(scoreKey(row.dataset.pillar), String(next));
    updateScoreSummary();
  }

  function paintRow(row, score) {
    row.dataset.score = String(score);
    $$('.score-seg', row).forEach(function (seg) {
      var on = Number(seg.dataset.value) <= score;
      seg.classList.toggle('is-on', on);
      seg.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var value = $('.score-value', row);
    if (value) { value.textContent = score ? score + '/' + MAX_SCORE : '—'; }
  }

  function updateScoreSummary() {
    var out  = $('#scoreSummary');
    var host = $('#scorecard');
    if (!out || !host) { return; }

    var rows  = $$('.score-row', host);
    var rated = rows.filter(function (r) { return Number(r.dataset.score) > 0; });

    if (!rated.length) {
      out.textContent = 'Week average: — (tap the dots to rate your week)';
      return;
    }

    var total = rated.reduce(function (sum, r) { return sum + Number(r.dataset.score); }, 0);
    var avg = (total / rated.length).toFixed(1);
    out.textContent = 'Week average: ' + avg + '/' + MAX_SCORE +
                      ' across ' + rated.length + ' of ' + rows.length + ' pillars · ' + encouragement(avg);
  }

  function encouragement(avg) {
    var a = parseFloat(avg);
    if (a >= 4.5) { return 'A remarkable week — rest into it.'; }
    if (a >= 3.5) { return 'Strong and steady. Keep going.'; }
    if (a >= 2.5) { return 'Good enough is genuinely good enough.'; }
    return 'Hard weeks count too. You showed up.';
  }


  /* ========================================================================
     08 · REVEAL ON SCROLL
     ======================================================================== */

  var revealObserver = null;

  function initReveals() {
    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      $$('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    observeReveals(document);
  }

  function observeReveals(root) {
    var nodes = $$('.reveal', root);
    if (!revealObserver) {
      nodes.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    nodes.forEach(function (el) {
      if (!el.classList.contains('is-visible')) { revealObserver.observe(el); }
    });
  }


  /* ========================================================================
     09 · HEADER · MOBILE NAV · SMOOTH SCROLL · PRINT
     ======================================================================== */

  function initHeader() {
    var header = $('#siteHeader');
    if (!header) { return; }
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initMobileNav() {
    var toggle = $('#navToggle');
    var nav = $('#mobileNav');
    if (!toggle || !nav) { return; }

    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav.hidden = !open;
    };

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { setOpen(false); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* Links carrying data-week-jump open that week and scroll to the panel. */
  function initWeekJumps() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-week-jump]');
      if (!link) { return; }
      e.preventDefault();
      selectWeek(Number(link.dataset.weekJump), { scrollIntoView: true, focusPanel: true });
    });
  }

  /* Print only the tear-off mission card. */
  function bindPrintButton() {
    var btn = $('#printCardBtn');
    if (!btn || btn.dataset.bound === '1') { return; }
    btn.dataset.bound = '1';

    btn.addEventListener('click', function () {
      document.body.classList.add('print-card-only');
      window.print();
    });
  }

  window.addEventListener('afterprint', function () {
    document.body.classList.remove('print-card-only');
  });

  function initYear() {
    var el = $('#year');
    if (el) { el.textContent = String(new Date().getFullYear()); }
  }

  /* Hide the promotional banner automatically if weeks get re-locked. */
  function initUnlockBanner() {
    var banner = $('#unlockBanner');
    if (banner && !UNLOCK_ALL) { banner.hidden = true; }
  }


  /* ========================================================================
     BOOT
     ======================================================================== */

  function init() {
    buildChips();
    bindNavigator();
    initUnlockBanner();

    // Render the featured week from data so every card comes from one source.
    renderWeek(weekByNumber(FEATURED_WEEK));

    initReveals();
    initHeader();
    initMobileNav();
    initWeekJumps();
    initYear();

    var chip = $('#chip-' + FEATURED_WEEK);
    if (chip) { centreChip(chip); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
