#!/usr/bin/env node
/**
 * Seeds the global exercises table from free-exercise-db (data/exercises.json).
 *
 * Usage:
 *   node scripts/seed-exercises.mjs          # local D1
 *   node scripts/seed-exercises.mjs --remote # remote D1
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataPath = join(root, 'data', 'exercises.json')
const remote = process.argv.includes('--remote')

/** @param {unknown} value */
function sqlString(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

/** @param {unknown} value */
function sqlJson(value) {
  return sqlString(JSON.stringify(value ?? []))
}

const exercises = JSON.parse(readFileSync(dataPath, 'utf8'))
if (!Array.isArray(exercises) || exercises.length === 0) {
  console.error('No exercises found in', dataPath)
  process.exit(1)
}

const BATCH = 40
const statements = []

for (let i = 0; i < exercises.length; i += BATCH) {
  const chunk = exercises.slice(i, i + BATCH)
  const values = chunk
    .map((ex) => {
      return `(${[
        sqlString(ex.id),
        sqlString(ex.name),
        sqlString(ex.force),
        sqlString(ex.level),
        sqlString(ex.mechanic),
        sqlString(ex.equipment),
        sqlString(ex.category),
        sqlJson(ex.primaryMuscles),
        sqlJson(ex.secondaryMuscles),
        sqlJson(ex.instructions),
        sqlJson(ex.images),
      ].join(', ')})`
    })
    .join(',\n')

  statements.push(`INSERT OR REPLACE INTO exercises (
  id, name, force, level, mechanic, equipment, category,
  primary_muscles, secondary_muscles, instructions, images
) VALUES
${values};`)
}

const sqlPath = join(tmpdir(), `liftr-seed-${randomBytes(8).toString('hex')}.sql`)
writeFileSync(sqlPath, statements.join('\n\n') + '\n')

console.log(
  `Seeding ${exercises.length} exercises into ${remote ? 'remote' : 'local'} D1...`,
)

try {
  const args = [
    'd1',
    'execute',
    'liftr-db',
    '--file',
    sqlPath,
    ...(remote ? ['--remote'] : ['--local']),
    '-y',
  ]
  execFileSync('pnpm', ['exec', 'wrangler', ...args], {
    cwd: root,
    stdio: 'inherit',
  })
  console.log('Done.')
} finally {
  try {
    unlinkSync(sqlPath)
  } catch {
    // ignore
  }
}
