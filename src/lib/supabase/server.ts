import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/** 공개 읽기 전용(anon) 클라이언트. 서버 컴포넌트·사이트맵에서 사용. 세션·쿠키 없음. */
export function createPublicClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 누락')
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}
