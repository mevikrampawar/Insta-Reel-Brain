import { generateKeyPairSync } from 'node:crypto'
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const outdir = mkdtempSync(join(tmpdir(), 'ingest-test-'))
await build({
  entryPoints: ['worker/ingest.js', 'worker/apify.js', 'worker/firestore.js', 'worker/groq.js'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir,
  outExtension: { '.js': '.mjs' },
  logLevel: 'silent',
})

const { normalizeUrl, buildPlaceholderReelFields, processApifyRun } = await import(pathToFileURL(join(outdir, 'ingest.mjs')))
const { fetchApifyDataset } = await import(pathToFileURL(join(outdir, 'apify.mjs')))
const { createIngestJob, getIngestJob, createPlaceholderReel, updateReelDoc, findDocByField } = await import(pathToFileURL(join(outdir, 'firestore.mjs')))

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })

const env = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'svc@test-project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: pem,
  APIFY_API_TOKEN: 'apify-test-token',
  GROQ_API_KEY: 'groq-test-token',
  WORKER_URL: 'https://reel-brain-relay.example.workers.dev',
  FREE_REEL_LIMIT: 5,
}

const captured = { firestoreWrites: [], groqCalls: 0, apifyCalls: 0 }
const storedDocs = {}

const datasetItem = {
  id: 'REEL1',
  url: 'https://www.instagram.com/reel/REEL1/',
  type: 'video',
  caption: '5 AI tools to save hours. #aitools #productivity',
  ownerUsername: 'theai.coach',
  ownerFullName: 'The AI Coach',
  ownerIsVerified: true,
  likesCount: 1234,
  commentsCount: 56,
  videoPlayCount: 9900,
  thumbnailUrl: 'https://img/thumb.jpg',
  videoUrl: 'https://img/video.mp4',
  videoDurationSec: 45,
  dimensionsWidth: 1080,
  dimensionsHeight: 1920,
  hashtags: ['aitools', 'productivity'],
  mentions: ['@somebody'],
  musicInfo: { song_name: 'Epic Beat', artist_name: 'Artist' },
  taken_at: '2026-01-01T00:00:00Z',
  shortcode: 'REEL1',
  locationName: 'San Francisco',
  paidPartnership: false,
  is_ad: false,
  latestComments: [{ text: 'Great!', ownerUsername: 'u1', likesCount: 3 }],
  transcription: 'In this video I show five AI tools that save hours every week.',
}

async function mockFetch(url, init = {}) {
  const u = String(url)
  const method = init.method || 'GET'
  const ct = (init.headers && (init.headers['Content-Type'] || init.headers['content-type'])) || ''
  let body = null
  if (init.body && ct.includes('json')) body = JSON.parse(init.body)

  if (u.includes('oauth2.googleapis.com/token')) {
    return jsonRes({ access_token: 'test-access-token' })
  }

  if (u.includes('api.apify.com')) {
    captured.apifyCalls++
    if (u.includes('/datasets/') && u.includes('/items')) {
      return jsonRes([datasetItem])
    }
    if (u.includes('/runs')) {
      return jsonRes({ data: { id: 'run-1', status: 'RUNNING', defaultDatasetId: 'dataset-1' } })
    }
    if (u.includes('actor-runs/run-1')) {
      return jsonRes({ data: { id: 'run-1', status: 'SUCCEEDED', defaultDatasetId: 'dataset-1' } })
    }
    return jsonRes({})
  }

  if (u.includes('api.groq.com')) {
    captured.groqCalls++
    const user = body.messages.find(m => m.role === 'user').content
    if (user.includes('hierarchical category path')) {
      return jsonRes({ choices: [{ message: { content: '{"categoryPath":["AI & Technology","AI Tools"]}' } }] })
    }
    if (user.includes('exactly ONE category')) {
      return jsonRes({ choices: [{ message: { content: 'AI & Technology' } }] })
    }
    return jsonRes({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'A rundown of five AI tools that save hours each week.',
            keyTakeaways: ['Automate repetitive tasks', 'Pick tools that integrate'],
            suggestedTags: ['ai-tools', 'automation', 'productivity'],
            concepts: [{ name: 'AI Tools', type: 'topic' }, { name: 'Automation', type: 'topic' }],
            language: 'en',
            actionItems: ['Try one tool this week'],
            entities: [{ name: 'ChatGPT', type: 'tool' }],
            contentCategory: 'educational',
            sentiment: 'positive',
            targetAudience: 'knowledge workers',
          }),
        },
      }],
    })
  }

  if (u.includes('firestore.googleapis.com')) {
    const docPath = u.split('/documents/')[1]?.split('?')[0] || ''
    if (method === 'POST' && u.includes(':runQuery')) {
      return jsonRes([])
    }
    if (method === 'POST' && !u.includes(':runQuery')) {
      return jsonRes({ name: `projects/p/databases/(default)/documents/${docPath}/auto123`, fields: body?.fields || {} })
    }
    if (method === 'PATCH') {
      captured.firestoreWrites.push({ docPath, body })
      storedDocs[docPath] = { ...(storedDocs[docPath] || {}), ...(body?.fields || {}) }
      return jsonRes({ name: `projects/p/databases/(default)/documents/${docPath}`, fields: storedDocs[docPath] })
    }
    if (method === 'DELETE') {
      return jsonRes({})
    }
    return jsonRes({ name: `projects/p/databases/(default)/documents/${docPath}`, fields: storedDocs[docPath] || { status: { stringValue: 'queued' } } })
  }

  throw new Error(`Unexpected fetch: ${method} ${u}`)
}

globalThis.fetch = mockFetch

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) {
    pass++
    console.log(`PASS ${name}`)
  } else {
    fail++
    console.log(`FAIL ${name}${extra !== undefined ? ` — ${extra}` : ''}`)
  }
}

check('normalizeUrl strips trailing slash', normalizeUrl('https://x.com/reel/abc/') === 'https://x.com/reel/abc')

const placeholder = buildPlaceholderReelFields('uid123', 'https://www.instagram.com/reel/abc/', 'manual')
check('placeholder has urlKey + queued status', placeholder.urlKey === 'https://www.instagram.com/reel/abc' && placeholder.ingestStatus === 'queued')
check('placeholder has all 40+ fields', Object.keys(placeholder).length >= 40)

const parsed = await fetchApifyDataset(env, 'dataset-1')
check('apify dataset parses result', parsed.result?.creatorHandle === 'theai.coach')
check('apify dataset parses transcript', parsed.result?.transcript.includes('five AI tools'))
check('apify dataset returns sources', parsed.sources[0]?.source === 'apify')

const uid = 'uid123'
const url = 'https://www.instagram.com/reel/abc/'
const reelId = await createPlaceholderReel(env, uid, buildPlaceholderReelFields(uid, url, 'manual'))
check('createPlaceholderReel returns auto id', reelId === 'auto123')

await createIngestJob(env, uid, { jobId: 'job_1', reelId, uid, url, urlKey: url, source: 'manual', status: 'queued', webhookToken: 'tok', creditReserved: true, attempts: 0, createdAt: Date.now(), updatedAt: Date.now() })
const job = await getIngestJob(env, uid, 'job_1')
check('getIngestJob decodes status', job?.status === 'queued')
check('getIngestJob decodes booleans', job?.creditReserved === true)

const dup = await findDocByField(env, uid, 'reels', 'url', [url])
check('findDocByField returns null on empty', dup === null)

const fields = await processApifyRun(env, { uid, url, source: 'manual', datasetId: 'dataset-1' })
check('processApifyRun -> complete', fields.ingestStatus === 'complete')
check('processApifyRun keeps userId/url', fields.userId === uid && fields.url === url)
check('processApifyRun sets summary', fields.summary.includes('five AI tools'))
check('processApifyRun category path starts with major category', fields.categoryPath[0] === 'AI & Technology')
check('processApifyRun concepts weighted 0.7', fields.concepts[0]?.weight === 0.7)
check('processApifyRun builds searchableText', fields.searchableText.includes('summary') === false && fields.searchableText.includes('Automate') === true)
check('processApifyRun dataSources include apify+groq', fields.dataSources.length === 2)
check('processApifyRun sets transcript', fields.transcript.includes('In this video'))
check('processApifyRun sets creator fields', fields.creatorHandle === 'theai.coach' && fields.creatorFollowers === 0)

await updateReelDoc(env, uid, reelId, fields)
const reelWrite = captured.firestoreWrites.find(w => w.docPath.includes(`/reels/${reelId}`))
check('firestore PATCH used updateMask', Array.isArray(reelWrite?.body?.updateMask?.fieldPaths) && reelWrite.body.updateMask.fieldPaths.length > 0)
check('updateReelDoc PATCH uses updateMask for ingestStatus', Array.isArray(reelWrite?.body?.updateMask?.fieldPaths) && reelWrite.body.updateMask.fieldPaths.includes('ingestStatus'))
check('firestore wire format has integerValue for ingestedAt', reelWrite.body.fields.ingestedAt.integerValue === String(fields.ingestedAt))

check('groq called for analyze + classify', captured.groqCalls === 2)
check('apify hit dataset endpoint', captured.apifyCalls >= 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
