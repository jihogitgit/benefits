import { jsonLdString } from '@/lib/seo/jsonld'

/** JSON-LD 블록. 문자열화는 항상 jsonLdString을 거친다(</script 이스케이프). */
export default function JsonLd({ data }: { data: unknown }) {
  const list = (Array.isArray(data) ? data : [data]).filter(Boolean)
  return (
    <>
      {list.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(d) }} />
      ))}
    </>
  )
}
