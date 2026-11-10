import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncRunRow } from '../../types/database'
import type { HousingNoticeRow, HousingSource, HousingUnitTypeInput } from '../../types/housing'
import type { HousingRepo, HousingExisting } from './housing-types'

const PAGE = 1000

/** HousingRepo의 Supabase 구현. service role 클라이언트. tsx 스크립트에서도 쓰므로 상대경로 import. */
export function createHousingRepo(supabase: SupabaseClient): HousingRepo {
  async function getExisting(source: HousingSource): Promise<Map<string, HousingExisting>> {
    const map = new Map<string, HousingExisting>()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('housing_notices')
        .select('id, source_id, slug, content_hash, status')
        .eq('source', source)
        .range(from, from + PAGE - 1)
      if (error) throw error
      for (const r of data ?? []) map.set(r.source_id, { id: r.id, slug: r.slug, content_hash: r.content_hash, status: r.status })
      if (!data || data.length < PAGE) break
    }
    return map
  }

  return {
    getExisting,

    async allSlugs() {
      const out = new Set<string>()
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('housing_notices').select('slug').range(from, from + PAGE - 1)
        if (error) throw error
        for (const r of data ?? []) out.add(r.slug as string)
        if (!data || data.length < PAGE) break
      }
      return out
    },

    async upsertNotices(rows: HousingNoticeRow[]) {
      const { data, error } = await supabase.from('housing_notices').upsert(rows, { onConflict: 'source,source_id' }).select('id, source_id')
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.source_id as string, r.id as string]))
    },

    async replaceUnitTypes(noticeId: string, rows: HousingUnitTypeInput[]) {
      const del = await supabase.from('housing_unit_types').delete().eq('notice_id', noticeId)
      if (del.error) throw del.error
      if (!rows.length) return
      const { error } = await supabase.from('housing_unit_types').insert(rows.map((r) => ({ ...r, notice_id: noticeId })))
      if (error) throw error
    },

    async markRemoved(source: HousingSource, keepSourceIds: string[]) {
      const keep = new Set(keepSourceIds)
      const existing = await getExisting(source)
      const toRemove = [...existing.entries()].filter(([sid, e]) => !keep.has(sid) && e.status !== 'removed').map(([sid]) => sid)
      const slugs: string[] = []
      for (let i = 0; i < toRemove.length; i += 200) {
        const chunk = toRemove.slice(i, i + 200)
        const { data, error } = await supabase
          .from('housing_notices')
          .update({ status: 'removed' })
          .eq('source', source)
          .in('source_id', chunk)
          .neq('status', 'removed')
          .select('slug')
        if (error) throw error
        for (const r of data ?? []) slugs.push(r.slug as string)
      }
      return slugs
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
