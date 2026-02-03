# Video Editor Plan for Template-Maker

## 🎯 The Goal
Take an extracted template (16 locations from TikTok) + your video clips → Generate a finished video with text overlays, properly timed.

---

## ✅ What's Already Done

1. **Template Extraction** - WORKING!
   - Paste TikTok URL
   - Mac Mini API extracts all locations
   - Returns: location names, timestamps, hook text, outro text

2. **Mac Mini API** - RUNNING!
   - URL: `https://jons-mac-mini.tail01c962.ts.net`
   - Has ffmpeg for video processing
   - Connected to Vercel app

3. **Jon's Remotion** - EXISTS!
   - Location: `/Users/jonmac/hermione/history-gen-ai/render-api`
   - Can render videos with text overlays
   - Just needs to be connected

---

## 🔨 What Needs to Be Built

### Phase 1: Clip Upload Page
**Route:** `/editor/[templateId]`

```
┌─────────────────────────────────────────────┐
│  Edinburgh Template (16 locations)          │
├─────────────────────────────────────────────┤
│                                             │
│  1. Dean's Village          [Upload Clip]   │
│     ░░░░░░░░░░░░░░░░░░░░░░                  │
│                                             │
│  2. Circus Lane             [Upload Clip]   │
│     ░░░░░░░░░░░░░░░░░░░░░░                  │
│                                             │
│  3. Princes Street Garden   [Upload Clip]   │
│     ░░░░░░░░░░░░░░░░░░░░░░                  │
│                                             │
│  ... (all 16 locations)                     │
│                                             │
│           [ Generate Video ]                │
└─────────────────────────────────────────────┘
```

### Phase 2: Trim Interface
When you click on an uploaded clip:

```
┌─────────────────────────────────────────────┐
│  Trim: Dean's Village                       │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │         VIDEO PREVIEW               │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [==|─────────────────────────|==]         │
│     ▲ start                   ▲ end        │
│                                             │
│  Duration: 1.2s (target: 1s)               │
│                                             │
│        [ Cancel ]  [ Save Trim ]           │
└─────────────────────────────────────────────┘
```

**Features:**
- Drag left handle = set start point
- Drag right handle = set end point
- Preview plays the trimmed section
- Shows duration vs target duration

### Phase 3: Generate Video
When all clips are uploaded:

1. Send to Remotion:
   ```json
   {
     "template": {
       "hookText": "2 DAY ITINERARY in Edinburgh",
       "locations": [
         {"name": "Dean's Village", "clipUrl": "...", "start": 0.5, "end": 1.5},
         {"name": "Circus Lane", "clipUrl": "...", "start": 0, "end": 1.2},
         ...
       ],
       "outroText": "Follow for part 2"
     }
   }
   ```

2. Remotion renders:
   - Plays each clip at the right time
   - Overlays text (location names)
   - Adds intro/outro text
   - Exports final video

3. User downloads finished video!

---

## 🛠 Technical Components

### 1. Video Upload
- Use browser File API
- Store clips temporarily (Cloudinary? S3? Mac Mini?)
- Generate preview thumbnails

### 2. Trim UI
- HTML5 `<video>` element
- Range slider for trim handles
- Real-time preview of trimmed section

### 3. Remotion Integration
- Jon's existing render API
- Add new endpoint for "template render"
- Input: template + clips
- Output: rendered video file

---

## 📋 Step-by-Step Build Order

### Day 1: Basic Upload
- [ ] Create `/editor/[templateId]` page
- [ ] Show all locations from template
- [ ] Add file upload for each location
- [ ] Store uploaded clips temporarily

### Day 2: Trim Interface  
- [ ] Build trim modal/component
- [ ] Video preview with playback
- [ ] Draggable trim handles
- [ ] Save start/end times per clip

### Day 3: Remotion Connection
- [ ] Create render endpoint on Mac Mini (or Railway)
- [ ] Send template + clips to Remotion
- [ ] Return rendered video URL
- [ ] Add download button

### Day 4: Polish
- [ ] Progress indicator during render
- [ ] Error handling
- [ ] Mobile-friendly UI
- [ ] Preview before final render

---

## 💡 Simplest Possible Version (MVP)

If we want something working FAST:

1. Upload clips (no trimming yet)
2. Use first 1 second of each clip automatically
3. Send to Remotion
4. Download result

Add trimming later as enhancement.

---

## 🔗 Resources

- **Remotion docs:** https://www.remotion.dev/docs
- **Jon's render API:** `/Users/jonmac/hermione/history-gen-ai/render-api`
- **Mac Mini API:** `https://jons-mac-mini.tail01c962.ts.net`
- **Template extraction:** DONE! ✅

---

This is 100% buildable. You've done the hard part (extraction). The editor is just UI + connecting to Remotion.

---

## 🎨 PRE-BUILT TEMPLATES (Create Your Own)

Instead of only extracting from TikTok, the app will have **built-in templates** you can fill in:

### Template Library

**Itineraries:**
| Template | Locations | Duration |
|----------|-----------|----------|
| 2 Day Itinerary | 16 | ~18s |
| 3 Day Itinerary | 18 | ~22s |
| 4 Day Itinerary | 20 | ~28s |
| 5 Day Itinerary | 25 | ~30s |
| Week Itinerary | 21-28 | ~32s |

**Restaurants/Cafes:**
| Template | Items | Duration |
|----------|-------|----------|
| 5 Best Restaurants/Cafes | 5 | ~14s |
| 10 Best Restaurants/Cafes | 10 | ~24s |

**City Routes (Road/Train/Flight):**
| Template | Stops | Duration |
|----------|-------|----------|
| 2 Stop Route | 2 | ~10s |
| 3 Stop Route | 3 | ~12s |
| 4 Stop Route | 4 | ~14s |
| 5 Stop Route | 5 | ~16s |
| 8 Stop Route | 8 | ~22s |

### How It Works

1. **Pick a template**
   ```
   ○ 2 Day Itinerary
   ○ 3 Day Itinerary
   ○ Week Itinerary
   ○ 5 Best Restaurants
   ○ 10 Best Restaurants
   ○ City Route
   ```

2. **Fill in your info**
   - City/Region name
   - Location names for each slot
   - (For City Route) Add your stops + map screenshot

3. **Upload your clips**
   - One clip per location
   - Trim start/end points

4. **Generate!**
   - Remotion renders with text overlays
   - Download finished video

### City Route Template (Special)

Includes a map frame at the start:

```
FRAME 1 (3-4 seconds):
┌─────────────────────────────────────┐
│  Route: [City A] – [City B] – [City C]  │
│                                     │
│      [UPLOAD MAP SCREENSHOT]        │
│                                     │
│    🚂 Total: [X] hr [X] min         │
└─────────────────────────────────────┘

FRAMES 2+: Each city's highlights
```

User uploads:
- Map screenshot from Google Maps
- Video clips for each city
- Enters city names + total travel time

---

## 🎯 Final App Features

### Mode 1: Extract from TikTok
- Paste URL → Extract template → Upload your clips → Generate

### Mode 2: Create from Scratch  
- Pick pre-built template → Fill in locations → Upload clips → Generate

Both modes end with: **Automatic video generation via Remotion**

---

Rest up. We've got this. 💪
