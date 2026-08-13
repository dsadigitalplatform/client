function stageIdEqualsExpressions(field: string, stageId: string) {
  return [{ $eq: [{ $toString: field }, stageId] }, { $eq: [field, stageId] }]
}

export function buildStageAuditMatchCondition(stageIds: string | string[]): Record<string, unknown> | null {
  const ids = (Array.isArray(stageIds) ? stageIds : [stageIds]).filter(Boolean)

  if (ids.length === 0) return null

  const statusChangedStageMatch =
    ids.length === 1
      ? { $or: stageIdEqualsExpressions('$metadata.toStageId', ids[0]) }
      : {
          $or: ids.flatMap(id => stageIdEqualsExpressions('$metadata.toStageId', id))
        }

  const leadCreatedStageMatch =
    ids.length === 1
      ? { $or: stageIdEqualsExpressions('$metadata.stageId', ids[0]) }
      : {
          $or: ids.flatMap(id => stageIdEqualsExpressions('$metadata.stageId', id))
        }

  return {
    $or: [
      {
        $and: [
          {
            $or: [
              { $eq: ['$action', 'LEAD_STATUS_CHANGED'] },
              { $eq: ['$metadata.requestedAction', 'LEAD_STATUS_CHANGED'] }
            ]
          },
          statusChangedStageMatch
        ]
      },
      {
        $and: [
          {
            $or: [
              { $eq: ['$action', 'LEAD_CREATED'] },
              { $eq: ['$metadata.requestedAction', 'LEAD_CREATED'] }
            ]
          },
          leadCreatedStageMatch
        ]
      }
    ]
  }
}
