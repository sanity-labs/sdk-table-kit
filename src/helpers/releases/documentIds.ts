export function normalizeBaseDocumentId(documentId: string): string {
  if (documentId.startsWith('drafts.')) {
    return documentId.slice(7)
  }

  if (documentId.startsWith('versions.')) {
    const parts = documentId.split('.')
    return parts.slice(2).join('.')
  }

  return documentId
}

export function buildVersionDocumentId(documentId: string, releaseId: string): string {
  return `versions.${releaseId}.${normalizeBaseDocumentId(documentId)}`
}
