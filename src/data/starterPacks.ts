/**
 * Hardcoded starter vocabulary packs for when the AI backend is unavailable.
 * Each pack contains 20 high-frequency everyday words for beginner learners.
 */

import type { WordInput } from '@/types/word'

export interface StarterPack {
  languageCode: string
  languageName: string
  words: WordInput[]
}

const spanish: WordInput[] = [
  { lemma: 'hola', translation: 'hello', part_of_speech: 'interjection', example_sentence: 'Hola, ¿cómo estás?' },
  { lemma: 'gracias', translation: 'thank you', part_of_speech: 'interjection', example_sentence: 'Muchas gracias por tu ayuda.' },
  { lemma: 'sí', translation: 'yes', part_of_speech: 'adverb', example_sentence: 'Sí, estoy de acuerdo.' },
  { lemma: 'no', translation: 'no', part_of_speech: 'adverb', example_sentence: 'No quiero ir.' },
  { lemma: 'por favor', translation: 'please', part_of_speech: 'phrase', example_sentence: 'Un café, por favor.' },
  { lemma: 'agua', translation: 'water', part_of_speech: 'noun', example_sentence: 'Quiero un vaso de agua.' },
  { lemma: 'comida', translation: 'food', part_of_speech: 'noun', example_sentence: 'La comida está deliciosa.' },
  { lemma: 'casa', translation: 'house', part_of_speech: 'noun', example_sentence: 'Mi casa es grande.' },
  { lemma: 'bueno', translation: 'good', part_of_speech: 'adjective', example_sentence: 'Este libro es muy bueno.' },
  { lemma: 'malo', translation: 'bad', part_of_speech: 'adjective', example_sentence: 'El tiempo está malo hoy.' },
  { lemma: 'grande', translation: 'big', part_of_speech: 'adjective', example_sentence: 'La ciudad es muy grande.' },
  { lemma: 'pequeño', translation: 'small', part_of_speech: 'adjective', example_sentence: 'Tengo un gato pequeño.' },
  { lemma: 'comer', translation: 'to eat', part_of_speech: 'verb', example_sentence: 'Vamos a comer juntos.' },
  { lemma: 'beber', translation: 'to drink', part_of_speech: 'verb', example_sentence: 'Me gusta beber café.' },
  { lemma: 'ir', translation: 'to go', part_of_speech: 'verb', example_sentence: 'Quiero ir al parque.' },
  { lemma: 'hablar', translation: 'to speak', part_of_speech: 'verb', example_sentence: '¿Puedes hablar más despacio?' },
  { lemma: 'amigo', translation: 'friend', part_of_speech: 'noun', example_sentence: 'Él es mi mejor amigo.' },
  { lemma: 'día', translation: 'day', part_of_speech: 'noun', example_sentence: 'Hoy es un buen día.' },
  { lemma: 'tiempo', translation: 'time / weather', part_of_speech: 'noun', example_sentence: 'No tengo mucho tiempo.' },
  { lemma: 'trabajo', translation: 'work', part_of_speech: 'noun', example_sentence: 'El trabajo es interesante.' },
]

const french: WordInput[] = [
  { lemma: 'bonjour', translation: 'hello / good day', part_of_speech: 'interjection', example_sentence: 'Bonjour, comment allez-vous ?' },
  { lemma: 'merci', translation: 'thank you', part_of_speech: 'interjection', example_sentence: 'Merci beaucoup pour votre aide.' },
  { lemma: 'oui', translation: 'yes', part_of_speech: 'adverb', example_sentence: 'Oui, je suis d\'accord.' },
  { lemma: 'non', translation: 'no', part_of_speech: 'adverb', example_sentence: 'Non, je ne veux pas.' },
  { lemma: 's\'il vous plaît', translation: 'please', part_of_speech: 'phrase', example_sentence: 'Un café, s\'il vous plaît.' },
  { lemma: 'eau', translation: 'water', part_of_speech: 'noun', example_sentence: 'Je voudrais un verre d\'eau.' },
  { lemma: 'nourriture', translation: 'food', part_of_speech: 'noun', example_sentence: 'La nourriture est excellente.' },
  { lemma: 'maison', translation: 'house', part_of_speech: 'noun', example_sentence: 'Ma maison est grande.' },
  { lemma: 'bon', translation: 'good', part_of_speech: 'adjective', example_sentence: 'Ce livre est très bon.' },
  { lemma: 'mauvais', translation: 'bad', part_of_speech: 'adjective', example_sentence: 'Le temps est mauvais aujourd\'hui.' },
  { lemma: 'grand', translation: 'big / tall', part_of_speech: 'adjective', example_sentence: 'La ville est très grande.' },
  { lemma: 'petit', translation: 'small', part_of_speech: 'adjective', example_sentence: 'J\'ai un petit chat.' },
  { lemma: 'manger', translation: 'to eat', part_of_speech: 'verb', example_sentence: 'Nous allons manger ensemble.' },
  { lemma: 'boire', translation: 'to drink', part_of_speech: 'verb', example_sentence: 'J\'aime boire du café.' },
  { lemma: 'aller', translation: 'to go', part_of_speech: 'verb', example_sentence: 'Je veux aller au parc.' },
  { lemma: 'parler', translation: 'to speak', part_of_speech: 'verb', example_sentence: 'Pouvez-vous parler plus lentement ?' },
  { lemma: 'ami', translation: 'friend', part_of_speech: 'noun', example_sentence: 'Il est mon meilleur ami.' },
  { lemma: 'jour', translation: 'day', part_of_speech: 'noun', example_sentence: 'C\'est un beau jour.' },
  { lemma: 'temps', translation: 'time / weather', part_of_speech: 'noun', example_sentence: 'Je n\'ai pas beaucoup de temps.' },
  { lemma: 'travail', translation: 'work', part_of_speech: 'noun', example_sentence: 'Le travail est intéressant.' },
]

const german: WordInput[] = [
  { lemma: 'hallo', translation: 'hello', part_of_speech: 'interjection', example_sentence: 'Hallo, wie geht es dir?' },
  { lemma: 'danke', translation: 'thank you', part_of_speech: 'interjection', example_sentence: 'Vielen Dank für deine Hilfe.' },
  { lemma: 'ja', translation: 'yes', part_of_speech: 'adverb', example_sentence: 'Ja, ich bin einverstanden.' },
  { lemma: 'nein', translation: 'no', part_of_speech: 'adverb', example_sentence: 'Nein, ich möchte nicht.' },
  { lemma: 'bitte', translation: 'please', part_of_speech: 'adverb', example_sentence: 'Einen Kaffee, bitte.' },
  { lemma: 'Wasser', translation: 'water', part_of_speech: 'noun', example_sentence: 'Ich möchte ein Glas Wasser.' },
  { lemma: 'Essen', translation: 'food', part_of_speech: 'noun', example_sentence: 'Das Essen ist lecker.' },
  { lemma: 'Haus', translation: 'house', part_of_speech: 'noun', example_sentence: 'Mein Haus ist groß.' },
  { lemma: 'gut', translation: 'good', part_of_speech: 'adjective', example_sentence: 'Das Buch ist sehr gut.' },
  { lemma: 'schlecht', translation: 'bad', part_of_speech: 'adjective', example_sentence: 'Das Wetter ist schlecht heute.' },
  { lemma: 'groß', translation: 'big / tall', part_of_speech: 'adjective', example_sentence: 'Die Stadt ist sehr groß.' },
  { lemma: 'klein', translation: 'small', part_of_speech: 'adjective', example_sentence: 'Ich habe eine kleine Katze.' },
  { lemma: 'essen', translation: 'to eat', part_of_speech: 'verb', example_sentence: 'Wir gehen zusammen essen.' },
  { lemma: 'trinken', translation: 'to drink', part_of_speech: 'verb', example_sentence: 'Ich trinke gern Kaffee.' },
  { lemma: 'gehen', translation: 'to go', part_of_speech: 'verb', example_sentence: 'Ich will in den Park gehen.' },
  { lemma: 'sprechen', translation: 'to speak', part_of_speech: 'verb', example_sentence: 'Können Sie bitte langsamer sprechen?' },
  { lemma: 'Freund', translation: 'friend', part_of_speech: 'noun', example_sentence: 'Er ist mein bester Freund.' },
  { lemma: 'Tag', translation: 'day', part_of_speech: 'noun', example_sentence: 'Heute ist ein schöner Tag.' },
  { lemma: 'Zeit', translation: 'time', part_of_speech: 'noun', example_sentence: 'Ich habe nicht viel Zeit.' },
  { lemma: 'Arbeit', translation: 'work', part_of_speech: 'noun', example_sentence: 'Die Arbeit ist interessant.' },
]

const italian: WordInput[] = [
  { lemma: 'ciao', translation: 'hello / goodbye', part_of_speech: 'interjection', example_sentence: 'Ciao, come stai?' },
  { lemma: 'grazie', translation: 'thank you', part_of_speech: 'interjection', example_sentence: 'Grazie mille per il tuo aiuto.' },
  { lemma: 'sì', translation: 'yes', part_of_speech: 'adverb', example_sentence: 'Sì, sono d\'accordo.' },
  { lemma: 'no', translation: 'no', part_of_speech: 'adverb', example_sentence: 'No, non voglio andare.' },
  { lemma: 'per favore', translation: 'please', part_of_speech: 'phrase', example_sentence: 'Un caffè, per favore.' },
  { lemma: 'acqua', translation: 'water', part_of_speech: 'noun', example_sentence: 'Vorrei un bicchiere d\'acqua.' },
  { lemma: 'cibo', translation: 'food', part_of_speech: 'noun', example_sentence: 'Il cibo è delizioso.' },
  { lemma: 'casa', translation: 'house', part_of_speech: 'noun', example_sentence: 'La mia casa è grande.' },
  { lemma: 'buono', translation: 'good', part_of_speech: 'adjective', example_sentence: 'Questo libro è molto buono.' },
  { lemma: 'cattivo', translation: 'bad', part_of_speech: 'adjective', example_sentence: 'Il tempo è cattivo oggi.' },
  { lemma: 'grande', translation: 'big', part_of_speech: 'adjective', example_sentence: 'La città è molto grande.' },
  { lemma: 'piccolo', translation: 'small', part_of_speech: 'adjective', example_sentence: 'Ho un gatto piccolo.' },
  { lemma: 'mangiare', translation: 'to eat', part_of_speech: 'verb', example_sentence: 'Andiamo a mangiare insieme.' },
  { lemma: 'bere', translation: 'to drink', part_of_speech: 'verb', example_sentence: 'Mi piace bere il caffè.' },
  { lemma: 'andare', translation: 'to go', part_of_speech: 'verb', example_sentence: 'Voglio andare al parco.' },
  { lemma: 'parlare', translation: 'to speak', part_of_speech: 'verb', example_sentence: 'Puoi parlare più lentamente?' },
  { lemma: 'amico', translation: 'friend', part_of_speech: 'noun', example_sentence: 'Lui è il mio migliore amico.' },
  { lemma: 'giorno', translation: 'day', part_of_speech: 'noun', example_sentence: 'Oggi è una bella giornata.' },
  { lemma: 'tempo', translation: 'time / weather', part_of_speech: 'noun', example_sentence: 'Non ho molto tempo.' },
  { lemma: 'lavoro', translation: 'work', part_of_speech: 'noun', example_sentence: 'Il lavoro è interessante.' },
]

const portuguese: WordInput[] = [
  { lemma: 'olá', translation: 'hello', part_of_speech: 'interjection', example_sentence: 'Olá, como você está?' },
  { lemma: 'obrigado', translation: 'thank you', part_of_speech: 'interjection', example_sentence: 'Muito obrigado pela sua ajuda.' },
  { lemma: 'sim', translation: 'yes', part_of_speech: 'adverb', example_sentence: 'Sim, eu concordo.' },
  { lemma: 'não', translation: 'no', part_of_speech: 'adverb', example_sentence: 'Não, eu não quero ir.' },
  { lemma: 'por favor', translation: 'please', part_of_speech: 'phrase', example_sentence: 'Um café, por favor.' },
  { lemma: 'água', translation: 'water', part_of_speech: 'noun', example_sentence: 'Eu quero um copo de água.' },
  { lemma: 'comida', translation: 'food', part_of_speech: 'noun', example_sentence: 'A comida está deliciosa.' },
  { lemma: 'casa', translation: 'house', part_of_speech: 'noun', example_sentence: 'Minha casa é grande.' },
  { lemma: 'bom', translation: 'good', part_of_speech: 'adjective', example_sentence: 'Este livro é muito bom.' },
  { lemma: 'mau', translation: 'bad', part_of_speech: 'adjective', example_sentence: 'O tempo está mau hoje.' },
  { lemma: 'grande', translation: 'big', part_of_speech: 'adjective', example_sentence: 'A cidade é muito grande.' },
  { lemma: 'pequeno', translation: 'small', part_of_speech: 'adjective', example_sentence: 'Eu tenho um gato pequeno.' },
  { lemma: 'comer', translation: 'to eat', part_of_speech: 'verb', example_sentence: 'Vamos comer juntos.' },
  { lemma: 'beber', translation: 'to drink', part_of_speech: 'verb', example_sentence: 'Eu gosto de beber café.' },
  { lemma: 'ir', translation: 'to go', part_of_speech: 'verb', example_sentence: 'Eu quero ir ao parque.' },
  { lemma: 'falar', translation: 'to speak', part_of_speech: 'verb', example_sentence: 'Pode falar mais devagar?' },
  { lemma: 'amigo', translation: 'friend', part_of_speech: 'noun', example_sentence: 'Ele é meu melhor amigo.' },
  { lemma: 'dia', translation: 'day', part_of_speech: 'noun', example_sentence: 'Hoje é um bom dia.' },
  { lemma: 'tempo', translation: 'time / weather', part_of_speech: 'noun', example_sentence: 'Não tenho muito tempo.' },
  { lemma: 'trabalho', translation: 'work', part_of_speech: 'noun', example_sentence: 'O trabalho é interessante.' },
]

const japanese: WordInput[] = [
  { lemma: 'こんにちは', translation: 'hello', part_of_speech: 'interjection', example_sentence: 'こんにちは、お元気ですか？' },
  { lemma: 'ありがとう', translation: 'thank you', part_of_speech: 'interjection', example_sentence: '手伝ってくれてありがとう。' },
  { lemma: 'はい', translation: 'yes', part_of_speech: 'interjection', example_sentence: 'はい、そうです。' },
  { lemma: 'いいえ', translation: 'no', part_of_speech: 'interjection', example_sentence: 'いいえ、違います。' },
  { lemma: 'お願いします', translation: 'please', part_of_speech: 'phrase', example_sentence: 'コーヒーをお願いします。' },
  { lemma: '水', translation: 'water', part_of_speech: 'noun', example_sentence: '水を一杯ください。' },
  { lemma: '食べ物', translation: 'food', part_of_speech: 'noun', example_sentence: 'この食べ物はおいしいです。' },
  { lemma: '家', translation: 'house / home', part_of_speech: 'noun', example_sentence: '私の家は大きいです。' },
  { lemma: 'いい', translation: 'good', part_of_speech: 'adjective', example_sentence: 'この本はとてもいいです。' },
  { lemma: '悪い', translation: 'bad', part_of_speech: 'adjective', example_sentence: '今日は天気が悪いです。' },
  { lemma: '大きい', translation: 'big', part_of_speech: 'adjective', example_sentence: 'この町はとても大きいです。' },
  { lemma: '小さい', translation: 'small', part_of_speech: 'adjective', example_sentence: '小さい猫がいます。' },
  { lemma: '食べる', translation: 'to eat', part_of_speech: 'verb', example_sentence: '一緒に食べましょう。' },
  { lemma: '飲む', translation: 'to drink', part_of_speech: 'verb', example_sentence: 'コーヒーを飲むのが好きです。' },
  { lemma: '行く', translation: 'to go', part_of_speech: 'verb', example_sentence: '公園に行きたいです。' },
  { lemma: '話す', translation: 'to speak', part_of_speech: 'verb', example_sentence: 'もっとゆっくり話してください。' },
  { lemma: '友達', translation: 'friend', part_of_speech: 'noun', example_sentence: '彼は私の一番の友達です。' },
  { lemma: '日', translation: 'day', part_of_speech: 'noun', example_sentence: '今日はいい日です。' },
  { lemma: '時間', translation: 'time', part_of_speech: 'noun', example_sentence: '時間がありません。' },
  { lemma: '仕事', translation: 'work / job', part_of_speech: 'noun', example_sentence: '仕事は面白いです。' },
]

export const STARTER_PACKS: StarterPack[] = [
  { languageCode: 'es', languageName: 'Spanish', words: spanish },
  { languageCode: 'fr', languageName: 'French', words: french },
  { languageCode: 'de', languageName: 'German', words: german },
  { languageCode: 'it', languageName: 'Italian', words: italian },
  { languageCode: 'pt', languageName: 'Portuguese', words: portuguese },
  { languageCode: 'ja', languageName: 'Japanese', words: japanese },
]

/**
 * Get the starter pack for a given language code.
 * Returns undefined if no pack exists for that language.
 */
export function getStarterPack(languageCode: string): StarterPack | undefined {
  return STARTER_PACKS.find(p => p.languageCode === languageCode)
}
