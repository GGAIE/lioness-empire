# Art project handoff — EP08 Sacred ACT05

This folder is a **production guide** to independently create and QA the 32 ACT05 scene illustrations, not a claim that the 32 finished images already exist.

## Image sources / confidence

- **Mier**: `Character_References/Mier_Original_Look_USER_REFERENCE.jpg` is user-provided primary look reference; the blonde church lady is **LEFT**. `Mier_Three_View_v1.0_CANDIDATE.png` is a newly generated, independent front/side/back reference matching that look; **candidate awaiting final visual confirmation**, do not overwrite source. It is a separate full 1536×1024 image, not a cropped panel of a fake production-board graphic.
- **Alicia**: `Alicia_Three_View_USER_REFERENCE.jpg` is the exact user-provided image; `Alicia_Three_View_v1.0_USER_REFERENCE.png` is a faithful lossless-color-space transcode (not newly invented design).
- The additional `Views/*.png` are exact crops of those two 3-view sheets for convenient reference. Source full sheets are definitive.
- Olivia and Finley must use the project's already approved art references when available. This ZIP does not contain independent approved full-body references for them. Do not infer their official design from a generic CG prompt.

## Locked character presentation

Mier (user-accepted source look): blonde plaited chignon, amber eyes, white ivory and ornate gold church robe, solar chest medallion. Normal warmth and genuine diplomatic acumen. No obvious villain staging or unexplained change of hair color.

Alicia (user image 2): ash-brown low ponytail bound by green ribbon, gray-green eyes, light cream robe/coat, muted green capelet edge and sash, dark trousers, boots, leather waist pouch. **Do not** substitute the earlier proposed red/auburn-haired design. She is an independent mage, never a priestess.

Olivia: very long straight blue-black hair, amber-gold eyes; courtly navy/antique gold wardrobe (scene-specific regent variant consistent with project); **no crown**. Finley: completely human physical appearance without horns/scales/tail/wings/elf ears. Alicia ≠ missing Elia.

## Production procedure

1. Read `Character_Locks_and_Turnarounds.md` and compare front/side/back, face and wardrobe in Mier and Alicia references.
2. Render separate 16:9 1920×1080 or higher individual event CGs for `CG01..CG32`. A grid/sprite sheet does not count as 32 individual images.
3. Follow per-shot lighting, number of people, emotional acting and background environment in `CG_Prompts/ACT05_32_CG_Prompts_v1.0.md`. `CG25..CG31` are seven mutually exclusive outcome versions, all requiring distinct images. `CG32` is common EP09 handoff.
4. Name renders `LE_CG_EP08_ACT05_CG##_v1.0.png` (or WebP export with manifest updated). Keep all images versioned rather than overwrite unseen previous canon assets.
5. Validate anatomy, three-view face/hairstyle lock, clothing and props, character placement, 16:9 ratio, lack of legible text / watermarks; ensure public-relief scenes portray actual humanitarian work sympathetically.
6. Change `status` in `CG_Asset_Manifest.json` to `GENERATED_QA_PENDING` only after actual raster image exists, then `APPROVED` only after user approval. Include sha256 and dimensions of final render.

## Asset distinction

- Includes 2 full **character turnaround images** (one newly generated Mier sheet and one Alicia user reference), originals and cropped view panels.
- Includes **32 unique event-CG prompts**, mapped to scenes, and a CSV shot list.
- Includes **0 final scene CGs**. Do not place a prompt or sample reference image under an event-CG filename.
