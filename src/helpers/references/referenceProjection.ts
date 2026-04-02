export function buildProjectionString(select: Record<string, string>): string {
  const parts: string[] = []
  for (const [key, path] of Object.entries(select)) {
    if (path === key && !path.includes('.') && !path.includes('[')) {
      parts.push(key)
    } else {
      parts.push(`"${key}": ${path}`)
    }
  }
  return `{${parts.join(', ')}}`
}
