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
│   └── Brunak_the_Bold_e5f6g7h8.json
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

---

## Setup — just double-click

There is **nothing to install by hand** — no Node.js download, no Terminal commands. The game content already ships inside this folder.

**Mac:** Double-click **`Start (Mac).command`** in the `Quills&Scrolls` folder.

**Windows:** Double-click **`Start (Windows).bat`** in the `Quills&Scrolls` folder.

The **first time** you run it, the launcher automatically installs everything it needs (a private copy of Node.js if your computer doesn't already have one, then the app files) and then opens the app in your browser. This first run takes a minute or two; after that it starts in seconds.

Keep the launcher's window open while you're using the app — closing it stops the server. To stop, close that window; to use it again later, just double-click the launcher.

**First-run notes:**

- **Mac:** The Mac may warn the file is from an unidentified developer. Right-click **`Start (Mac).command`** → **Open** → **Open**. After that it opens normally on a plain double-click.
- **Windows:** If a firewall popup appears, click **Allow access**. It's just Node.js opening a local port on your own machine.
- You need to be **online** the first time so the launcher can download what it needs. After that it works offline.

> Prefer the command line? You can still run `npm install` once and then `npm run dev`, opening **http://localhost:5173** yourself.

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

After scraping, refresh your browser to pick up the new data.

---

## Features

### Character Vault
The home screen. Lists all your saved characters. From here you can:
- **Create a new character** — opens the step-by-step wizard
- **Import a character** — load a `.json` file from another device
- **Delete a character** — with confirmation

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
- **Spells** — known/prepared spells, spell slot tracker, cast & recover
- **Inventory** — equipment list, currency (cp/sp/ep/gp/pp), attunement
- **Features** — all race, class, and background features with descriptions
- **Summons** — track summoned or companion creatures with their own HP and stats
- **Notes** — personality traits, ideals, bonds, flaws, backstory, free notes

Every change auto-saves to disk within a second. No manual save needed during play.

### Level Up
Click **Level Up** on any character sheet to:
- Choose which class to level (supports multiclassing)
- Gain HP (roll or take average)
- See new class features automatically
- Pick ASI (+2 to one stat or +1/+1) or choose a feat
- Select a subclass when eligible
- Add new spells known

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
- Choose a display theme — **Parchment** (warm classic), **Light** (clean white), or **Dark**
- See when data was last scraped and how many entries exist
- Download a full backup `.zip` of all characters + homebrew
- Re-scrape instructions

---

## Saving & Backup

### Characters
Characters auto-save to the `characters/` folder as you play. Each character is its own file named after the character.

**Save to file manually:** click **💾 Save Character** on the character sheet, or press **Cmd+S** (Mac) / **Ctrl+S** (Windows). This downloads a copy to your Downloads folder as an extra backup.

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

**Share everything at once:** go to Settings → **Download Backup (.zip)** — includes all characters and all homebrew in one file. Players can also use the **Import** button on the Homebrew page to load individual files or a full pack.

### Full Backup
Settings → **Download Backup (.zip)** bundles every character and all homebrew into a single zip file. Good to run before wiping your computer or moving to a new machine.

---

## Data & Attribution

Game content sourced from [dnd5e.wikidot.com](https://dnd5e.wikidot.com) under the [Creative Commons Attribution-ShareAlike 3.0 License](https://creativecommons.org/licenses/by-sa/3.0/).

Quills & Scrolls is an unofficial fan tool, not affiliated with Wizards of the Coast.
