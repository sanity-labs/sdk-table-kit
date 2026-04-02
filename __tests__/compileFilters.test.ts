import {filter} from '@sanetti/sanity-table-kit'
import {describe, expect, it} from 'vitest'

import {compileFilters} from '../src/helpers/filters/compileFilters'

describe('compileFilters', () => {
  it('compiles search filters with GROQ-aware fields', () => {
    const defs = [
      filter.search({
        label: 'Search',
        fields: ['title', {path: 'section->title', label: 'Section'}],
      }),
    ]

    const result = compileFilters(defs, {
      documentType: 'article',
      values: {search: 'climate'},
    })

    expect(result.groq).toContain('title match $search_query')
    expect(result.groq).toContain('section->title match $search_query')
    expect(result.params).toEqual({search_query: '*climate*'})
  })

  it('compiles date range filters with inclusive day semantics', () => {
    const defs = [filter.date({field: 'plannedPublishDate', label: 'Planned Publish'})]

    const result = compileFilters(defs, {
      documentType: 'article',
      values: {
        plannedPublishDate: {from: '2026-04-01', to: '2026-04-30'},
      },
    })

    expect(result.groq).toContain(
      'dateTime(plannedPublishDate) >= dateTime($plannedPublishDate_from)',
    )
    expect(result.groq).toContain('dateTime(plannedPublishDate) < dateTime($plannedPublishDate_to)')
    expect(result.params.plannedPublishDate_from).toBe('2026-04-01T00:00:00Z')
    expect(String(result.params.plannedPublishDate_to)).toContain('2026-05-01T00:00:00.000Z')
  })

  it('compiles categorical string filters with explicit is and in semantics', () => {
    const defs = [
      filter.string({field: 'status', label: 'Status'}),
      filter.string({field: 'market', label: 'Market', operator: 'in'}),
    ]

    const result = compileFilters(defs, {
      documentType: 'article',
      values: {
        status: 'draft',
        market: ['uk', 'us'],
      },
    })

    expect(result.groq).toContain('status == $status_value')
    expect(result.groq).toContain('market in $market_values')
    expect(result.params).toEqual({
      status_value: 'draft',
      market_values: ['uk', 'us'],
    })
  })

  it('compiles exact boolean filters', () => {
    const defs = [filter.boolean({field: 'featured', label: 'Featured'})]

    const result = compileFilters(defs, {
      documentType: 'article',
      values: {featured: false},
    })

    expect(result.groq).toContain('featured == $featured_value')
    expect(result.params).toEqual({featured_value: false})
  })

  it('compiles reference filters for single and multi-value semantics', () => {
    const defs = [
      filter.reference({
        field: 'section',
        label: 'Section',
        referenceType: 'section',
      }),
      filter.reference({
        field: 'authors',
        label: 'Authors',
        referenceType: 'person',
        relation: 'array',
      }),
    ]

    const result = compileFilters(defs, {
      documentType: 'article',
      values: {
        section: ['section-politics'],
        authors: ['author-1', 'author-2'],
      },
    })

    expect(result.groq).toContain('section._ref in $section_values')
    expect(result.groq).toContain('count(authors[_ref in $authors_values]) > 0')
    expect(result.params).toEqual({
      section_values: ['section-politics'],
      authors_values: ['author-1', 'author-2'],
    })
  })

  it('compiles custom filters through their query contract', () => {
    const defs = [
      filter.custom<string[]>({
        label: 'Reporter',
        field: 'assignments',
        control: 'multiSelect',
        valueType: 'array',
        serialize: (value) => value,
        deserialize: (raw) => (Array.isArray(raw) ? raw : raw ? [raw] : []),
        formatChip: (value) => `${value.length} selected`,
        query: {
          toGroq: (value) => ({
            groq: 'count(assignments[assignmentType == "reporter" && userId in $reporterIds]) > 0',
            params: {reporterIds: value},
          }),
        },
      }),
    ]

    const result = compileFilters(defs, {
      documentType: 'article',
      values: {assignments: ['user-1', 'user-2']},
    })

    expect(result.groq).toContain('assignmentType == "reporter"')
    expect(result.params).toEqual({reporterIds: ['user-1', 'user-2']})
  })

  it('ignores inactive filters', () => {
    const defs = [
      filter.string({field: 'status', label: 'Status'}),
      filter.search({label: 'Search', fields: ['title']}),
    ]

    const result = compileFilters(defs, {
      documentType: 'article',
      values: {status: '', search: ''},
    })

    expect(result).toEqual({groq: null, params: {}})
  })
})
