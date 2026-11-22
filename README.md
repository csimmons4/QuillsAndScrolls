# Quills & Scrolls

A browser-based D&D 5e character management app. Create characters, level them up, manage spells and inventory, and add homebrew content — all without leaving the app.

Game reference data (spells, classes, races, items, etc.) is pulled from [dnd5e.wikidot.com](https://dnd5e.wikidot.com) and stored locally. Characters and homebrew are saved as files on your computer — not in the browser — so they're always safe.

---

## Where your data lives

Everything is stored as plain `.json` files inside the project folder:

```
Quills&Scrolls/
├── characters/
│   ├── Thalindra_a1b2c3d4.json      ← one file per character
│   ├── Brunak_the_Bold_e5f6g7h8.json
│   └── .history/                    ← earlier versions of each character (hidden folder)
├── .local-settings.json             ← only if you switched on phone/tablet access
└── homebrew/
    ├── spells/
    │   └── orb-of-destruction.json  ← one file per homebrew entry
    ├── items/
    │   └── sword-of-the-plan.json
    ├── feats/
    │   └── iron-will.json
    ├── races/
    │   └── stoneling.json
    ├── classes/
    └── backgrounds/
```

You can open, copy, move, or delete these files directly in Finder (Mac) or File Explorer (Windows) — no special tools needed.

On a Mac, files and folders starting with a dot are hidden: press **Cmd+Shift+.** in Finder to show them. Windows shows them normally.

---

## Setup — just double-click

There is **nothing to install by hand** — no Node.js download, no Terminal commands. The game content already ships inside this folder.

**Mac:** Double-click **`Start (Mac).command`** in the `Quills&Scrolls` folder.

**Windows:** Double-click **`Start (Windows).bat`** in the `Quills&Scrolls` folder.

The **first time** you run it, the launcher automatically installs everything it needs (a private copy of Node.js if your computer doesn't have a recent enough one, then the app files) and then opens the app in your browser. This first run takes a minute or two; after that it starts in seconds.

After you update the app (see [Updating to a new version](#updating-to-a-new-version)), the launcher notices and reinstalls the app files, and Node.js too if the app now needs a newer one. That launch takes a minute again. Whenever something has changed, the window also says **"Preparing the app…"** for a few seconds while it gets the app ready.

Keep the launcher's window open while you're using the app — closing it stops the server. To stop, close that window; to use it again later, just double-click the launcher.

**First-run notes:**

- **Mac:** The Mac may warn the file is from an unidentified developer. Right-click **`Start (Mac).command`** → **Open** → **Open**. After that it opens normally on a plain double-click.
- **Windows:** If a firewall popup appears, click **Allow access**. It's just Node.js opening a local port on your own machine.
- You need to be **online** the first time so the launcher can download what it needs. After that it works offline.
- If the install ever prints a line about "vulnerabilities", see [About the security warnings](#about-the-security-warnings-npm-audit).

> Prefer the command line? With Node.js 22.12 or newer installed, run `npm install` once and then `npm start`, opening **http://localhost:5173** yourself.

### Updating to a new version

Your characters and homebrew live in the app's own folder (`characters` and `homebrew`), so **a newly downloaded copy starts empty**. Bring them across in either of these ways:

- **Copy the folders:** close the old app's launcher window, then copy the `characters` and `homebrew` folders from the old copy into the new one (replace the empty ones). On a Mac, show hidden files first (**Cmd+Shift+.** in Finder) so the hidden History folder inside `characters` comes too. Then double-click Start in the new copy.
- **Backup and restore:** in the old copy, Settings → **Download Backup (.zip)**. In the new copy, Settings → **Restore from Backup…** and pick that file.

If you got the app with `git clone`, `git pull` updates it in place and your characters stay where they are.

Keep the old copy until you've seen your characters in the new one. An empty Vault in a new copy reminds you of this too.

### If something goes wrong

- **The browser didn't open:** go to **http://localhost:5173** yourself while the launcher's window is open.
- **"Your changes aren't being saved"** on a character sheet: the app has stopped (usually because its window was closed). Leave the page open, double-click the launcher again, and the changes save as soon as it's back.
- **A character is missing from the Vault:** look under **Recently deleted** at the bottom, and for a red box at the top listing files that couldn't be loaded. Every character also has its **History** (the clock button on the sheet).
- **"Something went wrong on this page":** click **Back to the Vault** or **Reload**. Your characters are saved as you play.
- **Port already in use / it won't start:** close every Quills & Scrolls window and double-click the launcher again (it stops an old copy first).
- **A phone or tablet can't connect:** check Settings → Phones & Tablets is on and the app was restarted after switching it on, that both are on the same Wi-Fi, and that your computer allowed "node" through its firewall.

### Using it on a phone or tablet

Off unless you switch it on. In **Settings → Phones & Tablets**, tick **Let phones and tablets on my Wi-Fi open the app**, then restart the app (close the launcher's window and double-click it again). Settings then shows an address like `http://192.168.1.20:5173` to open on the phone or tablet. Keep the computer running the app while you play.

There's no password: while this is on, anyone on the same Wi-Fi can open, change or delete your characters. Only use it at home, on a network you trust. The first time, your computer may ask whether to let "node" accept incoming connections: choose **Allow**.

---

## Updating Content

If wikidot gets updated with new spells, races, etc., just re-run the scraper:

```bash
# Re-scrape everything (uses local cache where possible — much faster than first run)
npm run scrape

# Force a full fresh download, ignoring cache
npm run scrape -- --force

# Only refresh specific categories
npm run scrape -- --only spells
npm run scrape -- --only spells,items
```

Available categories: `spells`, `items`, `races`, `classes`, `backgrounds`, `feats`

After scraping, restart the app (close its window and double-click the launcher): it gets itself ready with the new data on start.

---

## Features

### Character Vault
The home screen. Lists all your saved characters. From here you can:
- **Create a new character** — opens the step-by-step wizard
- **Import a character** — load a `.json` file from another device
- **Duplicate or delete a character** — in each card's **⋯** menu (deleting asks first)
- **Bring back a deleted character** — open **Recently deleted** at the bottom and click **Restore**. It comes back as it was just before it was deleted, with its History. **Delete forever** removes it for good.

Each card shows the portrait, class and HP, plus the numbers a DM asks for: AC, passive Perception, Insight and Investigation, and spell save DC. Chips show Wild Shape, concentration, conditions, exhaustion and running potions. The Vault updates every few seconds, so with phones and tablets switched on, changes players make on their own devices show up. A character at 0 HP shows **Down** (or **Stable**) with their death saves, and a character who has died moves to a **Fallen** section at the bottom.

### Character Creation Wizard
Eight steps that walk you through building a Level 1 character:
1. Race selection (60 races from PHB, Xanathar's, Tasha's, and more)
2. Class selection (all 13 classes)
3. Background
4. Ability scores (Standard Array, Point Buy, or Manual)
5. Skill proficiencies
6. Starting equipment
7. Name, alignment, and appearance
8. Review and confirm

### Character Sheet
The main play screen. Tabs for:
- **Stats** — ability scores, saving throws, skills, conditions, inspiration, class resources, rests, death saves
- **Spells** — known/prepared spells, spell slot tracker, cast & recover. A small mark on each spell shows what it mostly does: damage (in its damage type's colour), healing (with how much it heals), control, protection or utility. A key sits under the list.
- **Inventory** — equipment, attunement, magic item charges, potions you can drink, and a coin purse (gain or spend in any coin, with a ledger of what changed). Each coin carries the old alchemists' mark for its metal: Venus for copper, the Moon for silver, Jupiter for electrum, the Sun for gold, and the Sun and Moon joined for platinum.
- **Features** — all race, class, and background features with descriptions
- **Summons** — track summoned or companion creatures with their own HP and stats
- **Notes** — personality traits, ideals, bonds, flaws, backstory, free notes

Every change auto-saves to disk within a second, and straight away if you switch away from or close the tab. No manual save needed during play. Pop-up windows close with **Esc**.

Handy extras on the sheet:
- **Fight effects stay put:** Rage, Bless and spells on you survive a page refresh (they end on a rest, as before).
- **Undo:** after removing a spell or item, drinking a potion, taking a rest and similar, a bar offers **Undo** for a few seconds.
- **Quick find:** press **Cmd+K** (Mac) / **Ctrl+K** (Windows), or click the magnifier, to jump to any spell, item, feature or tab.
- **Print:** the printer button opens a printable two-page sheet (black on white in every theme).
- **Portrait:** click the initials in the sheet header to add a picture. It's saved inside the character's file.

Fight helpers on the Stats tab: Rage and Bless, spells that change your AC (Mage Armor, Shield, Shield of Faith, Haste, Barkskin), and a druid's **Wild Shape** (pick a beast form; it takes damage first and the rest carries over to you, and it uses the beast's AC, speed and attacks; Circle of the Moon druids can spend a spell slot to heal the beast, take bigger beasts up to CR 6 as they level, and from level 10 become an elemental for both Wild Shape uses). The Short Rest window handles hit dice, **Arcane Recovery** / **Natural Recovery** and **Song of Rest**. You roll every die yourself and type in the result.

**History:** the clock button on a sheet lists earlier versions of the character and can put one back. A version is kept at the start of each play session, before each level-up and before a restore, up to the 40 most recent per character. They live in the hidden `characters/.history/` folder, and the backup zip includes them unless you untick that option.

### Level Up
Click **Level Up** on any character sheet to:
- Choose which class to level (supports multiclassing)
- Gain HP (roll or take average)
- See new class features automatically
- Pick ASI (+2 to one stat or +1/+1) or choose a feat
- Select a subclass when eligible
- Add new spells known

A copy of the character from before the level-up is kept in History, in case you change your mind.

### Homebrew Editor
Add your own custom content that appears alongside official options everywhere in the app:
- **Items** — custom weapons, armor, magic items with any stats
- **Spells** — homebrew spells with full stat blocks
- **Feats** — custom feats with prerequisites
- **Races** — homebrew races with ability bonuses and traits
- **Classes** — homebrew classes with features and subclasses
- **Backgrounds** — homebrew backgrounds with proficiencies and features

Each entry is saved as its own `.json` file so you can share individual pieces with players (see below).

### Compendium
A searchable, filterable reference browser for **all** game content — spells, items, feats, races, backgrounds, and classes (official plus your homebrew). Filter by category and search by name or description without opening a character.

### Settings
- Choose a display theme: **Parchment** (warm classic), **Light** (clean white), **Forest** (mossy greens), **Frost** (ice blue), **Dark** (warm dungeon), **Arcane** (starlit violet) or **Ember** (smoke and embers)
- See when data was last scraped and how many entries exist
- Download a full backup `.zip` of all characters + homebrew (and each character's History, unless you untick it), and restore from one
- Let phones and tablets on your Wi-Fi open the app (off by default, see Setup)
- Re-scrape instructions

---

## Saving & Backup

### Characters
Characters auto-save to the `characters/` folder as you play. Each character is its own file named after the character.

**Save right now:** click the save (disk) button in the sheet header, or press **Cmd+S** (Mac) / **Ctrl+S** (Windows). This writes the character to the `characters/` folder straight away instead of waiting for the auto-save, and the button shows a tick when it's done.

**Download a copy:** the export (arrow) button next to it downloads the character as a `.json` file to your Downloads folder, as an extra backup or to send to someone.

**Move a character to another device:** copy the file from `characters/` on one machine to the same folder on the other. It will appear in the Vault automatically next time you open the app.

**Import via the app:** on the Vault page, click **Import .json** to load a character file through the browser.

### Homebrew
Each homebrew spell, item, feat, race, class, and background is saved as its own file inside the `homebrew/` folder:

```
homebrew/
├── spells/       ← e.g. orb-of-destruction.json
├── items/        ← e.g. sword-of-the-plan.json
├── feats/        ← e.g. iron-will.json
├── races/        ← e.g. stoneling.json
├── classes/      ← e.g. spellblade.json
└── backgrounds/  ← e.g. hedge-mage.json
```

**Share a single spell with a player:** send them the `.json` file from `homebrew/spells/`. They drop it into their own `homebrew/spells/` folder and it appears in their app automatically — no import button needed.

**Share everything at once:** go to Settings → **Download Backup (.zip)** — includes all characters and all homebrew in one file. Players can also use the **Import** button on the Homebrew page to load individual files or a full pack. Import never replaces an entry you already have: if the file has a different version of one of yours, yours is kept and the page says so (delete yours first to take theirs).

### Full Backup
Settings → **Download Backup (.zip)** bundles every character and all homebrew into a single zip file. Good to run before wiping your computer or moving to a new machine.

**Restore from a backup:** Settings → **Restore from Backup…** and pick the zip. Nothing is ever overwritten:
- characters the app doesn't have come back as they were,
- characters that are already here unchanged are skipped,
- a character you've changed since the backup comes back beside your current version,
- homebrew you're missing is added, and where the backup has a different version of an entry, yours is kept,
- earlier versions (History) are added.

A summary afterwards says what came back. Restoring the same backup twice adds nothing new.

---

## About the security warnings (npm audit)

When the launcher (or `npm install`) installs the app's files, npm checks every package the app is built from against a public list of known problems and prints a summary, such as *"found 0 vulnerabilities"*.

**It's not just your computer.** Everyone who installs this app sees the same message, because it comes from the list of packages that ships with the app (`package-lock.json`). The number can also go up over time without anything changing here, as new problems are published.

**Where things stand (21 November 2026):** `npm audit` reports **0 vulnerabilities**. The packages were brought up to date in November 2026 (Express, React Router 7, Vite 8, Vitest 5, Zod 4), and the app you play now runs as a built version served by its own small server, without the developer tools in the way.

**What to do (and not do):**
- `npm audit fix` is safe to run. It only takes small, compatible updates.
- **Don't run `npm audit fix --force`.** It jumps packages to new major versions (or even back to old ones), which can break the app. Big upgrades are best done as a planned change.

---

## For developers

Needs Node.js 22.12 or newer (the launchers use Node 24).

```bash
npm start            # what the launchers run: build if needed, then serve the app + API on 5173
npm run dev          # development: Vite with live reload (5173) + the API (5174)
npm test             # game-math tests + flow tests that click through the app
npm run test:sweep   # slow, broad checks over every class, page and button (~6 minutes)
npx tsc --noEmit     # type-check
npm run build        # production build
npm run audit:content   # compare the curated data with the scraped data
```

`CLAUDE.md` describes how the code is organised: data flow, the character model, the sheet's files, and conventions.

---

## Data & Attribution

Game content sourced from [dnd5e.wikidot.com](https://dnd5e.wikidot.com) under the [Creative Commons Attribution-ShareAlike 3.0 License](https://creativecommons.org/licenses/by-sa/3.0/).

Quills & Scrolls is an unofficial fan tool, not affiliated with Wizards of the Coast.
