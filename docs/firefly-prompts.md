# Adobe Firefly Prompts - JJAN Fighter Roster

Use these prompts to generate IP-cleared replacement sprites for the six
fighters. Do not reference existing anime, manga, game, comic, movie, or brand
characters in the prompt, negative prompt, filename, metadata, or commit text.

## Workflow

1. Open Firefly -> Text to Image.
2. Aspect ratio: Portrait (9:16).
3. Content type: Art.
4. Paste the style anchor below, then one fighter prompt.
5. Generate four variants and pick the least derivative silhouette.
6. Export PNG, remove the background, and save to `web/public/fighters/<id>/idle.png`.
7. Keep the prompt and source export in the art log for provenance.

## Current Roster Retouch Direction

For the existing playable PNG roster, do not replace the characters wholesale.
Preserve the face, pose, proportions, expression, and readable combat
silhouette. Korean identity should come from controlled surface treatment:
hanbok-inspired cloth color, bojagi-style textile grids, dancheong accent
colors, small maedeup/norigae knots, cloud/wave/stone embroidery, and restrained
trim. Avoid turning the fighters into historical costume mascots; they should
still read as arcade battle characters first.

## Style Anchor

```text
original chibi arcade martial artist for a Korean ki mind-game,
full-body stance facing right, crisp cel-shaded illustration, compact readable
silhouette, bold clean line art, expressive eyes, saturated but balanced colors,
subtle talisman and festival-fight details, isolated on a perfectly plain
background, no watermark, no text, no existing franchise resemblance
```

## Avoid List

```text
no orange martial arts gi with blue sash, no orange ninja jumpsuit, no forehead
metal headband, no white captain coat, no sword-captain silhouette, no alien
armor, no spiky blond super form, no copyrighted character likeness, no logo,
no emblem from an existing franchise
```

## 1. Haneul (`haneul`) - Sky Ward

```text
quiet Korean sky-ward duelist, short black parted hair with small blue wind
streaks, teal-blue wrap jacket with cloud-knot trim, navy loose training pants,
paper talisman tied to one wrist, calm focused eyes, low defensive palm stance,
wind swirl motifs around the sleeves
```

## 2. Bora (`bora`) - Violet Seer

```text
violet seer fighter, swept deep-purple hair tied with a small charm cord,
layered plum and indigo ceremonial streetwear, folded paper fan tucked at the
waist, pale violet sash, sharp analytical expression, angled feinting stance,
small abstract star-charm details with no recognizable symbols
```

## 3. Taeyang (`taeyang`) - Solar Drum

```text
solar street brawler, dark brown tied-back hair with warm gold highlights,
deep red sleeveless training jacket, yellow rope sash, black cropped pants,
festival drum bead bracelet, confident grin, forward boxing stance with one
shoulder lowered, sunburst stitching on the cuffs only
```

## 4. Danbi (`danbi`) - Rain Caller

```text
rain caller duelist, slate hair in soft parted bangs with cyan tips, teal rain
capelet over dark training clothes, ribboned sleeves shaped like flowing water,
small droplet earring, patient serious expression, open-palm water-step guard,
rounded rain motifs without weapons
```

## 5. Seokjin (`seokjin`) - Stone Warden

```text
stone warden master, topknot, thick beard, earth-brown robe with stone-gray
trim, weighted cloth belt, broad compact stance, stern grounded expression,
hands held close to the chest like a mountain guard, square stone-knot patterns
on the hem
```

## 6. Yuri (`yuri`) - Glass Dancer

```text
glass dancer fighter, long rose-black hair with one side braid, dark plum stage
combat outfit with rose-gold glass shard trim, asymmetric sleeve, poised
counter-stance, cool half-smile, abstract mirror-fragment motifs around the
waist and cuffs
```

## Pose Variants

Append one of these only after the idle pose is approved:

- `windup`: gathering ki at the hands, cloth and charm details lifting from energy
- `impact`: palm or fist extended, burst trail moving forward
- `hit`: recoiling backward, clothing pulled by impact
- `ko`: collapsed in a readable but non-violent defeated pose
- `victory`: confident standing pose, aura settling around the fighter

## Shipping Checklist

- The sprite is recognizable as this game's character without resembling a
  famous third-party character.
- Hair, outfit, accessory, colors, and silhouette do not recreate a known
  franchise combination.
- The asset has transparent background and consistent 512 x 910 framing.
- The generation prompt and tool are recorded for provenance.
