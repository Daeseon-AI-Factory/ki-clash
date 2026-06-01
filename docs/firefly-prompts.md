# Adobe Firefly Prompts — Ki Clash Fighter Roster

Copy-paste prompts to generate the 6 character sprites at the same artistic style.

## Workflow

1. Open Firefly → **Text to Image**
2. **Aspect ratio**: Portrait (9:16) or Square (will crop later)
3. **Content type**: Art
4. **Style**: paste the **STYLE ANCHOR** below into the Style field (or append to prompt)
5. **Visual intensity**: 7-9
6. Paste a per-character prompt below
7. Generate 4 variants → pick the best
8. Export PNG → trim transparent background in Photoshop or [remove.bg](https://www.remove.bg)
9. Save to `web/public/fighters/<id>/idle.png`

## Style Anchor (same for all 6 — keeps consistency)

```
stylized chibi anime martial artist, modern cel-shaded illustration,
dynamic full-body kung-fu fighting stance facing right, vibrant saturated
colors, clean bold line art, soft rim lighting, isolated character on
plain white background, no shadow on ground, anime sprite style
```

---

## 1. Haneul (id: `haneul`) — Goku-vibe calm monk

```
chibi anime martial artist, spiky black hair with bright blue tips swept
upward, wearing orange martial arts gi with deep blue sash belt,
white wristbands, calm focused half-closed eyes, small blue dot on forehead,
fingerless leather gloves, classic kung-fu fighting stance, one fist forward
one cocked at hip
```

**Reference vibe:** Goku in his Master Roshi training gi era. Calm strength.

---

## 2. Bora (id: `bora`) — Trunks-vibe purple mystic

```
chibi anime warrior, long sweeping lavender purple hair covering the left
eye, wearing dark indigo undersuit with white armor chest plate trimmed
in silver, high collar, mysterious serious expression, small crescent moon
emblem on forehead, fingerless gauntlets, ready combat stance
```

**Reference vibe:** Future Trunks before the sword reveal. Mysterious noble.

---

## 3. Taeyang (id: `taeyang`) — Naruto-vibe golden brash

```
chibi anime ninja-warrior, bright spiky blond hair pointing in all directions,
wearing bright orange jumpsuit with dark navy accents at shoulders and
collar, dark blue forehead headband with a polished silver metal plate,
big confident grin showing teeth, fierce bright blue eyes, energetic
forward-leaning fighting stance, fists raised
```

**Reference vibe:** Naruto in his pre-Shippuden orange jumpsuit. Loud and brash.

---

## 4. Danbi (id: `danbi`) — Hitsugaya-vibe silver captain

```
chibi anime swordsman, spiky silver-white frosted hair with cyan tips,
wearing white inner kimono robe under a teal-cyan captain's haori long coat
with dark trim, calm intense turquoise eyes, single cyan water-drop earring
on left ear, traditional Japanese martial arts stance, palms open
```

**Reference vibe:** Toshiro Hitsugaya as Bleach 10th squad captain. Cool and composed.

---

## 5. Seokjin (id: `seokjin`) — old master strongman

```
chibi anime old martial arts master, dark brown hair pulled into a topknot
bun on top of head, thick black beard, wearing earth-orange martial arts
robe with gold trim, dark sash belt, broad shoulders muscular build, stern
wise expression with focused brown eyes, grounded wide horse stance, palms
pressed together at chest
```

**Reference vibe:** Master Roshi crossed with a sumo master. Heavy and grounded.

---

## 6. Yuri (id: `yuri`) — Boa Hancock-vibe elegant queen

```
chibi anime warrior queen, very long flowing straight pink hair past waist,
wearing dark wine red form-fitted elegant battle outfit with soft pink
trim accents, pink diamond hair clip on side, half-lidded condescending
smug expression with pink lips, slender graceful poised battle stance,
one hand on hip
```

**Reference vibe:** Boa Hancock in elegant battle attire. Cold beauty.

---

## Tips for consistency across all 6

- Generate ALL 6 in the same Firefly session — Firefly tends to keep style consistent within a session
- Use the **same style anchor** above for every generation
- Same aspect ratio for all
- If one comes out off-style, regenerate using the best one as a **style reference image**
- Crop to consistent dimensions in Photoshop (e.g. 512×910)
- Run all through [remove.bg](https://remove.bg) at the end for clean transparent backgrounds

## Optional pose variants (later)

Once `idle.png` for all 6 looks good, add per-pose PNGs by appending to the per-character prompt:

- **windup**: "in a power-up charging pose, arms cocked, ki energy gathering"
- **impact**: "mid-strike pose, fist or palm thrust forward, dynamic"
- **hit**: "recoiling backward from a punch, head tilted back, body twisted"
- **ko**: "lying collapsed on the ground, defeated, dust around"
- **victory**: "arms raised triumphantly, big grin, glowing aura"

File path convention: `web/public/fighters/<id>/<pose>.png`.

## Commercial license

Firefly generations carry an Adobe Commercial Use license. Safe for shipping in a paid product.
