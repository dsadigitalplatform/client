import type {
  CodeEntityType,
  CodeGenerationConfig,
  CodeTokenHint,
  ReapplyCodeResult,
  UpdateCodeGenerationConfigInput
} from '@features/code-generation/code-generation.types'

async function parseError(res: Response) {
  const data = await res.json().catch(() => ({}))

  if (data?.details && typeof data.details === 'object') {
    const first = Object.values(data.details as Record<string, string>)[0]

    if (first) return String(first)
  }

  return data?.message || data?.error || `Request failed (${res.status})`
}

export async function getCodeGenerationConfigs() {
  const res = await fetch('/api/code-generation-configs', { cache: 'no-store' })

  if (!res.ok) throw new Error(await parseError(res))

  const data = await res.json()

  return {
    configs: (data?.configs ?? []) as CodeGenerationConfig[],
    tokens: (data?.tokens ?? []) as CodeTokenHint[]
  }
}

export async function updateCodeGenerationConfig(input: UpdateCodeGenerationConfigInput) {
  const res = await fetch('/api/code-generation-configs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })

  if (!res.ok) throw new Error(await parseError(res))

  const data = await res.json()

  return {
    configs: (data?.configs ?? []) as CodeGenerationConfig[],
    tokens: (data?.tokens ?? []) as CodeTokenHint[]
  }
}

export async function previewCodeGeneration(params: {
  entityType: CodeEntityType
  template?: string
  prefix?: string
  sequencePadLength?: number
}) {
  const res = await fetch('/api/code-generation-configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'preview', ...params })
  })

  if (!res.ok) throw new Error(await parseError(res))

  const data = await res.json()

  return String(data?.preview || '')
}

export async function reapplyCodeGeneration(params: {
  entityType: CodeEntityType
  onlyMissing?: boolean
  limit?: number
}) {
  const res = await fetch('/api/code-generation-configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reapply', ...params })
  })

  if (!res.ok) throw new Error(await parseError(res))

  return (await res.json()) as ReapplyCodeResult
}
