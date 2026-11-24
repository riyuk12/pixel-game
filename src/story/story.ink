// The story is written in ink (https://www.inklestudios.com/ink/).
// Edit it in the free Inky editor or any text editor; the game compiles it at startup.
//   NAME: text    -> spoken line, shown with that character's portrait
//   plain text    -> narration
//   # tag         -> event the game reacts to (see the `tags` table in src/main.ts)
// Every knot named after a point of interest in src/world/banarasMap.ts becomes
// something the player can inspect with E when standing near it.

VAR shrine_lit = false
VAR met_lamplighter = false

=== arrival ===
Your boat bumps against the bottom step of Kashi just as the evening aarti begins.
Bells. Conch shells. Five flames rise over the river at once.
-> END

// --- The riverfront -----------------------------------------------------------------------

=== aarti ===
Five priests lift the tiered brass lamps in unison. The flames trace slow circles over the dark water; smoke and marigold hang in the air.
* [Fold your hands.]
    You fold your hands. For a moment the whole ghat breathes together.
* [Watch the river instead.]
    On the water, a thousand leaf-cup diyas drift away from the light, as if they know where they are going.
- -> END

=== aartiCrowd ===
Pilgrims crowd every step — grandmothers in white, boatmen, children selling flowers. No one is looking at you, and you are glad of it.
-> END

=== dhobi ===
Thwack. Thwack. The washermen beat saris against the stone slabs, and the river carries the soap away.
-> END

=== sadhus ===
Two sadhus sit under a bamboo umbrella, ash-grey and still. One opens an eye, looks at you, and closes it again, satisfied.
-> END

// --- Up into the city -----------------------------------------------------------------------

=== flowers ===
Marigolds, roses, jasmine — heaped so high the sellers disappear behind them.
"For the river, for the gods, for your mother," one calls. "Ten rupees, any of them."
-> END

=== chai ===
The chai wallah pours from shoulder height without spilling a drop and hands you a clay cup. It is too sweet and exactly right.
-> END

=== riverView ===
From the top of the stairs the whole ghat opens below you: the aarti fires, the crowd, the river turning violet as the sun goes.
-> END

=== spireView ===
Far up the lane, past the awnings and the crowd, the old temple spire catches the last of the light.
-> END

=== bazaar ===
Turmeric, chilli, cardamom. Brass pots stacked like hills. A bolt of Banarasi silk unrolls for you and the shopkeeper is already naming a price.
-> END

=== danceOpening ===
Between two stalls, a narrow opening — and through it, lamplight and the ring of ankle bells. Someone is dancing.
-> END

=== dance ===
The Kathak dancer spins until her skirt becomes a wheel of red and gold. The tabla quickens; the bells answer every beat.
-> END

=== danceJali ===
Through the carved jali you see the courtyard from above: the dancer turning, the audience still as statues.
-> END

=== lampJali ===
The lane ends at a carved stone screen. Through it pours light — not one lamp but thousands, and smoke, and a low murmuring chant.
There must be a way in.
-> END

// --- The Courtyard of Lamps -----------------------------------------------------------------

=== lampsGathering ===
Every step of the stepwell holds a lamp, and every lamp has someone sitting beside it. The smoke is so thick the far side of the well is only a glow.
-> END

=== lampGallery ===
Above, in the arcaded gallery, voices chant a verse you almost recognise.
-> END

=== banyan ===
The banyan is older than the well. Its roots hang down the terraces and drink from the black water.
-> END

=== lampShrine ===
{ shrine_lit:
    The island shrine blazes now. Its light reaches every corner of the well.
- else:
    On the island in the middle of the pool sits a tiny shrine. Its lamp is the only dark one in the whole courtyard.
}
-> END

=== lamplighter ===
{ shrine_lit: -> after }
{ met_lamplighter: -> again }
~ met_lamplighter = true
An old man in a maroon turban sits on the top tier, a brass lamp cold in his lap.
LAMPLIGHTER: You came through the lane with the screen. Most people only look and leave.
* [Why is the island lamp dark?]
    LAMPLIGHTER: Because no one can reach it. The pool is deeper than it looks, and the flame must be carried, not thrown.
* [Who are all these people?]
    LAMPLIGHTER: Pilgrims. Widows. Musicians. Thieves, some of them. Tonight they are all the same — they are waiting.
- LAMPLIGHTER: Every lamp in Kashi is lit tonight, save one. Forty years I have tried to carry a flame across that water.
-> offer

= again
LAMPLIGHTER: Still here? Then perhaps you are the one.
-> offer

= offer
* [Give me the lamp.]
    He places the brass lamp in your hands. It is warm, though it is not lit.
    You touch it to the nearest diya, and walk down the tiers to the water's edge. The flame does not waver.
    You hold it out over the black water — and the island lamp catches on its own. # light_shrine
    ~ shrine_lit = true
    LAMPLIGHTER: ...Forty years.
    LAMPLIGHTER: Go up to the old temple, traveller. Someone there has been waiting longer than I have.
* [Not yet.]
    LAMPLIGHTER: Not yet. It has waited this long.
- -> END

= after
LAMPLIGHTER: Listen. Even the chanting has changed.
LAMPLIGHTER: The old temple, at the top of the city. Go.
-> END

// --- Around the lanes ----------------------------------------------------------------------

=== well ===
Two women draw water and argue cheerfully about a wedding. They stop to look you up and down, then carry on.
-> END

=== sweets ===
Jalebis spiral into the hot oil and come out orange and glistening. The halwai offers you one off the tip of his ladle.
-> END

=== weaving ===
Clack — clack — clack. The looms are weaving silk shot through with gold. A pattern of tiny lamps is growing on one of them.
-> END

=== bells ===
At the end of the lane hangs a small shrine with dozens of brass bells. You ring one. The sound goes on far longer than it should.
-> END

=== niche ===
A shrine niche no bigger than a cupboard, red with vermilion, one flame burning.
-> END

=== cow ===
The cow regards you with great calm and does not move. You will have to go around.
-> END

=== kites ===
Paper kites dry on strings across the lane, waiting for tomorrow's wind.
-> END

=== brass ===
Hammers ring on brass. A boy holds up a finished lamp for you to admire — it looks exactly like the lamplighter's.
-> END

=== dyers ===
Indigo, madder, turmeric — long strips of dyed cloth drip overhead and turn the lane blue and red.
-> END

// --- The end of the slice ------------------------------------------------------------------

=== temple ===
{ shrine_lit:
    The temple doors stand open. Inside, beneath the spire, a single priest looks up as if he has been expecting you.
    "So the island lamp is lit," he says. "Then the story can begin."
    (End of the vertical slice — thank you for playing.)
- else:
    The old temple's doors are shut. Bells sway in the warm wind. Somewhere below, one lamp is still dark.
}
-> END
