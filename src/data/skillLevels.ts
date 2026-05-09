/**
 * Level requirement for each skill (English name → minimum player level).
 * Sourced from MitPlan (https://github.com/MarbleSodas/MitPlan), MIT license.
 * Skills whose nameEN is not listed default to level 1.
 */
export const SKILL_LEVEL_REQUIREMENTS: Record<string, number> = {
  // ── Limit Breaks ────────────────────────────────────────────────────────
  LB1: 1,
  LB2: 1,
  LB3: 1,

  // ── Tank invulnerabilities ───────────────────────────────────────────────
  'Hallowed Ground': 50,
  'Holmgang': 42,
  'Living Dead': 50,
  'Superbolide': 50,

  // ── Tank role actions ────────────────────────────────────────────────────
  'Rampart': 8,
  'Reprisal': 22,

  // ── Paladin ─────────────────────────────────────────────────────────────
  'Sentinel': 38,
  'Sheltron': 35,
  'Bulwark': 52,
  'Divine Veil': 56,
  'Intervention': 62,
  'Passage of Arms': 70,
  'Holy Sheltron': 82,
  'Guardian': 92,

  // ── Warrior ─────────────────────────────────────────────────────────────
  'Thrill of Battle': 30,
  'Vengeance': 38,
  'Raw Intuition': 56,
  'Equilibrium': 58,
  'Shake It Off': 68,
  'Nascent Flash': 76,
  'Bloodwhetting': 82,
  'Damnation': 92,

  // ── Dark Knight ──────────────────────────────────────────────────────────
  'Shadow Wall': 38,
  'Dark Mind': 45,
  'Dark Missionary': 66,
  'The Blackest Night': 70,
  'Oblation': 82,
  'Shadowed Vigil': 92,

  // ── Gunbreaker ──────────────────────────────────────────────────────────
  'Camouflage': 6,
  'Nebula': 38,
  'Aurora': 45,
  'Heart of Stone': 68,
  'Heart of Light': 64,
  'Heart of Corundum': 82,
  'Great Nebula': 92,

  // ── White Mage ──────────────────────────────────────────────────────────
  'Cure': 2,
  'Medica': 10,
  'Cure II': 30,
  'Regen': 35,
  'Cure III': 40,
  'Benediction': 50,
  'Medica II': 50,
  'Afflatus Solace': 52,
  'Asylum': 52,
  'Assize': 56,
  'Tetragrammaton': 60,
  'Divine Benison': 66,
  'Plenary Indulgence': 70,
  'Temperance': 80,
  'Aquaveil': 86,
  'Liturgy of the Bell(Time Lapse: Stack 1)': 90,
  'Liturgy of the Bell(Time Lapse: Stack 2)': 90,
  'Liturgy of the Bell(Time Lapse: Stack 3)': 90,
  'Liturgy of the Bell(Time Lapse: Stack 4)': 90,
  'Liturgy of the Bell(Time Lapse: Stack 5)': 90,
  'Liturgy of the Bell(damage trigger)': 90,
  'Medica III': 96,
  'Divine Caress': 100,
  'Afflatus Rapture': 76,

  // ── Scholar ─────────────────────────────────────────────────────────────
  'Physick': 4,
  'Whispering Dawn': 20,
  'Adloquium': 30,
  'Succor': 35,
  'Fey Illumination': 40,
  'Dissipation': 40,
  'Aetherflow': 45,
  'Lustrate': 45,
  'Sacred Soil': 50,
  'Indomitability': 52,
  'Deployment Tactics': 56,
  'Excogitation': 62,
  'Fey Union': 70,
  'Recitation': 74,
  'Fey Blessing': 76,
  'Summon Seraph': 80,
  'Consolation': 80,
  'Protraction': 86,
  'Expedient': 90,
  'Concitation': 96,
  'Seraphism': 100,
  'Manifestation': 100,
  'Accession': 100,

  // ── Astrologian ─────────────────────────────────────────────────────────
  'Benefic': 2,
  'Helios': 10,
  'Benefic II': 26,
  'Aspected Benefic': 34,
  'Aspected Helios': 40,
  'The Arrow': 40,
  'The Bole': 40,
  'The Ewer': 40,
  'The Spire': 40,
  'Essential Dignity(minimum)': 15,
  'Essential Dignity(maximum)': 15,
  'Collective Unconscious': 58,
  'Celestial Opposition': 60,
  'Earthly Star(Earthly Dominance)': 62,
  'Earthly Star(Giant Dominance)': 62,
  'Celestial Intersection': 74,
  'Horoscope': 76,
  'Horoscope Helios': 76,
  'Neutral Sect': 80,
  'Lady of Crowns': 70,
  'Astral Draw': 70,
  'Umbral Draw': 70,
  'Exaltation': 86,
  'Macrocosmos(50% damage received)': 90,
  'Macrocosmos(minimum)': 90,
  "Earth's Reply": 90,
  'Sun Sign': 100,
  'Helios Conjunction': 96,

  // ── Sage ────────────────────────────────────────────────────────────────
  'Diagnosis': 2,
  'Prognosis': 10,
  'Eukrasian Diagnosis': 30,
  'Eukrasian Prognosis': 30,
  'Druochole': 45,
  'Kerachole': 50,
  'Ixochole': 52,
  'Zoe': 56,
  'Taurochole': 62,
  'Toxikon': 66,
  'Rhizomata': 74,
  'Holos': 76,
  'Panhaima': 80,
  'Panhaima(Time Lapse: Stack 1)': 80,
  'Panhaima(Time Lapse: Stack 2)': 80,
  'Panhaima(Time Lapse: Stack 3)': 80,
  'Panhaima(Time Lapse: Stack 4)': 80,
  'Panhaima(Time Lapse: Stack 5)': 80,
  'Haima': 70,
  'Haima(Time Lapse: Stack 1)': 70,
  'Haima(Time Lapse: Stack 2)': 70,
  'Haima(Time Lapse: Stack 3)': 70,
  'Haima(Time Lapse: Stack 4)': 70,
  'Haima(Time Lapse: Stack 5)': 70,
  'Physis II': 60,
  'Pepsis(Eukrasian Diagnosis)': 58,
  'Pepsis(Eukrasian Prognosis)': 58,
  'Pneuma': 90,
  'Eukrasian Prognosis II': 96,
  'Philosophia': 100,

  // ── Melee DPS role ───────────────────────────────────────────────────────
  'Feint': 22,
  'Mantra': 42,
  'Riddle of Earth': 72,
  'Arcane Crest': 40,

  // ── Physical Ranged DPS ──────────────────────────────────────────────────
  'Tactician': 56,
  'Shield Samba': 56,
  'Troubadour': 62,
  'Dismantle': 62,
  "Nature's Minne": 66,
  'Improvised Finish': 50,
  'Improvised Finish(Rising Rhythm 0)': 50,
  'Improvised Finish(Rising Rhythm 1)': 50,
  'Improvised Finish(Rising Rhythm 2)': 50,
  'Improvised Finish(Rising Rhythm 3)': 50,
  'Improvised Finish(Rising Rhythm 4)': 50,

  // ── Caster DPS ───────────────────────────────────────────────────────────
  'Addle': 8,
  'Magick Barrier': 86,
  'Tempera Coat': 10,
  'Tempera Grassa': 88,
};

/**
 * Returns the level requirement for a skill by its English name.
 * Defaults to 1 if not found.
 */
export function getSkillLevelReq(nameEN: string | null): number {
  if (!nameEN) return 1;
  return SKILL_LEVEL_REQUIREMENTS[nameEN] ?? 1;
}
