/**
 * TagEnrichment — плашка с расшифровкой тега (LLM enrichment)
 *
 * Показывается в ленте новостей когда выбран конкретный тег.
 * Liquid glass дизайн, компактная плашка как DailySummary.
 */

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Tag, Hash, Sparkles, Package, Link2, Globe, ChevronDown, ChevronUp } from 'lucide-react'

interface EnrichmentData {
  tag_name: string
  tag_type: string
  ticker: string | null
  synonyms_en: string[]
  synonyms_ru: string[]
  key_products: string[]
  related_entities: string[]
  description: string | null
}

const TYPE_LABELS: Record<string, string> = {
  company: 'Компания',
  ticker: 'Тикер',
  sector: 'Сектор',
  trend: 'Тренд',
  person: 'Персона',
  commodity: 'Товар',
  index: 'Индекс',
  currency: 'Валюта',
}

const TYPE_COLORS: Record<string, string> = {
  company: '#00D4FF',
  ticker: '#10B981',
  sector: '#F59E0B',
  trend: '#EC4899',
  person: '#8B5CF6',
  commodity: '#EF4444',
  index: '#6366F1',
  currency: '#14B8A6',
}

interface Props {
  tagName: string
}

export default function TagEnrichment({ tagName }: Props) {
  const [data, setData] = useState<EnrichmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/user/tags/${encodeURIComponent(tagName)}/enrichment`)
      .then((d: any) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [tagName])

  if (loading) {
    return (
      <div className="mb-6 p-5 rounded-xl animate-pulse" style={{
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(12px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="h-4 bg-white/5 rounded w-1/3 mb-3" />
        <div className="h-3 bg-white/5 rounded w-2/3" />
      </div>
    )
  }

  if (!data) return null

  const color = TYPE_COLORS[data.tag_type] || '#00D4FF'
  const hasExtras = data.synonyms_ru.length > 0 || data.synonyms_en.length > 0 || data.key_products.length > 0 || data.related_entities.length > 0

  return (
    <div className="mb-6 rounded-xl overflow-hidden" style={{
      background: 'rgba(255,255,255,0.02)',
      backdropFilter: 'blur(12px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
              backgroundColor: `${color}12`,
              border: `1px solid ${color}25`,
            }}>
              <Tag size={18} style={{ color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">{data.tag_name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                  backgroundColor: `${color}15`,
                  color,
                  border: `1px solid ${color}30`,
                }}>
                  {TYPE_LABELS[data.tag_type] || data.tag_type}
                </span>
              </div>
              {data.description && (
                <p className="text-xs text-[#6B7280] mt-0.5">{data.description}</p>
              )}
            </div>
          </div>

          {hasExtras && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {expanded ? 'Скрыть' : 'Подробнее'}
            </button>
          )}
        </div>

        {/* Quick info row */}
        <div className="flex flex-wrap gap-3">
          {data.ticker && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#10B981' }}>
              <Hash size={13} />
              <span>{data.ticker}</span>
            </div>
          )}

          {data.synonyms_ru.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
              <Sparkles size={13} />
              <span>{data.synonyms_ru.slice(0, 3).join(', ')}</span>
              {data.synonyms_ru.length > 3 && (
                <span className="text-[#6B7280]">+{data.synonyms_ru.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && hasExtras && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Synonyms RU */}
            {data.synonyms_ru.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                  <Globe size={12} />
                  <span>Синонимы (RU)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.synonyms_ru.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 text-[#9CA3AF] border border-white/5">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Synonyms EN */}
            {data.synonyms_en.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                  <Globe size={12} />
                  <span>Синонимы (EN)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.synonyms_en.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 text-[#9CA3AF] border border-white/5">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Key Products */}
            {data.key_products.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                  <Package size={12} />
                  <span>Ключевые продукты</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.key_products.map((p, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 text-[#9CA3AF] border border-white/5">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Related Entities */}
            {data.related_entities.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                  <Link2 size={12} />
                  <span>Связанные сущности</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.related_entities.map((e, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 text-[#9CA3AF] border border-white/5">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
