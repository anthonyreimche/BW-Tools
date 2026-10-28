# Black & White for Safelight

A [Safelight](https://github.com/anthonyreimche/SafeLight) extension for
monochrome. Press **V** in Develop (or pick **Black & White** in the panel, or
right-click photos in the Library) and the photo turns black and white. The
conversion works on linear light, like a filter in front of film: a neutral
grey keeps its exact value, the result doesn't change character with exposure,
and every Safelight tool after it (Contrast, Tone Curve, Clarity, Color
Grading, Grain, Vignette, masks) works on the monochrome image. A photo left in
Colour is untouched.

## What it does

- **Treatment**: Colour or Black & White, per photo. `V` toggles it (rebind it
  in Preferences ▸ Shortcuts). In the Library, right-click → **Convert to Black
  & White** / **Convert to Colour** works on the whole selection, one undoable
  step per photo.
- **Response**: how the "film" sees colour. *Neutral* is the eye's luminance
  (Rec.709). *Panchromatic* renders blue skies a little lighter, like unfiltered
  film. *Extended red* lightens reds and skin and renders skies darker than
  Panchromatic does. *Orthochromatic* is red-blind: reds and lips go dark.
  *Blue-sensitive* is the wet-plate look: white skies, dark textured skin.
  *Infrared* is a look of bright foliage and black skies. *Custom* gives three
  channel sliders.
- **Filter**: a colour filter in front of the lens, with a strength. Yellow,
  Deep yellow, Orange, Red and Deep red darken blue skies progressively; Green
  and Yellow-green lighten foliage; Blue does the opposite of red.
- **Mix**: eight colour sliders (Red … Magenta, the same eight colours as the
  HSL panel). Each lightens or darkens that colour in grey by up to 2 stops at
  ±100, more for saturated colours and not at all for greys. **Auto** sets the
  eight so the photo's colour contrast survives in grey. **Target** lets you
  drag up or down over a colour in the photo to do the same by hand.
- **Selective colour**: keep one hue in colour (Hue, Range, Amount). The kept
  colour takes the brightness the B&W conversion gives it.
- **Toning**: *Toner* recipes (Sepia, Selenium, Gold, Cyanotype, Platinum,
  Copper, Split) that tint by tone the way chemical toners do, with a strength;
  split toning (Highlights and Shadows hue and saturation, Balance); and a
  *Paper* tint that shows most in the whites. Toning never changes a pixel's
  brightness, except the paper tint, which darkens the whites slightly, as a
  tinted paper does.
- **In masks**: add Black & White to a mask from the Masking panel's Adjust tab
  to convert or tone inside that mask only, with its own treatment switch. The
  mask's Black & White has the same controls as the panel's except Auto and
  Target, which read the whole photo. It works on the colours that reach it: on
  a photo in Colour it turns the masked area black and white; on a photo
  already in Black & White it gets greys, which its conversion leaves grey, so
  its toning is what shows. It needs the current processing: on a photo edited
  in an earlier Safelight, use Update processing first.

Everything is stored per photo, undoes and redoes, takes part in presets and
Copy/Paste, and renders the same in Develop, the Before view and export.

## Honest notes

- The responses are **generic sensitivity types, not named film stocks**: there
  is no spectral data behind them. Named stocks would be a claim the maths can't
  back.
- The filters are **approximations**: each is an average transmission over the
  red, green and blue primaries, not a spectral calculation.
- Infrared is an RGB look. A camera without an IR conversion records no
  near-infrared, so foliage glows because green is boosted, not because of
  real IR.

## The maths

- **Conversion**: `Y = max(dot(w, rgb), 0)` on scene-linear Rec.709, where `w`
  is response × filter, normalised so the weights sum to 1 (grey in, same grey
  out). A combination whose weights sum below 0.05 is held at that floor, so
  greys come out darker, as they would on film. At full filter strength that
  happens with Deep red on Orthochromatic, Red or Deep red on Blue-sensitive,
  and Blue on Infrared, which takes greys to black.
- **Mix**: `Y × 2^(2 × chroma × Σ bandᵢ/100 × weightᵢ(hue))`, with core HSL's
  band centres and partition-of-unity weights. Hue and chroma come from the
  colour scaled so its brightest channel is 1, so exposure doesn't move them.
- **Toning**: in display space after the core tools. Tints are zero-luminance
  offsets (a hue's colour minus its own luminance), so brightness is kept
  exactly; a per-pixel gamut guard keeps every channel in range.
- **Auto**: the contrast-preserving decolorization energy of Cewu Lu, Li Xu and
  Jiaya Jia, *Real-time Contrast Preserving Decolorization* (SIGGRAPH Asia 2012
  Technical Briefs), searched over the eight band sliders on a sample of the
  photo's colours at most 64 px on the long edge, with a small pull toward
  zero so a slider moves only when a colour contrast needs it.

## Requirements

Safelight 3.1.0 or later.

## Licence

MIT. See [LICENSE](LICENSE).
