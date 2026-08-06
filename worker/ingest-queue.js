import { DurableObject } from 'cloudflare:workers'
import { startApifyRun, pollApifyRun, abortApifyRun } from './apify'
import { updateIngestJob, updateReelDoc, releaseMasterCredit } from './firestore'
import { processApifyRun, normalizeUrl } from './ingest'

const WEBHOOK_BACKSTOP_MS = 180_000
const JOB_EXPIRY_MS = 6 * 60 * 60 * 1000
const MAX_ATTEMPTS = 3
const RETRY_BACKOFF_MS = [30_000, 120_000, 600_000]

const TERMINAL = ['complete', 'failed', 'cancelled']

export class IngestQueue extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.env = env
    this.ctx = ctx
    this.inFlight = new Set()
    ctx.blockConcurrencyWhile(() => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
          jobId TEXT PRIMARY KEY,
          uid TEXT NOT NULL,
          reelId TEXT NOT NULL,
          url TEXT NOT NULL,
          urlKey TEXT NOT NULL,
          source TEXT NOT NULL,
          status TEXT NOT NULL,
          phase TEXT NOT NULL,
          runId TEXT,
          datasetId TEXT,
          webhookToken TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          retryAt INTEGER,
          creditReserved INTEGER NOT NULL DEFAULT 1,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `)
    })
  }

  async enqueue({ jobId, reelId, uid, url, source, webhookToken, creditReserved }) {
    const now = Date.now()
    this.ctx.storage.sql.exec(
      `INSERT INTO jobs (jobId, uid, reelId, url, urlKey, source, status, phase, webhookToken, creditReserved, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      jobId, uid, reelId, url, normalizeUrl(url), source, 'queued', 'start', webhookToken,
      creditReserved ? 1 : 0, now, now,
    )
    await this.patchJobDoc({ uid, jobId }, { status: 'queued', updatedAt: now })
    this.scheduleBackstop()
    await this.startJob(jobId)
    return { ok: true }
  }

  async webhook({ jobId, token, eventType }) {
    const row = this.getRow(jobId)
    if (!row) return { ok: false, error: 'unknown job' }
    if (token && row.webhookToken && !secureCompare(token, row.webhookToken)) {
      return { ok: false, error: 'bad token' }
    }
    if (TERMINAL.includes(row.status)) return { ok: true, already: true }

    if (eventType === 'SUCCEEDED') {
      this.ctx.waitUntil(this.processJob(jobId))
    } else if (eventType === 'FAILED' || eventType === 'ABORTED' || eventType === 'TIMED-OUT') {
      this.ctx.waitUntil(this.failJob(jobId, `Apify run ${String(eventType).toLowerCase()}`, false))
    }
    return { ok: true }
  }

  async cancel({ jobId }) {
    const row = this.getRow(jobId)
    if (!row) return { ok: false, error: 'unknown job' }
    if (TERMINAL.includes(row.status)) return { ok: true, already: true }
    await this.failJob(jobId, 'Cancelled by user', true)
    return { ok: true }
  }

  async list() {
    const rows = this.allRows()
    return {
      jobs: rows.map(row => ({
        jobId: row.jobId,
        reelId: row.reelId,
        url: row.url,
        status: row.status,
        createdAt: row.createdAt,
      })),
    }
  }

  async alarm() {
    const now = Date.now()
    for (const row of this.allRows()) {
      if (now - row.createdAt > JOB_EXPIRY_MS) {
        await this.failJob(row.jobId, 'Processing timed out', false)
        continue
      }
      if (row.status === 'queued') {
        await this.startJob(row.jobId)
      } else if (row.status === 'running') {
        const stale = Date.now() - row.updatedAt > WEBHOOK_BACKSTOP_MS
        if (stale) await this.checkRun(row.jobId)
      } else if (row.status === 'retry') {
        if (Date.now() >= (row.retryAt || 0)) {
          if (row.phase === 'start') await this.startJob(row.jobId)
          else await this.processJob(row.jobId)
        }
      }
    }
    await this.scheduleBackstop()
  }

  async startJob(jobId) {
    if (this.inFlight.has(jobId)) return
    this.inFlight.add(jobId)
    try {
      const row = this.getRow(jobId)
      if (!row || row.status !== 'queued') return
      await this.patchReel(row, { ingestStatus: 'scraping' })
      try {
        const webhookUrl = this.env.WORKER_URL
          ? `${this.env.WORKER_URL}/api/ingest/webhook?jobId=${encodeURIComponent(row.jobId)}&token=${encodeURIComponent(row.webhookToken)}&uid=${encodeURIComponent(row.uid)}`
          : null
        const { runId, datasetId } = await startApifyRun(this.env, row.url, webhookUrl)
        this.updateRow(jobId, { runId, datasetId, status: 'running', phase: 'process', attempts: 0, updatedAt: Date.now() })
        await this.patchJobDoc(row, { status: 'running', runId, datasetId, updatedAt: Date.now() })
        await this.scheduleBackstop()
      } catch (e) {
        await this.failTransient(jobId, e)
      }
    } finally {
      this.inFlight.delete(jobId)
    }
  }

  async processJob(jobId) {
    if (this.inFlight.has(jobId)) return
    this.inFlight.add(jobId)
    try {
      const row = this.getRow(jobId)
      if (!row || TERMINAL.includes(row.status)) return
      this.updateRow(jobId, { status: 'analyzing', updatedAt: Date.now() })
      await this.patchJobDoc(row, { status: 'analyzing', updatedAt: Date.now() })
      await this.patchReel(row, { ingestStatus: 'analyzing' })
      try {
        const fields = await processApifyRun(this.env, {
          uid: row.uid,
          url: row.url,
          source: row.source,
          datasetId: row.datasetId,
        })
        await updateReelDoc(this.env, row.uid, row.reelId, fields)
        this.updateRow(jobId, { status: 'complete', updatedAt: Date.now() })
        await this.patchJobDoc(row, { status: 'complete', reelId: row.reelId, updatedAt: Date.now() })
        this.deleteRow(jobId)
        await this.scheduleBackstop()
      } catch (e) {
        await this.failTransient(jobId, e)
      }
    } finally {
      this.inFlight.delete(jobId)
    }
  }

  async checkRun(jobId) {
    const row = this.getRow(jobId)
    if (!row || !row.runId || TERMINAL.includes(row.status)) return
    let status, datasetId
    try {
      const poll = await pollApifyRun(this.env, row.runId)
      status = poll.status
      datasetId = poll.datasetId || row.datasetId
    } catch {
      return
    }
    if (status === 'SUCCEEDED') {
      this.updateRow(jobId, { datasetId, status: 'running', updatedAt: Date.now() })
      await this.processJob(jobId)
    } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      await this.failJob(jobId, `Apify run ${String(status).toLowerCase()}`, false)
    }
  }

  async failTransient(jobId, error) {
    const row = this.getRow(jobId)
    if (!row || TERMINAL.includes(row.status)) return
    const attempts = row.attempts + 1
    if (attempts >= MAX_ATTEMPTS) {
      await this.failJob(jobId, `Processing failed: ${error?.message || 'unknown error'}`, false)
      return
    }
    const retryAt = Date.now() + RETRY_BACKOFF_MS[Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1)]
    this.updateRow(jobId, { status: 'retry', attempts, retryAt, updatedAt: Date.now() })
    await this.patchJobDoc(row, { status: 'retry', attempts, retryAt, error: error?.message, updatedAt: Date.now() })
    await this.ctx.storage.setAlarm(retryAt)
  }

  async failJob(jobId, message, cancelled) {
    const row = this.getRow(jobId)
    if (!row || TERMINAL.includes(row.status)) return
    if (row.runId) await abortApifyRun(this.env, row.runId)
    const status = cancelled ? 'cancelled' : 'failed'
    await this.patchReel(row, { ingestStatus: 'failed', errorMessage: message })
    this.updateRow(jobId, { status, updatedAt: Date.now() })
    await this.patchJobDoc(row, { status, error: message, updatedAt: Date.now() })
    this.deleteRow(jobId)
    if (row.creditReserved) {
      await releaseMasterCredit(this.env, row.uid).catch(() => {})
    }
    await this.scheduleBackstop()
  }

  async patchReel(row, fields) {
    await updateReelDoc(this.env, row.uid, row.reelId, { ...fields, updatedAt: Date.now() })
  }

  async patchJobDoc(row, fields) {
    await updateIngestJob(this.env, row.uid, row.jobId, fields).catch(() => {})
  }

  async scheduleBackstop() {
    const rows = this.allRows()
    if (rows.length === 0) {
      await this.ctx.storage.deleteAlarm()
      return
    }
    let next = Infinity
    const now = Date.now()
    for (const row of rows) {
      if (row.status === 'retry') {
        next = Math.min(next, row.retryAt || now + WEBHOOK_BACKSTOP_MS)
      } else {
        next = Math.min(next, now + WEBHOOK_BACKSTOP_MS)
      }
    }
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next)
  }

  getRow(jobId) {
    const res = this.ctx.storage.sql.exec('SELECT * FROM jobs WHERE jobId = ?', jobId)
    const row = res.toArray()[0]
    return row || null
  }

  allRows() {
    return this.ctx.storage.sql.exec('SELECT * FROM jobs ORDER BY createdAt').toArray()
  }

  updateRow(jobId, fields) {
    const keys = Object.keys(fields)
    const sets = keys.map(key => `${key} = ?`).join(', ')
    const values = keys.map(key => fields[key])
    this.ctx.storage.sql.exec(`UPDATE jobs SET ${sets} WHERE jobId = ?`, ...values, jobId)
  }

  deleteRow(jobId) {
    this.ctx.storage.sql.exec('DELETE FROM jobs WHERE jobId = ?', jobId)
  }
}

function secureCompare(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
