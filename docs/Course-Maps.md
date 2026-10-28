# Course Maps

How a club's hole maps and scorecard get into Flagrr, from the GM's photos to the member's Course and My Golf tabs. What members see is in [Member App Features](Member-App-Features#course-and-my-golf); the admin screens are in [Admin Console Features](Admin-Console-Features).

## The flow

1. **The GM uploads scorecard photos.** On the club's admin dashboard, the **Course map** panel takes up to 12 photos (resized to 1,800 px wide JPEGs, stored inline in `scorecard_photos`). The first upload in a 30-minute window emails the Flagrr team at `CONTACT_EMAIL`. The panel shows the stage: *Send your scorecard*, *Photos received*, *Being built* (a draft map exists) or *Live*.
2. **The super admin downloads the photos.** Super admin console → **Course Maps** (sidebar, or the map icon on Courses) → the club. The photos can be viewed there and downloaded on the web console.
3. **The map is built from the photos and OpenStreetMap.** The super admin gives the photos to Claude, which types the card into `course-maps/cards/<slug>.card.json` and runs the builder (below). The builder takes the holes, greens, tee boxes, bunkers, water and trees from OpenStreetMap and writes `course-maps/<slug>.json`.
4. **The super admin imports the file.** On the club's Course Map screen, **Import map file** uploads `course-maps/<slug>.json`. The API validates it: a broken file is refused with a list of problems; a file with missing card data is saved as a **draft**, and the screen lists what still blocks publishing.
5. **Publish.** **Publish to members** is only allowed when nothing blocks it. Until then members of that club see "coming soon" in both tabs. **Unpublish** takes it back to draft; a live map can be replaced with a new file only if the new file is just as complete.

A course that isn't a Flagrr club (an away course members play) is imported from **Import a course** under *Away-only courses* on the Course Maps list, and published the same way.

## The card file

`course-maps/cards/<slug>.card.json`, typed from the scorecard photos:

| Field | What goes in it |
|---|---|
| `name`, `location` | As members should see them. |
| `osm` | `{ lat, lon, radius }`: the middle of the course and a radius in metres that reaches every hole but no neighbouring course's holes. |
| `holeCount` | 9 or 18. |
| `tees[]` | One per tee: `id` (must match the `tee=` tag on OpenStreetMap tee boxes, for example `white`), `name`, `color` (`#RRGGBB`), `lengths` (metres per hole, from the card) and `ratings`. |
| `tees[].ratings` | `{ men?: { full, front9?, back9? }, ladies?: { ... } }`, each `{ cr, slope }`. `full` is the whole course. `front9` / `back9` are the separate nine-hole ratings; leave them out when the card doesn't print them, and members can then only score full rounds. |
| `card` | `{ men?: { par[], si[] }, ladies?: { par[], si[] } }`. When the card has one par and stroke-index row, use it for both. |
| `notes[]` | Where the data came from and anything to confirm. Shown to the super admin on import, never to members. |

## The builder

```bash
npx tsx scripts/course-maps/build.ts strand-golf-club            # uses the cached OSM download
npx tsx scripts/course-maps/build.ts strand-golf-club --refresh  # downloads OSM again
```

- It first finds the `golf=hole` ways within the radius (each needs a `ref` of 1 to N), then downloads everything golf-related in a box around them plus 200 m, and caches it in `course-maps/osm/<slug>.osm.json`.
- Greens are matched to the hole whose line ends within 40 m of them; other greens are kept as practice greens.
- Tee boxes are matched by the hole number in their `ref` or `name` (otherwise the nearest hole's start), and by their `tee=` tag.
- **Tee placement:** where a tee box sits more than 15 m off the card's length for that hole (OpenStreetMap often draws one box for two tees), the member's starting point is put on the hole's centre line exactly the card length from the green, so the distance on the map matches the card. The builder lists every hole where it did this.
- It warns when OpenStreetMap's par disagrees with the card (the card wins), and prints the same errors and publish blockers the API checks (`checkCourseMap` in `mobile/src/golf/courseMap.ts`).
- Map data is © OpenStreetMap contributors (ODbL); the attribution travels in the file and is shown on the map.

## What blocks publishing

`checkCourseMap` refuses a file outright if its structure is wrong (hole count, a hole without a centre line or green, unknown feature types, bad tee ids or colours, lengths outside 40 to 700 m). It saves a draft but blocks publishing until:

- at least one tee has a Course Rating and Slope;
- every rated gender has par 3 to 6 on every hole and a stroke index using each number 1 to N once;
- every rating is in range (18-hole Course Rating 55 to 85, nine-hole 27 to 43, Slope a whole number 55 to 155);
- every rated tee has a length and a tee box on every hole.

## Status of each course

| Course | Status |
|---|---|
| Strand Golf Club | Card typed from the club's scorecard photo on 2026-10-28 and the map built (`course-maps/strand-golf-club.json`, no blockers). Not yet imported or published: migration `048` has to be applied first. The card has no nine-hole ratings, so only 18-hole rounds can be scored there. |
