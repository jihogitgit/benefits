import type { SupabaseClient } from '@supabase/supabase-js'
import type { BenefitRow, ConditionRow, SyncRunRow } from '../../types/database'
import type { BenefitsRepo, ExistingVersion } from './types'

const PAGE = 1000 // Supabase 기본 최대 행 수

/** BenefitsRepo의 Supabase 구현. service role 클라이언트를 받는다. tsx 스크립트에서도 쓰므로 상대경로 import. */
export function createSupabaseRepo(supabase: SupabaseClient): BenefitsRepo {
  async function getExisting(source: string): Promise<Map<string, ExistingVersion>> {
    const map = new Map<string, ExistingVersion>()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('benefits')
        .select('id, source_id, slug, source_updated_at')
        .eq('source', source)
        .range(from, from + PAGE - 1)
      if (error) throw error
      for (const r of data ?? []) map.set(r.source_id, { id: r.id, slug: r.slug, source_updated_at: r.source_updated_at })
      if (!data || data.length < PAGE) break
    }
    return map
  }

  return {
    getExisting,

    async allSlugs() {
      const out = new Set<string>()
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('benefits').select('slug').range(from, from + PAGE - 1)
        if (error) throw error
        for (const r of data ?? []) out.add(r.slug as string)
        if (!data || data.length < PAGE) break
      }
      return out
    },

    async upsertBenefits(rows: BenefitRow[]) {
      const { data, error } = await supabase.from('benefits').upsert(rows, { onConflict: 'source,source_id' }).select('id, source_id')
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.source_id as string, r.id as string]))
    },

    async upsertConditions(rows: ConditionRow[]) {
      const { error } = await supabase.from('benefit_conditions').upsert(rows, { onConflict: 'benefit_id' })
      if (error) throw error
    },

    async closeExpired(source: string, todayKst: string) {
      const { data, error } = await supabase
        .from('benefits')
        .update({ status: 'closed' })
        .eq('source', source)
        .eq('status', 'open')
        .eq('deadline_type', 'period')
        .lt('apply_end', todayKst)
        .select('id')
      if (error) throw error
      return data?.length ?? 0
    },

    async markRemoved(source: string, keepSourceIds: string[]) {
      const keep = new Set(keepSourceIds)
      const existing = await getExisting(source)
      const toRemove = [...existing.keys()].filter((sid) => !keep.has(sid))
      let count = 0
      for (let i = 0; i < toRemove.length; i += 200) {
        const chunk = toRemove.slice(i, i + 200)
        const { data, error } = await supabase
          .from('benefits')
          .update({ status: 'removed' })
          .eq('source', source)
          .in('source_id', chunk)
          .neq('status', 'removed')
          .select('id')
        if (error) throw error
        count += data?.length ?? 0
      }
      return count
    },

    async recordRun(run: SyncRunRow) {
      const { error } = await supabase.from('sync_runs').insert(run)
      if (error) throw error
    },

    async lastSuccessfulFetched(source: string) {
      const { data, error } = await supabase
        .from('sync_runs')
        .select('fetched')
        .eq('source', source)
        .is('error', null)
        .is('aborted_reason', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data?.fetched ?? null
    },
  }
}
