import { v4 as uuidv4 } from 'uuid'
import { Character, SCHEMA_VERSION } from './model'

export function newCharacter(overrides: Partial<Character> = {}): Character {
  const now = new Date().toISOString()
  return {
    id: uuidv4(),
    schemaVersion: SCHEMA_VERSION,
    name: 'Unnamed Adventurer',
    createdAt: now,
    updatedAt: now,
    raceSlug: '',
    subraceSlug: undefined,
    backgroundSlug: '',
    classes: [],
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    skillProficiencies: [],
    skillExpertise: [],
    saveProficiencies: [],
    toolProficiencies: [],
    languages: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    spells: [],
    spellSlots: {},
    pactSlots: undefined,
    ritualBook: [],
    featuresChosen: [],
    hp: { current: 1, temp: 0 },
    classResources: {},
    hitDiceUsed: {},
    freeSpellUses: {},
    campaignBoard: { activeBoard: '', boards: [] },
    summons: [],
    customResources: [],
    conditions: [],
    exhaustionLevel: 0,
    deathSaves: { successes: 0, failures: 0 },
    inspiration: false,
    personalityTraits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    appearance: '',
    backstory: '',
    notes: '',
    age: '',
    height: '',
    weight: '',
    eyes: '',
    skin: '',
    hair: '',
    alignment: '',
    ...overrides,
  }
}

export function touchUpdated(char: Character): Character {
  return { ...char, updatedAt: new Date().toISOString() }
}
