# Original art

community-day.webp is a format-optimized copy of an original image created with the built-in image-generation tool for this project on 2026-11-10. The supplied concept is a style/composition reference, not a traced interface. Character sprites are original deterministic canvas drawings in src/world.mjs. The circular theme mark references Linux.do; this is a non-official fan project.

Generation brief: An original wide pixel-art community scene, warm daylight, distant city, lush trees, a centered community café with orange tiled roof and orange-white awning, a black/white/amber circular badge, left wooden noticeboard, right server workshop and book stall, lamps, benches, flowers and tea tables. All buildings share a flat horizontal foundation. Keep sky and street clear for live interface and characters. No people, UI, device frame, labels, captions or watermark. Original architecture inspired by the chosen reference, not copied verbatim.

## 背景音乐《小站午后》

`src/music.mjs`：本项目专门创作的 16 小节 D 大调原创合成配乐，76 BPM。旋律、和声与编排以代码生成，使用浏览器 Web Audio 正弦波/三角波，不含第三方录音、采样或外部音源，无需请求音乐网站。默认关闭，由用户点击开启；游戏倍速不改变播放速度。

## Extended community street: benefits and resource buildings

`community-expanded-day.png` is an original edited/outpainted panorama generated on 2026-11-11 using the built-in `image_gen` tool. The existing `community-day.webp` was inspected and supplied as the sole edit/style reference. The returned 2172 × 724 PNG has a 3:1 aspect ratio and is rendered at 2823 × 941 world units to retain the original street scale. The original source image remains in this directory unchanged. The selected generation was copied from the tool's local `exec-cbd0ab97-dada-4752-bd46-a86fe712d5b3.png` result; it is not hotlinked. No third-party stock imagery, manual raster compositing or new font assets were used.

Generation brief: Extend the original horizontal street only to the right into a 3:1 panorama, retaining the cafe, noticeboard, server workshop and document kiosk, their warm pixel illustration and flat sidewalk. Continue the blue sky, distant city, lush trees, planters, pink cobbled road and foreground flowers. Add two genuinely separate freestanding buildings: an ochre-roofed community gift / benefits shop with a sheep emblem and wrapped gifts, and a teal-roofed resource archive with a book emblem, tall warm windows, books and tools. Each has its own roof, door and foundation on the same street level. Leave both wooden name plaques blank for accurate accessible DOM text. No people, UI, captions, words, watermark, isometric view or overhead view.

`src/world.mjs` exports the shared building geometry and interaction destinations. The two new buildings open the existing sponsorship mailbox and content panel. Scene art, pedestrians and interaction areas do not modify saved game state or economic rules. `src/ambient-chat.mjs` uses the same exported world dimensions so speech remains attached to its actual character after horizontal scrolling.

## Sharing houses reconstruction (current scene)

`community-sharing-day-v2.png` is the current 2172 × 724 (3:1) scene, generated with the built-in `image_gen` tool on 2026-11-11 and copied from its `exec-1d433643-424b-4229-978a-a19d6b15e10d.png` local result. `community-expanded-day.png` was inspected and supplied as the sole edit target. Both prior images are retained unmodified. The game still uses 2823 × 941 world coordinates, with all remaining entrances, title plaques, characters and the original cafe focus unchanged.

Edit brief: Preserve the original panorama, scale, warm pixel style, horizontal sidewalk, noticeboard, cafe, server hut, sky, trees and road. Remove the small orange-canopied document kiosk completely and replace its footprint with a low garden bench, shrubs, flowers and stepping stones, with no remaining kiosk roof or sign. Rework the sheep-emblem building into a community giveaway and raffle house featuring a visible friendly prize wheel, paper raffle tickets, a transparent draw box and freely shared gift parcels, without prices, payment terminals or donation mailboxes. Rework the teal-roofed resource building into a software/open-source/video-lesson/book sharing house with generic code and play screens, a small branching diagram and bookcases, without real brands or sales details. Preserve the two large blank wooden title plaques for DOM labels. No people, UI, words or watermark; never an isometric or overhead view.

The document kiosk is removed from `SCENE_BUILDINGS` and its former footprint is non-interactive. The remaining geometry is unchanged. The two reconstructed houses now report the semantic actions `benefits` and `resources` for the app to route to their own sections, rather than the sponsorship mailbox or general content panel. Historical `ROOM_LAYOUT` metadata remains intact. This visual edit does not alter the save schema or engine.
