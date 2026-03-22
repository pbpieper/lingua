import { useMemo } from 'react'
import { motion } from 'framer-motion'

// ─── Cultural Tips Data ──────────────────────────────────────────

interface Tip {
  text: string
  category: 'greeting' | 'etiquette' | 'food' | 'celebration' | 'language' | 'custom'
}

const TIPS: Record<string, Tip[]> = {
  es: [
    { text: 'In Spain, people typically greet friends with two kisses on the cheek (one on each side).', category: 'greeting' },
    { text: 'Dinner in Spain is usually eaten between 9 and 10 PM, much later than in many other countries.', category: 'food' },
    { text: 'The siesta tradition is fading in cities, but many shops still close from 2-5 PM in smaller towns.', category: 'custom' },
    { text: '"Sobremesa" is the time spent chatting at the table after a meal. It can last hours and is treasured.', category: 'etiquette' },
    { text: 'In Latin America, personal space is smaller. Standing close during conversation is normal and friendly.', category: 'etiquette' },
    { text: '"Mañana" does not always literally mean "tomorrow" — it often means "sometime later, not now."', category: 'language' },
    { text: 'In Mexico, Dia de los Muertos celebrates deceased loved ones with altars, food, and marigolds.', category: 'celebration' },
    { text: 'Spaniards use "tú" (informal you) much more freely than Latin Americans, even with strangers.', category: 'language' },
    { text: 'Tapas culture encourages sharing small plates. It is rude to eat from your own plate without offering.', category: 'food' },
    { text: 'In many Spanish-speaking countries, the surname includes both parents\' last names.', category: 'custom' },
  ],
  fr: [
    { text: 'The "bise" (cheek kiss greeting) varies by region — from 1 to 4 kisses depending on where you are.', category: 'greeting' },
    { text: 'In France, saying "Bonjour" when entering a shop is expected. Not doing so is considered rude.', category: 'greeting' },
    { text: 'French meals traditionally have multiple courses: entrée (starter), plat (main), fromage (cheese), dessert.', category: 'food' },
    { text: 'The French use "vous" (formal you) with strangers and colleagues. Switching to "tu" marks a shift in relationship.', category: 'language' },
    { text: 'August is sacred vacation time in France. Many businesses close as people head to the coast or countryside.', category: 'custom' },
    { text: 'Bread is placed directly on the table, not on the plate. This is normal French table etiquette.', category: 'etiquette' },
    { text: '"Apéro" (pre-dinner drinks with snacks) is a beloved daily ritual, especially in summer.', category: 'food' },
    { text: 'French people rarely say "je t\'aime" casually. It carries deep romantic weight.', category: 'language' },
  ],
  de: [
    { text: 'Germans value punctuality highly. Arriving even 5 minutes late to a meeting is considered disrespectful.', category: 'etiquette' },
    { text: '"Feierabend" is the cherished concept of the end of the work day — Germans protect their personal time.', category: 'custom' },
    { text: 'When clinking glasses in Germany, always make eye contact. Not doing so supposedly brings 7 years of bad luck.', category: 'etiquette' },
    { text: 'Sundays in Germany are "Ruhetag" (quiet days). Most shops are closed and noise (like mowing) is frowned upon.', category: 'custom' },
    { text: 'German compound words can be incredibly long. "Rechtsschutzversicherungsgesellschaften" means "legal protection insurance companies."', category: 'language' },
    { text: 'Bread is serious business in Germany. There are over 3,000 registered types of bread.', category: 'food' },
    { text: 'Germans often split the bill exactly ("getrennte Rechnung") rather than one person paying.', category: 'etiquette' },
    { text: 'Karneval season is huge in Cologne and the Rhineland — people dress up and celebrate for weeks.', category: 'celebration' },
  ],
  ar: [
    { text: 'Always greet with "As-salamu alaykum" (peace be upon you) before starting a conversation.', category: 'greeting' },
    { text: 'Arabic is written right-to-left and has 28 letters, each with up to 4 forms depending on position.', category: 'language' },
    { text: 'Hospitality is paramount in Arab culture. Refusing offered food or drink can be seen as offensive.', category: 'etiquette' },
    { text: 'The left hand is considered unclean. Always eat, shake hands, and pass items with the right hand.', category: 'etiquette' },
    { text: 'Arabic coffee (qahwa) is served as a sign of welcome. The cup is refilled until you shake it to signal "enough."', category: 'food' },
    { text: 'During Ramadan, Muslims fast from dawn to sunset. Non-Muslims should avoid eating in public out of respect.', category: 'celebration' },
  ],
  ja: [
    { text: 'Bowing is the primary greeting in Japan. The deeper the bow, the more respect or formality conveyed.', category: 'greeting' },
    { text: 'In Japan, slurping noodles is not rude — it shows you are enjoying the meal.', category: 'food' },
    { text: 'Japanese uses three writing systems: hiragana, katakana, and kanji. Students learn about 2,136 kanji.', category: 'language' },
    { text: 'Taking off your shoes before entering a home is mandatory. There are often separate slippers for the bathroom.', category: 'etiquette' },
    { text: '"Omotenashi" is the Japanese concept of wholehearted hospitality — anticipating needs before they are expressed.', category: 'custom' },
    { text: 'Tipping is not practiced in Japan and can even be considered rude.', category: 'etiquette' },
    { text: 'Keigo (honorific language) has multiple levels of politeness. Using the wrong level can cause embarrassment.', category: 'language' },
    { text: 'Hanami (flower viewing) season is a cherished tradition when cherry blossoms bloom in spring.', category: 'celebration' },
  ],
  ko: [
    { text: 'Age hierarchy is deeply embedded in Korean culture. Always ask someone\'s age to know how to address them.', category: 'etiquette' },
    { text: 'Korean has its own alphabet, Hangul, invented in 1443. It was designed to be easy to learn.', category: 'language' },
    { text: 'When receiving something from an elder, use both hands. This applies to business cards, drinks, and gifts.', category: 'etiquette' },
    { text: 'Kimchi is served with nearly every meal in Korea, and every family has their own recipe.', category: 'food' },
    { text: '"Nunchi" is the Korean art of reading the room — understanding unspoken feelings and social dynamics.', category: 'custom' },
    { text: 'Chuseok (Korean Thanksgiving) is one of the biggest holidays. Families gather and pay respect to ancestors.', category: 'celebration' },
    { text: 'The number 4 is unlucky in Korea (it sounds like "death"). Many buildings skip the 4th floor.', category: 'custom' },
    { text: 'Korean uses speech levels — there are 7 levels of politeness depending on the social context.', category: 'language' },
  ],
}

const CATEGORY_ICONS: Record<string, string> = {
  greeting: '\uD83D\uDC4B',
  etiquette: '\uD83C\uDF93',
  food: '\uD83C\uDF7D\uFE0F',
  celebration: '\uD83C\uDF89',
  language: '\uD83D\uDDE3\uFE0F',
  custom: '\uD83C\uDF0D',
}

const FLAG_ICONS: Record<string, string> = {
  es: '\uD83C\uDDEA\uD83C\uDDF8',
  fr: '\uD83C\uDDEB\uD83C\uDDF7',
  de: '\uD83C\uDDE9\uD83C\uDDEA',
  ar: '\uD83C\uDDF8\uD83C\uDDE6',
  ja: '\uD83C\uDDEF\uD83C\uDDF5',
  ko: '\uD83C\uDDF0\uD83C\uDDF7',
}

// ─── Deterministic daily pick (different from Word of the Day) ────

function getDailyTipIndex(): number {
  // Use a different seed offset than Word of the Day
  const now = new Date()
  return Math.floor(now.getTime() / 86400000) + 42 // offset so it differs from WotD
}

// ─── Component ────────────────────────────────────────────────────

interface Props {
  targetLanguage: string
}

export function CulturalTip({ targetLanguage }: Props) {
  const tip = useMemo(() => {
    const pool = TIPS[targetLanguage]
    if (!pool || pool.length === 0) return null
    const idx = getDailyTipIndex() % pool.length
    return pool[idx]
  }, [targetLanguage])

  if (!tip) return null

  const flag = FLAG_ICONS[targetLanguage] ?? '\uD83C\uDF10'
  const catIcon = CATEGORY_ICONS[tip.category] ?? '\uD83D\uDCA1'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{flag}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Did you know?
        </h3>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition-shadow hover:shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5 shrink-0">{catIcon}</span>
          <div className="min-w-0">
            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
              {tip.text}
            </p>
            <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] capitalize">
              {tip.category}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
