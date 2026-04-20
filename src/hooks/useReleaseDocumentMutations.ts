import {useClient} from '@sanity/sdk-react'
import {parseAsString, useQueryState} from 'nuqs'
import {useCallback} from 'react'

import {parseReleasePerspectiveParam, useOptionalReleaseContext} from '../context/ReleaseContext'
import {buildVersionDocumentId, normalizeBaseDocumentId} from '../helpers/releases/documentIds'

const RELEASE_DOCUMENT_QUERY = '*[_id == $documentId][0]'
const RAW_QUERY_OPTIONS = {perspective: 'raw' as const}

interface ReleaseInsertOperation {
  after?: string
  before?: string
  items: unknown[]
  replace?: string
}

export interface ReleasePatchOperations {
  dec?: Record<string, number>
  diffMatchPatch?: Record<string, unknown>
  ifRevisionID?: string
  inc?: Record<string, number>
  insert?: ReleaseInsertOperation
  set?: Record<string, unknown>
  setIfMissing?: Record<string, unknown>
  unset?: string[]
}

export interface ReleaseDocumentMutationsResult {
  hasSelectedRelease: boolean
  patchDocumentInRelease: (
    documentId: string,
    operations: ReleasePatchOperations | ReleasePatchOperations[],
  ) => Promise<string>
  resolveReleaseDocumentId: (documentId: string) => string | null
  selectedReleaseId: string | null
}

type ReleaseDocumentSnapshot = {
  _id: string
  _type: string
  [key: string]: unknown
}

interface ReleaseDocumentsClient {
  releases?: {
    fetchDocuments?: (args: {
      releaseId: string
    }) => Promise<{documents?: ReleaseDocumentSnapshot[]} | ReleaseDocumentSnapshot[]>
  }
}

const ARRAY_INDEX_SELECTOR = /^(?<path>.+)\[(?<index>-?\d+)\]$/
const ARRAY_KEY_SELECTOR = /^(?<path>.+)\[_key=="(?<key>.+)"\]$/

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function getValueAtPath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined
    }

    return (current as Record<string, unknown>)[segment]
  }, root)
}

function getParentAtPath(
  root: Record<string, unknown>,
  path: string,
  createMissing: boolean,
): {key: string; parent: Record<string, unknown>} | null {
  const segments = path.split('.')
  const key = segments.pop()

  if (!key) {
    return null
  }

  let parent = root

  for (const segment of segments) {
    const nextValue = parent[segment]

    if (nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue)) {
      parent = nextValue as Record<string, unknown>
      continue
    }

    if (!createMissing) {
      return null
    }

    parent[segment] = {}
    parent = parent[segment] as Record<string, unknown>
  }

  return {key, parent}
}

function setValueAtPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
  onlyIfMissing = false,
) {
  const target = getParentAtPath(root, path, true)

  if (!target) {
    throw new Error(`Cannot set release document path "${path}"`)
  }

  if (onlyIfMissing && typeof target.parent[target.key] !== 'undefined') {
    return
  }

  target.parent[target.key] = cloneValue(value)
}

function ensureArrayAtPath(root: Record<string, unknown>, path: string): unknown[] {
  const existingValue = getValueAtPath(root, path)

  if (typeof existingValue === 'undefined') {
    setValueAtPath(root, path, [])
    return getValueAtPath(root, path) as unknown[]
  }

  if (!Array.isArray(existingValue)) {
    throw new Error(`Expected "${path}" to be an array in a release document`)
  }

  return existingValue
}

function resolveArrayIndex(array: unknown[], rawIndex: number): number {
  if (rawIndex < 0) {
    return Math.max(array.length + rawIndex, 0)
  }

  return Math.min(rawIndex, array.length)
}

function applyInsertOperation(root: ReleaseDocumentSnapshot, operation: ReleaseInsertOperation) {
  const selector = operation.before ?? operation.after ?? operation.replace
  const mode = operation.before
    ? 'before'
    : operation.after
      ? 'after'
      : operation.replace
        ? 'replace'
        : null

  if (!selector || !mode) {
    throw new Error('Insert operations must specify before, after, or replace')
  }

  const match = selector.match(ARRAY_INDEX_SELECTOR)

  if (!match?.groups?.path || typeof match.groups.index === 'undefined') {
    throw new Error(`Unsupported insert selector "${selector}" for release staging`)
  }

  const arrayPath = match.groups.path
  const rawIndex = Number.parseInt(match.groups.index, 10)
  const array = ensureArrayAtPath(root, arrayPath)
  const items = operation.items.map((item) => cloneValue(item))

  if (mode === 'after') {
    const index = rawIndex === -1 ? array.length : resolveArrayIndex(array, rawIndex) + 1
    array.splice(Math.min(index, array.length), 0, ...items)
    return
  }

  if (mode === 'before') {
    const index = resolveArrayIndex(array, rawIndex)
    array.splice(index, 0, ...items)
    return
  }

  const index = resolveArrayIndex(array, rawIndex)
  const deleteCount = index >= array.length ? 0 : 1
  array.splice(index, deleteCount, ...items)
}

function applyUnsetOperation(root: ReleaseDocumentSnapshot, path: string) {
  const arrayKeyMatch = path.match(ARRAY_KEY_SELECTOR)

  if (arrayKeyMatch?.groups?.path && arrayKeyMatch.groups.key) {
    const arrayValue = getValueAtPath(root, arrayKeyMatch.groups.path)

    if (!Array.isArray(arrayValue)) {
      return
    }

    const nextItems = arrayValue.filter((item) => {
      return !(
        item &&
        typeof item === 'object' &&
        (item as {_key?: string})._key === arrayKeyMatch.groups?.key
      )
    })

    setValueAtPath(root, arrayKeyMatch.groups.path, nextItems)
    return
  }

  const target = getParentAtPath(root, path, false)

  if (!target) {
    return
  }

  delete target.parent[target.key]
}

function applyPatchOperationsToDocument(
  document: ReleaseDocumentSnapshot,
  operations: ReleasePatchOperations[],
): ReleaseDocumentSnapshot {
  const nextDocument = cloneValue(document)

  for (const operation of operations) {
    if (operation.set) {
      for (const [path, value] of Object.entries(operation.set)) {
        setValueAtPath(nextDocument, path, value)
      }
    }

    if (operation.setIfMissing) {
      for (const [path, value] of Object.entries(operation.setIfMissing)) {
        setValueAtPath(nextDocument, path, value, true)
      }
    }

    if (operation.diffMatchPatch) {
      throw new Error('diffMatchPatch is not yet supported for release-staged document edits')
    }

    if (operation.inc) {
      for (const [path, amount] of Object.entries(operation.inc)) {
        const currentValue = getValueAtPath(nextDocument, path)

        if (typeof currentValue !== 'number') {
          throw new Error(`Cannot increment non-number path "${path}" in a release-staged document`)
        }

        setValueAtPath(nextDocument, path, currentValue + amount)
      }
    }

    if (operation.dec) {
      for (const [path, amount] of Object.entries(operation.dec)) {
        const currentValue = getValueAtPath(nextDocument, path)

        if (typeof currentValue !== 'number') {
          throw new Error(`Cannot decrement non-number path "${path}" in a release-staged document`)
        }

        setValueAtPath(nextDocument, path, currentValue - amount)
      }
    }

    if (operation.unset?.length) {
      for (const path of operation.unset) {
        applyUnsetOperation(nextDocument, path)
      }
    }

    if (operation.insert) {
      applyInsertOperation(nextDocument, operation.insert)
    }

    if (operation.ifRevisionID) {
      if (nextDocument._rev && nextDocument._rev !== operation.ifRevisionID) {
        throw new Error('Release-staged document revision did not match expected revision')
      }
    }
  }

  return nextDocument
}

function isDocumentAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /already exists/i.test(error.message)
}

export function useReleaseDocumentMutations(): ReleaseDocumentMutationsResult {
  const client = useClient({apiVersion: '2025-05-06'})
  const releaseContext = useOptionalReleaseContext()
  const [releaseParam] = useQueryState('release', parseAsString.withDefault(''))
  const fallbackPerspective = parseReleasePerspectiveParam(releaseParam)
  const selectedReleaseId =
    releaseContext?.selectedReleaseId ??
    (fallbackPerspective.kind === 'release' ? fallbackPerspective.releaseId : null)

  const resolveReleaseDocumentId = useCallback(
    (documentId: string) => {
      if (!selectedReleaseId) {
        return null
      }

      return buildVersionDocumentId(documentId, selectedReleaseId)
    },
    [selectedReleaseId],
  )

  const readVersionDocument = useCallback(
    async (versionDocumentId: string, releaseId: string) => {
      const directVersionDocument = await client.fetch<ReleaseDocumentSnapshot | null>(
        RELEASE_DOCUMENT_QUERY,
        {documentId: versionDocumentId},
        RAW_QUERY_OPTIONS,
      )

      if (directVersionDocument) {
        return directVersionDocument
      }

      const releasesClient = client as unknown as ReleaseDocumentsClient
      const fetchReleaseDocuments = releasesClient.releases?.fetchDocuments

      if (!fetchReleaseDocuments) {
        return null
      }

      const releaseDocumentsResult = await fetchReleaseDocuments({releaseId})
      const releaseDocuments = Array.isArray(releaseDocumentsResult)
        ? releaseDocumentsResult
        : (releaseDocumentsResult.documents ?? [])

      return releaseDocuments.find((document) => document?._id === versionDocumentId) ?? null
    },
    [client],
  )

  const ensureVersionDocument = useCallback(
    async (documentId: string) => {
      const versionDocumentId = resolveReleaseDocumentId(documentId)

      if (!versionDocumentId || !selectedReleaseId) {
        throw new Error('Cannot stage a document without a selected release')
      }

      const existingVersionDocument = await readVersionDocument(
        versionDocumentId,
        selectedReleaseId,
      )

      if (existingVersionDocument) {
        return {
          document: existingVersionDocument,
          versionDocumentId,
        }
      }

      const publishedId = normalizeBaseDocumentId(documentId)

      try {
        await client.action({
          actionType: 'sanity.action.document.version.create',
          baseId: publishedId,
          publishedId,
          versionId: versionDocumentId,
        })
      } catch (error) {
        if (!isDocumentAlreadyExistsError(error)) {
          throw error
        }
      }

      const createdVersionDocument = await readVersionDocument(versionDocumentId, selectedReleaseId)

      if (!createdVersionDocument) {
        throw new Error(`Failed to load created release version "${versionDocumentId}"`)
      }

      return {
        document: createdVersionDocument,
        versionDocumentId,
      }
    },
    [client, readVersionDocument, resolveReleaseDocumentId, selectedReleaseId],
  )

  const patchDocumentInRelease = useCallback(
    async (documentId: string, operations: ReleasePatchOperations | ReleasePatchOperations[]) => {
      const {document, versionDocumentId} = await ensureVersionDocument(documentId)
      const patchOperations = Array.isArray(operations) ? operations : [operations]
      const nextDocument = applyPatchOperationsToDocument(document, patchOperations)

      await client.action({
        actionType: 'sanity.action.document.version.replace',
        document: nextDocument,
      })

      return versionDocumentId
    },
    [client, ensureVersionDocument],
  )

  return {
    hasSelectedRelease: Boolean(selectedReleaseId),
    patchDocumentInRelease,
    resolveReleaseDocumentId,
    selectedReleaseId,
  }
}
