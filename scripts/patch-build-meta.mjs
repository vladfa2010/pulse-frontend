// ТЗ-163: маркер сборки — вешает data-build="<version>" на <html> в собранном
// шелле. Версия берётся из package.json на этапе сборки (не врёт, в отличие от
// ручного суффикса в title, который протухал). Запускается после vite build,
// до seo-prerender (чтобы карточки унаследовали маркер) и до cp в 404.html.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const target = join(root, 'dist', 'index.html')

const html = readFileSync(target, 'utf8')
if (html.includes('data-build=')) {
  console.log(`[build-meta] data-build уже есть, пропуск`)
  process.exit(0)
}
const patched = html.replace('<html lang="ru">', `<html lang="ru" data-build="${version}">`)
if (patched === html) {
  console.warn('[build-meta] WARNING: шаблон <html lang="ru"> не найден в dist/index.html — маркер не проставлен')
  process.exit(0)
}
writeFileSync(target, patched)
console.log(`[build-meta] data-build="${version}" проставлен`)
