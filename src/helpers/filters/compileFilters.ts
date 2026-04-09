import type {
  CustomFilterDef,
  DateFilterDef,
  FilterDef,
  ReferenceFilterDef,
  SearchFieldPath,
} from '@sanity-labs/react-table-kit'
import {getFilterKey, isFilterActiveValue} from '@sanity-labs/react-table-kit'

export interface CompileFiltersOptions {
  documentType: string | string[]
  values: Record<string, unknown>
  params?: Record<string, unknown>
}

export interface CompiledFiltersResult {
  groq: string | null
  params: Record<string, unknown>
}

function nextParamName(filterKey: string, suffix: string): string {
  return `${filterKey}_${suffix}`.replace(/[^a-zA-Z0-9_]+/g, '_')
}

function compileStringFilter(filterDef: Extract<FilterDef, {kind: 'string'}>, value: unknown) {
  const key = getFilterKey(filterDef)

  if (filterDef.operator === 'in') {
    const values = Array.isArray(value) ? value.map(String) : [String(value)]
    return {
      groq: `${filterDef.field} in $${nextParamName(key, 'values')}`,
      params: {[nextParamName(key, 'values')]: values},
    }
  }

  return {
    groq: `${filterDef.field} == $${nextParamName(key, 'value')}`,
    params: {[nextParamName(key, 'value')]: String(value)},
  }
}

function compileBooleanFilter(filterDef: Extract<FilterDef, {kind: 'boolean'}>, value: unknown) {
  const key = getFilterKey(filterDef)
  return {
    groq: `${filterDef.field} == $${nextParamName(key, 'value')}`,
    params: {[nextParamName(key, 'value')]: Boolean(value)},
  }
}

function startOfDay(value: string): string {
  return `${value}T00:00:00Z`
}

function nextDay(value: string): string {
  const date = new Date(startOfDay(value))
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function compileDateFilter(filterDef: DateFilterDef, value: unknown) {
  const key = getFilterKey(filterDef)
  const fieldExpr =
    filterDef.granularity === 'datetime'
      ? `dateTime(${filterDef.field})`
      : `dateTime(${filterDef.field})`

  if (filterDef.operator === 'range' && typeof value === 'object' && value != null) {
    const range = value as {from?: string; to?: string}
    const parts: string[] = []
    const params: Record<string, unknown> = {}

    if (range.from) {
      const param = nextParamName(key, 'from')
      parts.push(`${fieldExpr} >= dateTime($${param})`)
      params[param] = filterDef.granularity === 'datetime' ? range.from : startOfDay(range.from)
    }

    if (range.to) {
      const param = nextParamName(key, 'to')
      parts.push(`${fieldExpr} < dateTime($${param})`)
      params[param] = filterDef.granularity === 'datetime' ? range.to : nextDay(range.to)
    }

    return {groq: parts.join(' && '), params}
  }

  if (typeof value !== 'string') return {groq: '', params: {}}

  if (filterDef.operator === 'is') {
    const fromParam = nextParamName(key, 'from')
    const toParam = nextParamName(key, 'to')
    return {
      groq: `${fieldExpr} >= dateTime($${fromParam}) && ${fieldExpr} < dateTime($${toParam})`,
      params: {
        [fromParam]: filterDef.granularity === 'datetime' ? value : startOfDay(value),
        [toParam]: filterDef.granularity === 'datetime' ? value : nextDay(value),
      },
    }
  }

  const param = nextParamName(key, 'value')
  return {
    groq:
      filterDef.operator === 'before'
        ? `${fieldExpr} < dateTime($${param})`
        : `${fieldExpr} > dateTime($${param})`,
    params: {[param]: filterDef.granularity === 'datetime' ? value : startOfDay(value)},
  }
}

function compileNumberFilter(filterDef: Extract<FilterDef, {kind: 'number'}>, value: unknown) {
  const key = getFilterKey(filterDef)

  if (filterDef.operator === 'range' && typeof value === 'object' && value != null) {
    const range = value as {from?: number; to?: number}
    const parts: string[] = []
    const params: Record<string, unknown> = {}
    if (range.from != null) {
      const param = nextParamName(key, 'from')
      parts.push(`${filterDef.field} >= $${param}`)
      params[param] = range.from
    }
    if (range.to != null) {
      const param = nextParamName(key, 'to')
      parts.push(`${filterDef.field} <= $${param}`)
      params[param] = range.to
    }
    return {groq: parts.join(' && '), params}
  }

  const param = nextParamName(key, 'value')
  const operatorMap = {
    is: '==',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  } as const
  const operator = filterDef.operator === 'range' ? 'is' : (filterDef.operator ?? 'is')

  return {
    groq: `${filterDef.field} ${operatorMap[operator]} $${param}`,
    params: {[param]: Number(value)},
  }
}

function compileReferenceFilter(filterDef: ReferenceFilterDef, value: unknown) {
  const key = getFilterKey(filterDef)
  const isArrayRelation = filterDef.relation === 'array'

  if (filterDef.operator === 'in') {
    const values = Array.isArray(value) ? value.map(String) : [String(value)]
    const param = nextParamName(key, 'values')
    if (isArrayRelation) {
      return {
        groq: `count(${filterDef.field}[_ref in $${param}]) > 0`,
        params: {[param]: values},
      }
    }
    return {
      groq: `${filterDef.field}._ref in $${param}`,
      params: {[param]: values},
    }
  }

  const param = nextParamName(key, 'value')
  if (isArrayRelation) {
    return {
      groq: `$${param} in ${filterDef.field}[]._ref`,
      params: {[param]: String(value)},
    }
  }
  return {
    groq: `${filterDef.field}._ref == $${param}`,
    params: {[param]: String(value)},
  }
}

function searchFieldExpression(field: string | SearchFieldPath): string {
  return typeof field === 'string' ? field : field.path
}

function compileSearchFilter(filterDef: Extract<FilterDef, {kind: 'search'}>, value: unknown) {
  const key = getFilterKey(filterDef)
  const param = nextParamName(key, 'query')
  const query = String(value).trim()
  const pattern = filterDef.mode === 'match' ? query : `*${query}*`
  const parts = filterDef.fields.map((field) => `${searchFieldExpression(field)} match $${param}`)

  return {
    groq: `(${parts.join(' || ')})`,
    params: {[param]: pattern},
  }
}

function compileCustomFilter(
  filterDef: CustomFilterDef,
  value: unknown,
  options: CompileFiltersOptions,
) {
  if (!filterDef.query || value == null) return {groq: '', params: {}}
  return filterDef.query.toGroq(value, {
    documentType: options.documentType,
    params: options.params,
  })
}

export function compileFilters(
  filterDefs: FilterDef[] | undefined,
  options: CompileFiltersOptions,
): CompiledFiltersResult {
  if (!filterDefs || filterDefs.length === 0) {
    return {groq: null, params: {}}
  }

  const groqParts: string[] = []
  const params: Record<string, unknown> = {}

  for (const filterDef of filterDefs) {
    const key = getFilterKey(filterDef)
    const value = options.values[key]
    if (!isFilterActiveValue(value)) continue

    const compiled = (() => {
      switch (filterDef.kind) {
        case 'string':
          return compileStringFilter(filterDef, value)
        case 'boolean':
          return compileBooleanFilter(filterDef, value)
        case 'date':
          return compileDateFilter(filterDef, value)
        case 'number':
          return compileNumberFilter(filterDef, value)
        case 'reference':
          return compileReferenceFilter(filterDef, value)
        case 'search':
          return compileSearchFilter(filterDef, value)
        case 'custom':
          return compileCustomFilter(filterDef, value, options)
      }
    })()

    if (compiled.groq) {
      groqParts.push(`(${compiled.groq})`)
    }
    Object.assign(params, compiled.params)
  }

  return {
    groq: groqParts.length > 0 ? groqParts.join(' && ') : null,
    params,
  }
}
