import { slugify } from '~/components/website-builder/data/wizard'

export type BlogStatus = 'draft' | 'published'

export interface BlogTranslation {
  title: string
  excerpt: string
  body: string
}

export interface BlogCover {
  /** A data URL: the AI picture is an SVG, an upload is read to a data URL. */
  url: string
  name: string
  source: 'ai' | 'upload'
}

/** One post, written once per site language. `topic` is what the AI drafts from. */
export interface BlogPost {
  id: string
  status: BlogStatus
  topic: string
  aiGenerated: boolean
  cover?: BlogCover
  createdAt: string
  updatedAt: string
  translations: Record<string, BlogTranslation>
}

// Mock engine: a fixed template per language, filled with the topic and the site name. Nothing is sent anywhere.
interface Copy {
  title: (topic: string) => string
  excerpt: (topic: string, site: string) => string
  paragraphs: ((topic: string, site: string) => string)[]
}

const COPY: Record<string, Copy> = {
  en: {
    title: t => `${t}: what to know before you book`,
    excerpt: (t, s) => `Everything our guests ask us about ${t.toLowerCase()}, answered by the team at ${s}.`,
    paragraphs: [
      (t, s) => `Planning a stay at ${s}? ${t} is one of the questions we hear most, so we put the answers in one place.`,
      t => `Start with the basics: ${t.toLowerCase()} depends on the season, how long you stay and who you travel with. A little planning goes a long way.`,
      (_t, s) => `Our team at ${s} is happy to help with local tips, transfers and anything else. Book direct for the best rate and a personal welcome.`,
    ],
  },
  de: {
    title: t => `${t}: Das sollten Sie vor der Buchung wissen`,
    excerpt: (t, s) => `Alles, was unsere Gäste zu ${t} fragen, beantwortet vom Team von ${s}.`,
    paragraphs: [
      (t, s) => `Sie planen einen Aufenthalt in ${s}? ${t} gehört zu den häufigsten Fragen, deshalb finden Sie die Antworten hier an einem Ort.`,
      t => `Zunächst die Grundlagen: ${t} hängt von der Jahreszeit, der Aufenthaltsdauer und Ihren Mitreisenden ab. Etwas Planung hilft sehr.`,
      (_t, s) => `Das Team von ${s} hilft Ihnen gern mit Tipps vor Ort und Transfers. Buchen Sie direkt für den besten Preis und einen persönlichen Empfang.`,
    ],
  },
  fr: {
    title: t => `${t} : ce qu'il faut savoir avant de réserver`,
    excerpt: (t, s) => `Tout ce que nos hôtes demandent sur ${t.toLowerCase()}, expliqué par l'équipe de ${s}.`,
    paragraphs: [
      (t, s) => `Vous préparez un séjour à ${s} ? ${t} fait partie des questions les plus fréquentes, nous avons donc réuni les réponses ici.`,
      t => `Commençons par l'essentiel : ${t.toLowerCase()} dépend de la saison, de la durée du séjour et de vos compagnons de voyage.`,
      (_t, s) => `L'équipe de ${s} vous conseille volontiers sur les adresses locales et les transferts. Réservez en direct pour le meilleur tarif.`,
    ],
  },
  it: {
    title: t => `${t}: cosa sapere prima di prenotare`,
    excerpt: (t, s) => `Tutto quello che i nostri ospiti chiedono su ${t.toLowerCase()}, spiegato dal team di ${s}.`,
    paragraphs: [
      (t, s) => `State organizzando un soggiorno a ${s}? ${t} è una delle domande più frequenti, per questo abbiamo raccolto le risposte qui.`,
      t => `Partiamo dalle basi: ${t.toLowerCase()} dipende dalla stagione, dalla durata del soggiorno e da chi viaggia con voi.`,
      (_t, s) => `Il team di ${s} è felice di consigliarvi luoghi, trasferimenti e molto altro. Prenotate direttamente per la tariffa migliore.`,
    ],
  },
  es: {
    title: t => `${t}: lo que debe saber antes de reservar`,
    excerpt: (t, s) => `Todo lo que nuestros huéspedes preguntan sobre ${t.toLowerCase()}, respondido por el equipo de ${s}.`,
    paragraphs: [
      (t, s) => `¿Planea una estancia en ${s}? ${t} es una de las preguntas más frecuentes, así que reunimos las respuestas aquí.`,
      t => `Empecemos por lo básico: ${t.toLowerCase()} depende de la temporada, de la duración de la estancia y de con quién viaje.`,
      (_t, s) => `El equipo de ${s} le ayuda con recomendaciones locales y traslados. Reserve directamente para obtener la mejor tarifa.`,
    ],
  },
  nl: {
    title: t => `${t}: wat u moet weten voor u boekt`,
    excerpt: (t, s) => `Alles wat onze gasten vragen over ${t.toLowerCase()}, beantwoord door het team van ${s}.`,
    paragraphs: [
      (t, s) => `Plant u een verblijf bij ${s}? ${t} hoort bij de meest gestelde vragen, dus we zetten de antwoorden op één plek.`,
      t => `Eerst de basis: ${t.toLowerCase()} hangt af van het seizoen, de verblijfsduur en met wie u reist.`,
      (_t, s) => `Het team van ${s} helpt graag met lokale tips en transfers. Boek rechtstreeks voor het beste tarief.`,
    ],
  },
  id: {
    title: t => `${t}: yang perlu Anda tahu sebelum memesan`,
    excerpt: (t, s) => `Semua yang sering ditanyakan tamu kami tentang ${t.toLowerCase()}, dijawab oleh tim ${s}.`,
    paragraphs: [
      (t, s) => `Merencanakan menginap di ${s}? ${t} adalah salah satu pertanyaan yang paling sering kami terima, jadi jawabannya kami kumpulkan di sini.`,
      t => `Mulai dari dasar: ${t.toLowerCase()} bergantung pada musim, lama menginap, dan siapa yang bepergian bersama Anda.`,
      (_t, s) => `Tim ${s} siap membantu dengan tips lokal dan antar jemput. Pesan langsung untuk harga terbaik dan sambutan pribadi.`,
    ],
  },
  zh: {
    title: t => `${t}：预订前您需要了解的事`,
    excerpt: (t, s) => `住客最常问的关于${t}的问题，由 ${s} 团队为您解答。`,
    paragraphs: [
      (t, s) => `正在计划入住 ${s}？${t}是我们最常被问到的问题之一，所以我们把答案整理在这里。`,
      t => `先从基础说起：${t}取决于季节、停留天数以及同行的人。稍作规划会有很大帮助。`,
      (_t, s) => `${s} 团队很乐意提供当地建议和接送服务。直接预订可享最优价格。`,
    ],
  },
}

export function draftTranslation(topic: string, siteName: string, language: string): BlogTranslation {
  const copy = COPY[language] ?? COPY.en!
  const name = siteName.trim() || 'our villa'
  const subject = topic.trim() || 'your stay'
  const capital = subject.charAt(0).toUpperCase() + subject.slice(1)
  return {
    title: copy.title(capital),
    excerpt: copy.excerpt(capital, name),
    body: copy.paragraphs.map(p => p(capital, name)).join('\n\n'),
  }
}

function hash(text: string): number {
  let h = 0
  for (const ch of text)
    h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/**
 * The AI picture. Mock engine: a landscape drawn in SVG (sky, sun, hills, waves) whose colors come from the topic,
 * and from `seed` so "Generate again" gives a different one. Nothing is sent anywhere.
 */
export function generateCover(topic: string, seed = 0): BlogCover {
  const h = hash(`${topic.trim().toLowerCase()}:${seed}`)
  const hue = h % 360
  const sky = `hsl(${hue} 70% 78%)`
  const sky2 = `hsl(${(hue + 40) % 360} 75% 90%)`
  const sun = `hsl(${(hue + 180) % 360} 85% 70%)`
  const hill = `hsl(${(hue + 120) % 360} 35% 38%)`
  const hill2 = `hsl(${(hue + 150) % 360} 40% 28%)`
  const sea = `hsl(${(hue + 200) % 360} 55% 45%)`
  const sx = 120 + (h >> 3) % 560
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/><circle cx="${sx}" cy="130" r="48" fill="${sun}"/><path d="M0 300 Q160 200 330 280 T640 250 T800 290 V450 H0Z" fill="${hill}"/><path d="M0 350 Q220 270 420 340 T800 330 V450 H0Z" fill="${hill2}"/><path d="M0 400 Q100 380 200 400 T400 400 T600 400 T800 400 V450 H0Z" fill="${sea}"/></svg>`
  return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, name: 'ai-cover.svg', source: 'ai' }
}

export function newPostId() {
  return `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function emptyPost(): BlogPost {
  const now = new Date().toISOString()
  return { id: newPostId(), status: 'draft', topic: '', aiGenerated: false, createdAt: now, updatedAt: now, translations: {} }
}

/** A post the AI wrote in every language the site has. */
export function generatePost(topic: string, siteName: string, languages: string[]): BlogPost {
  const now = new Date().toISOString()
  return {
    id: newPostId(),
    status: 'draft',
    topic: topic.trim(),
    aiGenerated: true,
    cover: generateCover(topic),
    createdAt: now,
    updatedAt: now,
    translations: Object.fromEntries(languages.map(code => [code, draftTranslation(topic, siteName, code)])),
  }
}

export function isTranslated(post: BlogPost, language: string) {
  const t = post.translations[language]
  return !!t && t.title.trim() !== '' && t.body.trim() !== ''
}

export const missingLanguages = (post: BlogPost, languages: string[]) => languages.filter(code => !isTranslated(post, code))

/** Title in the language asked for, else the default language, else the first one written. */
export function postTitle(post: BlogPost, language: string): string {
  const own = post.translations[language]?.title.trim()
  if (own)
    return own
  const first = Object.values(post.translations).find(t => t.title.trim())
  return first?.title ?? 'Untitled post'
}

export const postSlug = (post: BlogPost, language: string) => slugify(postTitle(post, language))

/** A post can go live once the default language is written. */
export const canPublish = (post: BlogPost, defaultLanguage: string) => isTranslated(post, defaultLanguage)
