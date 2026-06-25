import type { BackgroundDef } from '../content/loaders'

/**
 * Background enrichment overlay. Keyed by background slug.
 *
 * The scraper captures skills, tools, languages, and starting equipment
 * reasonably well. Gaps filled here: feature descriptions (scraper leaves them
 * empty) and spell grants for Strixhaven/Ravnica variants.
 */
export const BACKGROUND_OVERLAY: Record<string, Partial<BackgroundDef>> = {

  // ── PHB ───────────────────────────────────────────────────────────────────

  'acolyte': {
    feature: { name: 'Shelter of the Faithful', description: 'You and your party receive free healing and care at temples of your faith, and commoners of that faith will provide you with food and lodging. You have a connection to a specific temple where you can call on priests for aid within reason.' },
  },
  'charlatan': {
    feature: { name: 'False Identity', description: 'You have a second identity complete with forged documents and established contacts. You can also forge documents — official papers, personal letters, and similar items — as long as you have seen a comparable example.' },
  },
  'criminal': {
    feature: { name: 'Criminal Contact', description: 'You have a reliable and trustworthy contact who acts as your liaison to a criminal network. You know how to get messages to and from your contact over great distances, and can use this network to gather information or pass along warnings.' },
  },
  'entertainer': {
    feature: { name: 'By Popular Demand', description: 'You can always find a place to perform — an inn, a theater, or a noble\'s court — in exchange for free lodging and food of a modest or comfortable standard. Your performance makes you a local figure of some renown wherever you stay.' },
  },
  'folk-hero': {
    feature: { name: 'Rustic Hospitality', description: 'Common folk will shelter you and help hide you from authorities, as one of their own. They won\'t risk their lives for you but will provide food, shelter, and information while keeping your presence secret from those who would harm you.' },
  },
  'guild-artisan': {
    feature: { name: 'Guild Membership', description: 'Fellow guild members provide you with lodging, food, and a funeral if needed. Guilds wield political power that can open doors and pressure officials, though you owe dues and occasional service in return.' },
  },
  'hermit': {
    feature: { name: 'Discovery', description: 'Your hermitage granted you access to a unique discovery — a truth about the cosmos, a hidden power, or an unexplained phenomenon. Work with your DM to determine the nature and implications of what you found.' },
  },
  'noble': {
    feature: { name: 'Position of Privilege', description: 'People assume you have the right to be wherever you are. You are welcome in high society and others of noble birth treat you as a peer. Common folk make way for you and rarely challenge your authority.' },
  },
  'outlander': {
    feature: { name: 'Wanderer', description: 'You have an excellent memory for maps and geography. You can always recall the general layout of terrain and settlements around you, and can find food and fresh water for yourself and up to five others each day, provided the land offers foraging opportunities.' },
  },
  'sage': {
    feature: { name: 'Researcher', description: 'When you don\'t know a piece of lore, you know where and from whom to obtain it — usually a library, university, or learned person. You can always find the right source, even if the information is obscure, though gathering it may take time or cost favors.' },
  },
  'sailor': {
    feature: { name: "Ship's Passage", description: 'You can secure free passage on a sailing ship for yourself and your companions. In return, you and your party are expected to assist the crew during the voyage. The ship\'s captain may also ask for a favor in exchange.' },
  },
  'soldier': {
    feature: { name: 'Military Rank', description: 'Soldiers loyal to your former military organization recognize your rank and defer to you if they are of lower rank. You can invoke your rank to exert influence, commandeer equipment, or gain access to military fortifications.' },
  },
  'urchin': {
    feature: { name: 'City Secrets', description: 'You know the hidden passages and flows of cities. When not in combat, you and companions you lead can travel between any two locations in a city twice as fast as your speed would normally allow.' },
  },

  // ── Sword Coast Adventurer\'s Guide ────────────────────────────────────────

  'city-watch': {
    feature: { name: "Watcher's Eye", description: 'Your law enforcement experience helps you quickly locate the nearest guard post or watch headquarters in any city. You can also sniff out criminal dens and back-alley meeting spots, assuming they exist.' },
  },
  'clan-crafter': {
    feature: { name: 'Respect of the Stout Folk', description: 'Dwarves hold clan crafters in the highest regard. You always have free room and board in any settlement where shield or gold dwarves dwell, and they may shield you from harm out of professional respect.' },
  },
  'cloistered-scholar': {
    feature: { name: 'Library Access', description: 'While others must obtain permits to access your institution\'s archives, you move freely through most of the library\'s holdings. You also know which scholars to approach for obscure topics outside your area of expertise.' },
  },
  'courtier': {
    feature: { name: 'Court Functionary', description: 'Your knowledge of bureaucratic procedures lets you navigate any noble court or government. You know who the key power brokers are and how to approach them for favors, audiences, or access to restricted information.' },
  },
  'faction-agent': {
    feature: { name: 'Safe Haven', description: 'You know secret signs and passwords to identify fellow operatives of your faction. They can provide you with a safe house, free lodging, or assistance finding information in any city where your faction is active.' },
  },
  'far-traveler': {
    feature: { name: 'All Eyes on You', description: 'Your foreign appearance and manner draw curious attention everywhere you go. Scholars, merchants, and nobles often seek you out for news of distant lands. This curiosity can be leveraged to gain introductions and open doors that would otherwise stay shut.' },
  },
  'inheritor': {
    feature: { name: 'Inheritance', description: 'You carry or have access to something of great value — an item, a title, a secret, or an obligation that shapes how others perceive you. Work with your DM to determine what you inherited and how it affects your relationships and responsibilities.' },
  },
  'knight-of-the-order': {
    feature: { name: 'Knightly Regard', description: 'Members of your knightly order and their allies will provide you with shelter, food, and assistance. Religious orders associated with your knights will also aid you. Fellow knights share information and resources with you as a professional courtesy.' },
  },
  'mercenary-veteran': {
    feature: { name: 'Mercenary Life', description: 'You can identify any mercenary company by its insignia and know something of its reputation, commanders, and methods. You can always locate the taverns and gathering spots that mercenaries frequent in any area.' },
  },
  'urban-bounty-hunter': {
    feature: { name: 'Ear to the Ground', description: 'You are in regular contact with people who move in the same circles as your quarries — street toughs, fences, criminal fixers, or high-society gossips. In any city you visit, you can establish contact with an informant in the relevant social stratum within a day.' },
  },
  'uthgardt-tribe-member': {
    feature: { name: 'Uthgardt Heritage', description: 'You know the territory and natural resources of the North intimately. When you forage, you find twice as much food and water as normal. You can also call upon the hospitality of Uthgardt clans, who will shelter and feed you while you travel through their lands.' },
  },
  'waterdhavian-noble': {
    feature: { name: 'Kept in Style', description: 'While in Waterdeep or elsewhere in the North, your house covers your everyday expenses. Your name and family signet are sufficient to live at a comfortable or even wealthy lifestyle — the bill is sent home and settled by your family.' },
  },

  // ── Strixhaven ────────────────────────────────────────────────────────────

  'lorehold-student': {
    feature: { name: 'Strixhaven Initiate (Lorehold)', description: 'You learn one cantrip and one 1st-level spell from the Lorehold spell list. You can cast the 1st-level spell once per day without a spell slot, using your spellcasting ability (or Intelligence if you have no casting class).' },
  },
  'prismari-student': {
    feature: { name: 'Strixhaven Initiate (Prismari)', description: 'You learn one cantrip and one 1st-level spell from the Prismari spell list. You can cast the 1st-level spell once per day without a spell slot, using your spellcasting ability (or Charisma if you have no casting class).' },
  },
  'quandrix-student': {
    feature: { name: 'Strixhaven Initiate (Quandrix)', description: 'You learn one cantrip and one 1st-level spell from the Quandrix spell list. You can cast the 1st-level spell once per day without a spell slot, using your spellcasting ability (or Intelligence if you have no casting class).' },
  },
  'silverquill-student': {
    feature: { name: 'Strixhaven Initiate (Silverquill)', description: 'You learn one cantrip and one 1st-level spell from the Silverquill spell list. You can cast the 1st-level spell once per day without a spell slot, using your spellcasting ability (or Charisma if you have no casting class).' },
  },
  'witherbloom-student': {
    feature: { name: 'Strixhaven Initiate (Witherbloom)', description: 'You learn one cantrip and one 1st-level spell from the Witherbloom spell list. You can cast the 1st-level spell once per day without a spell slot, using your spellcasting ability (or Wisdom if you have no casting class).' },
  },

  // ── Ravnica ───────────────────────────────────────────────────────────────

  'azorius-functionary': {
    feature: { name: 'Legal Authority', description: 'As an Azorius official, people recognize your authority to enforce the law. You can invoke your position to question witnesses, access crime scenes, and commandeer basic equipment. Lawbreakers in your jurisdiction are inclined to comply, at least initially.' },
  },
  'boros-legionnaire': {
    feature: { name: 'Legion Station', description: 'As a Boros legionnaire, you and your companions can receive free room and board at any Boros garrison and can requisition simple equipment for temporary use. Legion members share information about their activities and enemies with you.' },
  },
  'dimir-operative': {
    feature: { name: 'False Identity', description: 'You have a carefully constructed alternate identity with forged documents and established contacts. You can forge documents given examples of the writing style, and you know how to access Dimir safe houses and information caches across the city.' },
  },
  'golgari-agent': {
    feature: { name: 'Undercity Access', description: 'You know how to find and use Golgari passages through the undercity. Golgari members will grant you transit and basic assistance in the underground, and you can navigate the subterranean tunnels without becoming lost.' },
  },
  'gruul-anarch': {
    feature: { name: 'Clan Protections', description: 'Gruul clans recognize you as kin and will offer you and your companions food and shelter, though they won\'t endanger themselves for you. While in good standing with your own clan, your group always has a place to rest and recover.' },
  },
  'izzet-engineer': {
    feature: { name: 'Izzet Researcher', description: 'Your standing with the Izzet League grants access to guild laboratories and workshops. You can requisition basic materials and tools for research through guild channels, and other Izzet mages will assist you with information and expertise in exchange for professional courtesy.' },
  },
  'orzhov-representative': {
    feature: { name: 'Leverage', description: 'The Orzhov Syndicate\'s web of debts is vast. You know who owes the Syndicate favors in any given area and can use that knowledge to extract cooperation or information. The Syndicate also maintains safe houses available to its agents.' },
  },
  'rakdos-cultist': {
    feature: { name: 'Fearsome Reputation', description: 'People know the Cult of Rakdos and tend to give its members a wide berth. You can use this reputation to encourage nervous cooperation and gain access to certain underworld contacts. You have a reliable contact within the cult who can provide information and assistance.' },
  },
  'selesnya-initiate': {
    feature: { name: "Conclave's Shelter", description: 'You and your companions can receive free food and shelter at any Selesnya enclave. While within a Selesnya enclave, you can communicate with the plants and animals there as though you shared a language — conveying basic intent and emotion.' },
  },
  'simic-scientist': {
    feature: { name: 'Simic Guild Contacts', description: 'Your scientific credentials open doors at Simic laboratories. Other Simic researchers share data and findings with you as a professional courtesy. You can also request assistance from guild hybrids or mages of modest ability for short-term tasks.' },
  },

  // ── The Wild Beyond the Witchlight ────────────────────────────────────────

  'feylost': {
    feature: { name: 'Feywild Connection', description: 'Your time in the Feywild left a lasting mark. Small fey creatures occasionally leave you gifts or deliver messages. Once per day you can spend 1 minute to communicate simple intent and emotion with a Tiny beast within 10 feet, as though through a shared language.' },
  },
  'witchlight-hand': {
    feature: { name: 'Carnival Fixture', description: 'You are a valued member of the Witchlight Carnival. While traveling with it, your lodging, food, and nonmagical gear expenses are covered. You know all the acts and workers by name and can navigate the carnival\'s politics and schedules without difficulty.' },
  },

  // ── Candlekeep Mysteries ──────────────────────────────────────────────────

  'ruined': {
    feature: { name: 'Still Standing', description: 'You have survived catastrophic loss, and this marks you in ways others recognize. The downtrodden and desperate — refugees, the displaced, the poor — will shelter and feed you without pay, seeing in you a kindred spirit who has endured what they endure.' },
  },

  // ── Ghosts of Saltmarsh ───────────────────────────────────────────────────

  'fisher': {
    feature: { name: 'Harvest the Water', description: 'You gain advantage on ability checks using fishing supplies. If you spend at least 1 hour fishing in a place that has fish, you can provide enough food for yourself and up to five other people, depending on local availability.' },
  },
  'marine': {
    feature: { name: 'Steady', description: 'Your sea legs are unshakeable. You have advantage on saving throws to resist being knocked prone on moving vehicles or unstable surfaces, and moving across difficult terrain caused by water costs you no extra movement.' },
  },
  'shipwright': {
    feature: { name: "I'll Patch It!", description: 'As an action, you can inspect a vessel and determine its seaworthiness and structural weak points. During a short rest, you can attempt a DC 15 check using carpenter\'s tools to patch a moderate leak or structural weakness in a ship hull.' },
  },
  'smuggler': {
    feature: { name: 'Down Low', description: 'You know smuggling networks in coastal settlements. You can arrange to move goods or people through a port in secret for a fee based on the risk. Smugglers you encounter recognize you as a professional and treat you with corresponding courtesy.' },
  },

  // ── Acquisitions Incorporated ─────────────────────────────────────────────

  'grinner': {
    feature: { name: 'Ballad of the Grinning Roger', description: 'You know a secret song that serves as a recognition code among operatives of your covert network. By performing or humming the ballad, you can signal fellow members, who will use variations of the tune to identify themselves and communicate basic coded information.' },
  },

  // ── Explorer\'s Guide to Wildemount ────────────────────────────────────────

  'volstrucker-agent': {
    feature: { name: 'Covert Network', description: 'You have access to a covert network of safehouses in major cities. You can find shelter and basic supplies through this network, and can request information or low-stakes assistance from other agents — though all assistance comes with the expectation of future reciprocity.' },
  },

  // ── Mythic Odysseys of Theros ─────────────────────────────────────────────

  'athlete': {
    feature: { name: 'Echoes of Victory', description: 'Your athletic reputation opens doors. In regions where you have competed, people recognize you and are eager to meet you. You can leverage this fame to secure audiences with local officials, find free lodging from admirers, and gather information from fans.' },
  },

  // ── Eberron: Rising from the Last War ─────────────────────────────────────

  'house-agent': {
    feature: { name: 'House Connections', description: 'As a dragonmarked house agent, you have access to house resources. You can requisition modest supplies, find shelter at house enclaves, and receive basic assistance from house members. Your house standing also provides a degree of legal protection.' },
  },

  // ── Tomb of Annihilation ──────────────────────────────────────────────────

  'anthropologist': {
    feature: { name: 'Adept Linguist', description: 'You can communicate basic intent with any humanoid through gesture and expression. If you spend 1 day observing and interacting with a group, you can make a DC 16 Intelligence check to communicate in their language for the next week without formal training.' },
  },
  'archaeologist': {
    feature: { name: 'Historical Knowledge', description: 'When you enter a ruin or dungeon, you can identify its original builders, approximate age, likely original purpose, and common hazards associated with that era or culture. You can also assess the provenance and age of artifacts on sight.' },
  },

  // ── Curse of Strahd ───────────────────────────────────────────────────────

  'haunted-one': {
    feature: { name: 'Heart of Darkness', description: 'Common folk can see that you have endured something terrible. They will help you — sheltering you, hiding you from those who hunt you — without risking their own lives. In lands of darkness and despair, people often seek your guidance precisely because you survived what they fear.' },
  },

  // ── Baldur\'s Gate: Descent into Avernus ──────────────────────────────────

  'faceless': {
    feature: { name: 'Incognito', description: 'You have created a persona distinct from your true identity. While in your disguise you adopt a different appearance and manner. You are proficient with the disguise kit, and others have disadvantage on Insight checks to see through your constructed identity.' },
  },

  // ── Journeys through the Radiant Citadel ──────────────────────────────────

  'celebrity-adventurers-scion': {
    feature: { name: 'Name Dropping', description: 'Your famous family name opens doors. You can invoke your family to request meetings with nobles or influential figures — they may ask favors in return. Merchants sometimes offer discounts or extra services when they recognize the name.' },
  },
  'failed-merchant': {
    feature: { name: 'Supply Chain', description: 'Given 1 hour exploring a settlement\'s markets, you can identify which merchants sell what wares, who the major trade suppliers are, and who deals in goods of dubious legality — if such contacts exist in the area.' },
  },
  'gambler': {
    feature: { name: 'Never Tell Me the Odds', description: 'You can always find gambling venues in a city and can detect rigged games at a glance. You know the local gambling hierarchy and key personalities. Your instinct for probability also gives you advantage on Intelligence checks when evaluating plans that hinge on chance or risk assessment.' },
  },
  'plaintiff': {
    feature: { name: 'Legal Entanglement', description: 'Your experience with legal proceedings gives you a working knowledge of most civilized legal systems. You recognize when you are being cheated under the law and have contacts among legal professionals who can help you research statutes or file formal complaints.' },
  },
  'rival-intern': {
    feature: { name: 'Scion of the Institution', description: 'Your former internship gives you residual access to institutional resources — reference materials, minor equipment loans, or introductions to junior staff members. Your old contacts may help you, though they may expect small favors in exchange.' },
  },

  // ── Spelljammer: Adventures in Space ─────────────────────────────────────

  'astral-drifter': {
    feature: { name: 'Wildspace Adaptation', description: 'You can navigate by stars and astral phenomena, always maintaining a sense of position in wildspace. Your experience surviving the void means you know how to conserve air and endure harsh conditions better than most travelers.' },
  },
  'wildspacer': {
    feature: { name: 'Wildspace Survivor', description: 'You know how to find safe docking and resupply opportunities across the known spheres. You can always find work on a spelljamming vessel in exchange for passage, and can identify most common ship types and their armaments on sight.' },
  },

  // ── Planescape: Adventures in the Multiverse ──────────────────────────────

  'gate-warden': {
    feature: { name: 'Portal Lore', description: 'You know the locations and general schedules of portals near any major planar hub you visit, along with their destinations and portal keys if known. You have at least one contact in Sigil who trades in portal information and can provide up-to-date intelligence.' },
  },
  'planar-philosopher': {
    feature: { name: 'Conviction', description: 'Your philosophical alignment attracts like-minded beings. In any large settlement on the planes, you can find members of your faction (or sympathizers) who will offer shelter, information, and basic protection — so long as your beliefs remain compatible with theirs.' },
  },
  'rewarded': {
    feature: { name: "Fortune's Favor", description: 'Your story of miraculous survival is known. People are curious about you and sometimes offer charity or assistance out of superstition or hope that your luck is contagious. You can leverage this notoriety to gain audiences with the curious and receive free hospitality from those who want to hear your tale.' },
  },

  // ── Dragonlance: Shadow of the Dragon Queen ───────────────────────────────

  'knight-of-solamnia': {
    feature: { name: 'Squire of Solamnia', description: 'Knights of Solamnia recognize you and those of lesser rank defer to you. In Solamnic territory, knights will provide shelter, food, and assistance. You can invoke the order\'s name to request an audience with Solamnic lords and officials.' },
  },
  'mage-of-high-sorcery': {
    feature: { name: 'Rite of the Firstborn', description: 'You may request haven at any Tower of High Sorcery. While in a tower, you have access to a private room and the tower\'s library. Mages of your order will assist you with information and magical resources within their means.' },
  },

  // ── Van Richten\'s Guide to Ravenloft ──────────────────────────────────────

  'investigator': {
    feature: { name: 'Official Inquiry', description: 'When you present your investigative credentials, witnesses and officials are compelled to cooperate. You can gain access to official records, interview people being held for questioning, and demand answers — though cooperation stops where personal risk begins.' },
  },
}
